// Has a model answer each case, grades each answer, and writes the results.
//
//   npm run eval -- --model claude-sonnet-5-5 --condition both --reps 1
//
// Run with --help for every option.

import { mkdir, writeFile } from "node:fs/promises"
import { join, relative } from "node:path"
import { pathToFileURL } from "node:url"
import { parseArgs } from "node:util"
import {
  type AgentContext,
  type AgentOutcome,
  AttemptError,
  type AttemptProgress,
  CONDITIONS,
  type Condition,
  describeError,
  emptyUsage,
  type FailureClass,
  SUBMIT_TOOL,
  systemPrompt,
  ToolSession,
  type Turn,
} from "./agent.ts"
import { type EvalCase, evalDir, loadCases } from "./cases.ts"
import { describeGrade, GraderError, gradeAnswer } from "./grader.ts"
import { anthropicClient, runAnthropic } from "./providers/anthropic.ts"
import {
  type MockAnswer,
  type MockBehavior,
  type MockFailure,
  mockModelID,
  runMock,
} from "./providers/mock.ts"
import { openAIClient, runOpenAI } from "./providers/openai.ts"
import {
  appendJSONL,
  attemptCostUSD,
  type ErrorRow,
  ensureFlowState,
  formatSpend,
  formatSummary,
  loadPrices,
  type Price,
  type Provider,
  type ResultRow,
  readJSONL,
  recordedSpend,
  summarize,
} from "./results.ts"
import { SosumiServerError, SosumiService, type ToolSpec } from "./sosumi.ts"

const usage = `Usage: npm run eval -- [options]

  --model <id>              Model ID to run (required unless --provider mock)
  --provider <name>         anthropic, openai, or mock (default: from the model ID)
  --condition <names>       sosumi, none, web, or a comma-separated list such as sosumi,web;
                            both means sosumi,none (default: both)
  --reps <n>                Attempts per case and condition (default: 1)
  --split <half>            Run only the train or the test cases of split.json
  --case <id>               Run only this case; repeat for more
  --effort <level>          Reasoning effort (default: medium)
  --max-tokens <n>          Output token limit per model response (default: 32000)
  --max-tool-calls <n>      Tool calls per attempt, including submit_answer (default: 12)
  --timeout-s <n>           Wall-clock limit per attempt in seconds (default: 300)
  --concurrency <n>         Attempts in flight (default: 4)
  --max-usd-anthropic <n>   Stop starting attempts before Anthropic spend could pass n USD
  --max-usd-openai <n>      Stop starting attempts before OpenAI spend could pass n USD
  --runs-dir <path>         Where flow directories go (default: evals/swift-api/runs)
  --variant <name>          Variant directory: baseline or v<N> (default: baseline)
  --sosumi-url <url>        Use a running Sosumi server instead of starting one
  --sosumi-port <n>         Port for the local Sosumi server (default: a free port)
  --mock-answer <name>      reference, stale, stub, or empty (mock provider)
  --mock-failure <name>     none, error, timeout, rate-limit-once, mismatch, kill-server,
                            or server-error-once (mock provider)
  --mock-behavior <name>    submit, exhaust, exhaust-no-submit, end-turn,
                            or end-turn-no-submit (mock provider)
  --mock-web-leak           The mock's web results include a page from the eval's repository
  --prices <path>           Use this price table instead of prices.json
  --mock-usd-per-attempt <n>  Spend that each mock attempt counts (default: 0)
  --max-usd-mock <n>        Spend cap for the mock provider, to test the caps

Reads API keys only from ANTHROPIC_API_KEY and OPENAI_API_KEY.`

interface WorkItem {
  evalCase: EvalCase
  condition: Condition
  rep: number
  /** How many times this attempt was retried after the Sosumi server failed. */
  serverRetries: number
}

/** Attempts that fail because the Sosumi server failed are retried this many times. */
const MAX_SERVER_RETRIES = 2

interface Ledger {
  spent: number
  maxAttempt: number
  completed: number
  inFlight: number
}

function inferProvider(model: string): Provider {
  if (model.startsWith("claude-")) return "anthropic"
  if (model.startsWith("mock")) return "mock"
  return "openai"
}

function platform(target: string): string {
  return /-apple-([a-z]+)\d/.exec(target)?.[1] ?? "unknown"
}

async function main() {
  const { values } = parseArgs({
    options: {
      model: { type: "string" },
      provider: { type: "string" },
      condition: { type: "string", default: "both" },
      reps: { type: "string", default: "1" },
      split: { type: "string" },
      case: { type: "string", multiple: true, default: [] },
      effort: { type: "string", default: "medium" },
      "max-tokens": { type: "string", default: "32000" },
      "max-tool-calls": { type: "string", default: "12" },
      "timeout-s": { type: "string", default: "300" },
      concurrency: { type: "string", default: "4" },
      "max-usd-anthropic": { type: "string" },
      "max-usd-openai": { type: "string" },
      "max-usd-mock": { type: "string" },
      "runs-dir": { type: "string", default: join(evalDir, "runs") },
      variant: { type: "string", default: "baseline" },
      "sosumi-url": { type: "string" },
      "sosumi-port": { type: "string" },
      "mock-answer": { type: "string", default: "reference" },
      "mock-failure": { type: "string", default: "none" },
      "mock-behavior": { type: "string", default: "submit" },
      "mock-usd-per-attempt": { type: "string", default: "0" },
      "mock-web-leak": { type: "boolean", default: false },
      prices: { type: "string" },
      help: { type: "boolean", default: false },
    },
  })
  if (values.help) {
    console.log(usage)
    return
  }

  const mockAnswer = values["mock-answer"] as MockAnswer
  const mockFailure = values["mock-failure"] as MockFailure
  const mockBehavior = values["mock-behavior"] as MockBehavior
  const provider = (values.provider ?? inferProvider(values.model ?? "")) as Provider
  if (!["anthropic", "openai", "mock"].includes(provider))
    throw new Error(`Unknown provider ${provider}`)
  if (provider === "mock") {
    if (!["reference", "stale", "stub", "empty"].includes(mockAnswer))
      throw new Error(`Unknown mock answer ${mockAnswer}`)
    const failures = [
      "none",
      "error",
      "timeout",
      "rate-limit-once",
      "mismatch",
      "kill-server",
      "server-error-once",
      "context-overflow",
    ]
    if (!failures.includes(mockFailure)) {
      throw new Error(`Unknown mock failure ${mockFailure}`)
    }
    const behaviors = ["submit", "exhaust", "exhaust-no-submit", "end-turn", "end-turn-no-submit"]
    if (!behaviors.includes(mockBehavior)) {
      throw new Error(`Unknown mock behavior ${mockBehavior}`)
    }
  }
  const requestedModel = provider === "mock" ? mockModelID(mockAnswer) : values.model
  if (!requestedModel) throw new Error(`--model is required.\n\n${usage}`)
  const model: string = requestedModel
  if (!/^(baseline|v\d+)$/.test(values.variant))
    throw new Error("--variant must be baseline or v<N>")

  const conditions = [
    ...new Set(
      values.condition
        .split(",")
        .map((name) => name.trim())
        .flatMap((name) => (name === "both" ? ["sosumi", "none"] : [name])),
    ),
  ] as Condition[]
  const unknownConditions = conditions.filter((name) => !CONDITIONS.includes(name))
  if (conditions.length === 0 || unknownConditions.length > 0) {
    throw new Error(`Unknown condition ${unknownConditions.join(", ") || values.condition}`)
  }
  const runsDir = values["runs-dir"] as string
  const reps = Number(values.reps)
  const maxToolCalls = Number(values["max-tool-calls"])
  const timeoutMs = Number(values["timeout-s"]) * 1_000
  const concurrency = Math.max(1, Number(values.concurrency))
  const effort = values.effort
  const maxTokens = Number(values["max-tokens"])

  // Prices: refuse to run a paid model whose price is unknown.
  const prices = await loadPrices(values.prices)
  let price: Price | null = null
  if (provider === "anthropic" || provider === "openai") {
    price = prices[provider][model] ?? null
    if (!price) {
      throw new Error(
        `prices.json has no price for ${provider} model ${model}; add one before running it.`,
      )
    }
  }
  // The web condition also pays per search: refuse it for a provider without that price.
  const searchPrice = prices.web_search?.[provider]?.usd_per_1000
  if (conditions.includes("web") && typeof searchPrice !== "number") {
    throw new Error(
      `The price table has no web search price for ${provider}; add web_search.${provider}.usd_per_1000 before running the web condition.`,
    )
  }
  const mockUSD = Number(values["mock-usd-per-attempt"])
  const attemptCost = (progress: AttemptProgress) =>
    (provider === "mock"
      ? mockUSD
      : attemptCostUSD(progress.requests, price as Price, prices.cache_write_multiplier)) +
    (progress.webSearches * (searchPrice ?? 0)) / 1_000
  const capFlag = {
    anthropic: values["max-usd-anthropic"],
    openai: values["max-usd-openai"],
    mock: values["max-usd-mock"],
  }[provider]
  const cap = capFlag === undefined ? undefined : Number(capFlag)

  // Clients are created up front, so that a missing key fails before any work starts.
  const anthropic = provider === "anthropic" ? anthropicClient() : null
  const openai = provider === "openai" ? openAIClient() : null

  if (values.split !== undefined && values.split !== "train" && values.split !== "test") {
    throw new Error("--split must be train or test")
  }
  const cases = (await loadCases(values.case)).filter(
    (evalCase) => values.split === undefined || evalCase.split === values.split,
  )
  if (cases.length === 0) throw new Error("No cases to run")
  const modelDir =
    provider === "mock"
      ? [
          model,
          mockFailure !== "none" ? mockFailure : "",
          mockBehavior !== "submit" ? mockBehavior : "",
          values["mock-web-leak"] ? "web-leak" : "",
        ]
          .filter(Boolean)
          .join("-")
      : model
  const variantDirs = new Map<Condition, string>()
  for (const condition of conditions) {
    const flowDir = join(runsDir, modelDir, condition)
    const variantDir = join(flowDir, values.variant)
    await ensureFlowState(flowDir, model, price)
    await mkdir(join(variantDir, "traces"), { recursive: true })
    await mkdir(join(variantDir, "answers"), { recursive: true })
    variantDirs.set(condition, variantDir)
  }

  // Resume: skip every (case, rep) that already has a row in results.jsonl.
  const queue: WorkItem[] = []
  for (const condition of conditions) {
    const variantDir = variantDirs.get(condition) as string
    const done = new Set(
      (await readJSONL<ResultRow>(join(variantDir, "results.jsonl"))).map(
        (row) => `${row.prompt_id}#${row.rep}`,
      ),
    )
    for (const evalCase of cases) {
      for (let rep = 0; rep < reps; rep++) {
        if (!done.has(`${evalCase.meta.id}#${rep}`))
          queue.push({ evalCase, condition, rep, serverRetries: 0 })
      }
    }
  }
  const skipped = conditions.length * cases.length * reps - queue.length
  console.log(
    `${model} (${provider}): ${queue.length} attempts to run` +
      (skipped > 0 ? `, ${skipped} already recorded` : "") +
      `, conditions ${conditions.join(" and ")}`,
  )

  // Sosumi: the real tools from a local server, over MCP.
  // The service restarts the server if it exits during the run.
  let sosumi: SosumiService | null = null
  if (conditions.includes("sosumi") && queue.some((item) => item.condition === "sosumi")) {
    await mkdir(runsDir, { recursive: true })
    sosumi = await SosumiService.start({
      url: values["sosumi-url"],
      port: values["sosumi-port"] === undefined ? undefined : Number(values["sosumi-port"]),
      logPath: join(runsDir, "sosumi-server.log"),
      log: (message) => console.log(message),
    })
    console.log(`Sosumi tools: ${sosumi.tools.map((tool) => tool.name).join(", ")}`)
  }
  // Test hooks for the mock provider: kill the server before the run's first Sosumi call,
  // or fail the first attempt's Sosumi call as if the server could not be restarted.
  let serverFailureInjected = false
  const callSosumi = async (name: string, args: unknown, signal: AbortSignal) => {
    if (!sosumi) throw new Error("No Sosumi server")
    if (provider === "mock" && !serverFailureInjected) {
      if (mockFailure === "kill-server") {
        serverFailureInjected = true
        await sosumi.killServerForTest()
      } else if (mockFailure === "server-error-once") {
        serverFailureInjected = true
        throw new SosumiServerError("Injected Sosumi server failure")
      }
    }
    return sosumi.call(name, args, signal)
  }
  const toolsFor = (condition: Condition): ToolSpec[] =>
    condition === "sosumi" && sosumi
      ? [...sosumi.tools.map(withoutSchemaKeyword), SUBMIT_TOOL]
      : [SUBMIT_TOOL]

  const ledger: Ledger = { spent: 0, maxAttempt: 0, completed: 0, inFlight: 0 }
  let stoppedForCap = false
  const waiters: (() => void)[] = []
  const settled = () => new Promise<void>((resolvePromise) => waiters.push(resolvePromise))
  const wake = () => {
    for (const resolvePromise of waiters.splice(0)) resolvePromise()
  }

  const charge = (cost: number) => {
    ledger.spent += cost
    ledger.maxAttempt = Math.max(ledger.maxAttempt, cost)
    ledger.completed++
  }

  /** Runs one attempt. Returns the failure class when the attempt produced no scorable answer. */
  async function attempt(item: WorkItem): Promise<FailureClass | null> {
    const { evalCase, condition, rep } = item
    const { meta } = evalCase
    const variantDir = variantDirs.get(condition) as string
    const key = `${meta.id}_rep${rep}`
    const system = systemPrompt(condition, maxToolCalls)
    const trace: Turn[] = [
      { role: "system", content: system },
      { role: "user", content: evalCase.task },
    ]
    const progress: AttemptProgress = {
      model: null,
      usage: emptyUsage(),
      requests: [],
      retries: 0,
      toolCalls: 0,
      sosumiCalls: 0,
      cutResults: 0,
      webSearches: 0,
      webFetches: 0,
      leaks: [],
    }
    const tools = toolsFor(condition)
    const controller = new AbortController()
    const session = new ToolSession({
      sosumiTools: tools.filter((tool) => tool !== SUBMIT_TOOL).map((tool) => tool.name),
      progress,
      maxToolCalls,
      callSosumi,
    })
    const context: AgentContext = {
      condition,
      system,
      task: evalCase.task,
      tools,
      signal: controller.signal,
      trace,
      progress,
      session,
    }

    const started = performance.now()
    let timer: NodeJS.Timeout | undefined
    const ceiling = new Promise<never>((_, rejectPromise) => {
      timer = setTimeout(() => {
        const error = new AttemptError("timeout", `No answer within ${timeoutMs / 1_000} s`)
        controller.abort(error)
        rejectPromise(error)
      }, timeoutMs)
    })
    const run = (): Promise<AgentOutcome> => {
      if (provider === "anthropic" && anthropic) {
        return runAnthropic(anthropic, { model, effort: effort as never, maxTokens }, context)
      }
      if (provider === "openai" && openai) {
        return runOpenAI(openai, { model, effort: effort as never, maxTokens }, context)
      }
      return runMock(
        {
          answer: mockAnswer,
          failure: mockFailure,
          behavior: mockBehavior,
          webLeak: values["mock-web-leak"],
          caseDir: evalCase.dir,
          docsPath: meta.docs[0].replace("https://sosumi.ai", ""),
        },
        context,
      )
    }

    const recordError = async (failure: AttemptError) => {
      const cost = attemptCost(progress)
      charge(cost)
      const row: ErrorRow = {
        prompt_id: meta.id,
        rep,
        failure_class: failure.failureClass,
        message: failure.message,
        retries: progress.retries,
        model: progress.model,
        usage: progress.usage,
        cost_usd: cost,
        latency_s: (performance.now() - started) / 1_000,
        provider,
        condition,
        time: new Date().toISOString(),
      }
      await writeFile(
        join(variantDir, "traces", `${key}.json`),
        `${JSON.stringify(trace, null, 2)}\n`,
      )
      await appendJSONL(join(variantDir, "errors.jsonl"), row)
      console.log(
        `  error ${condition} ${meta.id} rep ${rep}: ${failure.failureClass}: ${failure.message}`,
      )
    }

    let outcome: AgentOutcome
    const running = run()
    running.catch(() => {}) // After a timeout, the abandoned loop may still reject.
    try {
      outcome = await Promise.race([running, ceiling])
    } catch (error) {
      const reason = controller.signal.reason
      const failure =
        error instanceof AttemptError
          ? error
          : reason instanceof AttemptError
            ? reason
            : new AttemptError("harness_error", describeError(error), { cause: error })
      await recordError(failure)
      return failure.failureClass
    } finally {
      clearTimeout(timer)
      if (!controller.signal.aborted) controller.abort(new Error("Attempt finished"))
    }
    const latency = (performance.now() - started) / 1_000
    if (provider !== "mock" && !outcome.model)
      throw new Error(`Missing model on a completed attempt for ${key}`)

    const answer = outcome.answer ?? ""
    const answerPath = join("answers", `${key}.swift`)
    if (outcome.answer !== null) await writeFile(join(variantDir, answerPath), outcome.answer)
    await writeFile(
      join(variantDir, "traces", `${key}.json`),
      `${JSON.stringify(trace, null, 2)}\n`,
    )

    const failureClass = {
      submitted: undefined,
      end_turn: "no_submission",
      tool_limit: "tool_limit",
      refusal: "refusal",
      max_tokens: "truncated",
      context_overflow: "context_overflow",
    }[outcome.endReason]
    const cost = attemptCost(progress)
    const base = {
      prompt_id: meta.id,
      prompt: evalCase.task,
      split: evalCase.split,
      tags: [meta.framework, meta.source, platform(meta.target)],
      rep,
      stop_reason: outcome.stopReason,
      model: outcome.model,
      usage: outcome.usage,
      latency_s: latency,
      tool_calls: outcome.toolCalls,
      sosumi_calls: outcome.sosumiCalls,
      cut_tool_results: progress.cutResults,
      web_searches: progress.webSearches,
      web_fetches: progress.webFetches,
      retries: outcome.retries,
    }
    const rowMeta = {
      provider,
      condition,
      end_reason: outcome.endReason,
      final_turn: outcome.finalTurn,
      ...(condition === "web" || progress.leaks.length > 0
        ? { web_leak: progress.leaks.length > 0, web_leak_urls: progress.leaks }
        : {}),
      ...(context.session.finalTurnReason
        ? { final_turn_reason: context.session.finalTurnReason }
        : {}),
      ...(failureClass ? { failure_class: failureClass } : {}),
      cost_usd: cost,
      ...(outcome.answer !== null ? { answer: answerPath } : {}),
      target: meta.target,
      sdk: meta.sdk ?? "macosx",
    }

    let row: ResultRow
    if (outcome.endReason === "max_tokens") {
      row = { ...base, status: "truncated", grade: {}, meta: rowMeta }
    } else {
      let grade: Awaited<ReturnType<typeof gradeAnswer>>
      try {
        grade = await gradeAnswer(meta, evalCase.check, answer)
      } catch (error) {
        if (!(error instanceof GraderError)) throw error
        // The model's call completed, so the attempt's spend counts.
        progress.model = outcome.model
        await recordError(new AttemptError("grader_error", error.message, { cause: error }))
        return "grader_error"
      }
      row = {
        ...base,
        status: "ok",
        grade: {
          typechecks: grade.typechecks ? 1 : 0,
          passes: grade.passes ? 1 : 0,
          deprecations: grade.deprecations,
        },
        explanation: {
          typechecks: grade.typechecks
            ? "Type-checks."
            : grade.typeCheck.errors.slice(0, 5).join("\n"),
          passes: describeGrade(grade) || "Passes.",
        },
        meta: { ...rowMeta, violations: grade.violations, missing_symbols: grade.missingSymbols },
      }
    }
    charge(cost)
    await appendJSONL(join(variantDir, "results.jsonl"), row)
    const verdict =
      row.status === "ok"
        ? `typechecks ${row.grade.typechecks} passes ${row.grade.passes}`
        : row.status
    console.log(`  ${condition} ${meta.id} rep ${rep}: ${verdict}`)
    return null
  }

  // Before an attempt starts, check that it cannot push the provider's spend past the cap.
  // Spend is cumulative: every results and error row for the provider under the runs directory,
  // which includes the attempts of this run that have finished.
  // Each attempt in flight, and the next one, counts as the costliest attempt seen so far.
  // While no attempt has a recorded cost, attempts run one at a time.
  let projection = { spent: 0, maxAttempt: 0 }
  const mayStart = async (): Promise<"go" | "wait" | "stop"> => {
    if (cap === undefined) return "go"
    const recorded = (await recordedSpend(runsDir))[provider] ?? {
      spent: 0,
      maxAttempt: 0,
      attempts: 0,
    }
    const maxAttempt = Math.max(recorded.maxAttempt, ledger.maxAttempt)
    projection = { spent: recorded.spent, maxAttempt }
    if (recorded.attempts === 0 && ledger.completed === 0) {
      if (ledger.inFlight > 0) return "wait"
      return cap > 0 ? "go" : "stop"
    }
    const projected = recorded.spent + (ledger.inFlight + 1) * maxAttempt
    if (projected <= cap) return "go"
    return ledger.inFlight === 0 ? "stop" : "wait"
  }

  const worker = async () => {
    while (queue.length > 0 && !stoppedForCap) {
      const decision = await mayStart()
      if (decision === "stop") {
        stoppedForCap = true
        break
      }
      if (decision === "wait") {
        await settled()
        continue
      }
      // Another worker may have taken the last item while this one checked the cap.
      const item = queue.shift()
      if (item === undefined) break
      ledger.inFlight++
      try {
        const failure = await attempt(item)
        if (failure === "sosumi_server" && item.serverRetries < MAX_SERVER_RETRIES) {
          item.serverRetries++
          queue.unshift(item)
          console.log(
            `  retrying ${item.condition} ${item.evalCase.meta.id} rep ${item.rep} ` +
              `after a Sosumi server failure (${item.serverRetries} of ${MAX_SERVER_RETRIES})`,
          )
        }
      } finally {
        ledger.inFlight--
        wake()
      }
    }
  }

  const started = performance.now()
  try {
    await Promise.all(Array.from({ length: concurrency }, worker))
  } finally {
    await sosumi?.close()
  }

  console.log("")
  if (stoppedForCap) {
    console.log(
      `Stopped before the spend cap of ${cap} USD: ${queue.length} attempts not started ` +
        `(${provider} spend recorded under ${runsDir}: ${projection.spent.toFixed(4)} USD; ` +
        `the costliest attempt so far was ${projection.maxAttempt.toFixed(4)} USD).`,
    )
  }
  if (sosumi && sosumi.restarts > 0)
    console.log(`The Sosumi server was restarted ${sosumi.restarts} times.`)
  console.log(`Wall time ${((performance.now() - started) / 1_000).toFixed(1)} s`)
  console.log(`Spend in this run: ${provider} ${ledger.spent.toFixed(4)} USD`)
  for (const condition of conditions) {
    const summary = await summarize(variantDirs.get(condition) as string)
    const shown = relative(process.cwd(), summary.variantDir)
    console.log(
      formatSummary({
        ...summary,
        variantDir: shown.startsWith("..") ? summary.variantDir : shown,
      }),
    )
  }
  console.log(`Cumulative spend under ${runsDir}: ${formatSpend(await recordedSpend(runsDir))}`)
}

/** Drops the JSON Schema `$schema` keyword, which only names the draft; the schema is otherwise unchanged. */
function withoutSchemaKeyword(tool: ToolSpec): ToolSpec {
  const { $schema: _, ...schema } = tool.inputSchema
  return { ...tool, inputSchema: schema }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exit(1)
  })
}

// Tests the whole pipeline without paid calls, using the mock provider.
//
//   npm run test:mock [-- --keep] [-- --sosumi-url <url>]
//
// Runs every case in both conditions with the reference, stale, stub, and
// empty answers, through a local Sosumi server, then checks the scores,
// induced failures, resume, the spend cap, and that grading twice agrees.

import { execFile } from "node:child_process"
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { createServer } from "node:net"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { parseArgs } from "node:util"
import { evalDir } from "./cases.ts"
import {
  checkProviderEdgeCases,
  checkProviderLoops,
  checkWebBudgets,
  checkWebLoops,
} from "./provider-loops.ts"
import { regrade } from "./regrade.ts"
import { type ErrorRow, type ResultRow, readJSONL, summarize } from "./results.ts"
import { traceLimits } from "./run.ts"
import { freePort, type LocalServer, startLocalServer } from "./sosumi.ts"

const { values } = parseArgs({
  options: {
    keep: { type: "boolean", default: false },
    "sosumi-url": { type: "string" },
    "sosumi-port": { type: "string" },
  },
})

const failures: string[] = []
function check(condition: boolean, message: string) {
  console.log(`${condition ? "ok  " : "FAIL"} ${message}`)
  if (!condition) failures.push(message)
}

function runEval(args: string[]): Promise<string> {
  return new Promise((resolvePromise, rejectPromise) => {
    execFile(
      process.execPath,
      [
        "--experimental-strip-types",
        "--disable-warning=ExperimentalWarning",
        join(evalDir, "src", "run.ts"),
        ...args,
      ],
      { cwd: evalDir, maxBuffer: 64 * 1024 * 1024 },
      (error, stdout, stderr) => {
        if (error) rejectPromise(new Error(`run.ts ${args.join(" ")} failed:\n${stdout}${stderr}`))
        else resolvePromise(stdout)
      },
    )
  })
}

const percent = (value: number) => `${(value * 100).toFixed(1)}%`

// 0. The provider loops, driven by fake clients with scripted responses.
await checkProviderLoops(check)
await checkProviderEdgeCases(check)
await checkWebLoops(check)
checkWebBudgets(check)

const runsDir = await mkdtemp(join(tmpdir(), "swift-api-mock-"))
let server: LocalServer | null = null
try {
  let url = values["sosumi-url"]
  if (!url) {
    server = await startLocalServer(
      values["sosumi-port"] ? Number(values["sosumi-port"]) : await freePort(),
      join(runsDir, "sosumi-server.log"),
    )
    url = server.url
  }
  const common = [
    "--provider",
    "mock",
    "--runs-dir",
    runsDir,
    "--sosumi-url",
    url,
    "--concurrency",
    "3",
  ]
  const flow = (answer: string, condition: string, failure = "none") =>
    join(
      runsDir,
      failure === "none" ? `mock-${answer}` : `mock-${answer}-${failure}`,
      condition,
      "baseline",
    )

  // 1. Every case, both conditions, four answers.
  console.log(`Runs directory: ${runsDir}`)
  const started = performance.now()
  for (const answer of ["reference", "stale", "stub", "empty"]) {
    await runEval([...common, "--mock-answer", answer, "--condition", "both"])
  }
  console.log(`Full mock pass: ${((performance.now() - started) / 1_000).toFixed(1)} s\n`)

  console.log("| Answer | Condition | Cases | passes | typechecks | Errors |")
  console.log("| --- | --- | --- | --- | --- | --- |")
  const summaries = new Map<string, Awaited<ReturnType<typeof summarize>>>()
  for (const answer of ["reference", "stale", "stub", "empty"]) {
    for (const condition of ["sosumi", "none"]) {
      const summary = await summarize(flow(answer, condition))
      summaries.set(`${answer}/${condition}`, summary)
      console.log(
        `| ${answer} | ${condition} | ${summary.cases} | ${percent(summary.passes.mean)} | ${percent(summary.typechecks.mean)} | ${summary.errors} |`,
      )
    }
  }
  console.log("")
  for (const condition of ["sosumi", "none"]) {
    const reference = summaries.get(`reference/${condition}`)
    check(
      reference?.passes.mean === 1 && reference.errors === 0,
      `reference passes every case (${condition})`,
    )
    check(
      summaries.get(`stale/${condition}`)?.typechecks.mean === 0,
      `stale type-checks in no case (${condition})`,
    )
    check(
      summaries.get(`stub/${condition}`)?.passes.mean === 0,
      `stub passes no case (${condition})`,
    )
    check(
      summaries.get(`empty/${condition}`)?.typechecks.mean === 0,
      `empty answer type-checks in no case (${condition})`,
    )
  }
  const sosumiRows = await readJSONL<ResultRow>(join(flow("reference", "sosumi"), "results.jsonl"))
  const noneRows = await readJSONL<ResultRow>(join(flow("reference", "none"), "results.jsonl"))
  check(
    sosumiRows.every((row) => row.sosumi_calls === 1 && row.tool_calls === 2),
    "sosumi rows record one Sosumi call",
  )
  check(
    noneRows.every((row) => row.sosumi_calls === 0 && row.tool_calls === 1),
    "none rows record no Sosumi call",
  )

  // The split: every row carries its half of split.json, and --split runs one half.
  const splitFile = JSON.parse(await readFile(join(evalDir, "split.json"), "utf8")) as {
    train: string[]
    test: string[]
  }
  check(
    noneRows.every((row) =>
      row.split === "train"
        ? splitFile.train.includes(row.prompt_id)
        : splitFile.test.includes(row.prompt_id),
    ),
    "each row records the half of split.json that its case belongs to",
  )
  const testOnly = await runEval([
    ...common,
    "--mock-answer",
    "reference",
    "--condition",
    "none",
    "--split",
    "test",
    "--runs-dir",
    join(runsDir, "split-test"),
  ])
  const testRows = await readJSONL<ResultRow>(
    join(runsDir, "split-test", "mock-reference", "none", "baseline", "results.jsonl"),
  )
  check(
    testRows.length === splitFile.test.length &&
      testRows.every((row) => row.split === "test") &&
      testOnly.includes(`test     100.0%`) &&
      testOnly.includes("over 0 cases"),
    `--split test runs only the ${splitFile.test.length} test cases, and the summary prints each half`,
  )

  // 2. Induced failures land in errors.jsonl with a failure class, not in results.jsonl.
  const one = ["--case", "control-sha256-hex", "--condition", "none"]
  await runEval([...common, ...one, "--mock-failure", "error"])
  await runEval([...common, ...one, "--mock-failure", "timeout", "--timeout-s", "2"])
  await runEval([...common, ...one, "--mock-failure", "mismatch"])
  await runEval([...common, ...one, "--mock-failure", "rate-limit-once"])
  for (const [failure, expected] of [
    ["error", "api_error"],
    ["timeout", "timeout"],
    ["mismatch", "model_mismatch"],
  ]) {
    const errors = await readJSONL<ErrorRow>(
      join(flow("reference", "none", failure), "errors.jsonl"),
    )
    const results = await readJSONL<ResultRow>(
      join(flow("reference", "none", failure), "results.jsonl"),
    )
    check(
      errors.length === 1 && errors[0].failure_class === expected && results.length === 0,
      `induced ${failure} is recorded in errors.jsonl as ${expected}`,
    )
  }
  const timeoutRow = (
    await readJSONL<ErrorRow>(join(flow("reference", "none", "timeout"), "errors.jsonl"))
  )[0]
  check(
    timeoutRow !== undefined && timeoutRow.latency_s < 10,
    `the timeout fired at ${timeoutRow?.latency_s.toFixed(1)} s`,
  )
  const retried = await readJSONL<ResultRow>(
    join(flow("reference", "none", "rate-limit-once"), "results.jsonl"),
  )
  check(
    retried.length === 1 && retried[0].retries === 1,
    "a rate limit is retried once and the retry is recorded",
  )

  // The tool-call limit: an agent that uses every call gets one final turn to submit.
  check(
    sosumiRows.every((row) => row.meta.final_turn === false),
    "rows of agents that submit within the limit record no final turn",
  )
  const limited = ["--case", "control-sha256-hex", "--condition", "both"]
  await runEval([...common, ...limited, "--mock-behavior", "exhaust"])
  await runEval([...common, ...limited, "--mock-behavior", "exhaust-no-submit"])
  for (const condition of ["sosumi", "none"]) {
    const used = await readJSONL<ResultRow>(
      join(
        flow("reference", condition, "none").replace("mock-reference", "mock-reference-exhaust"),
        "results.jsonl",
      ),
    )
    const unused = await readJSONL<ResultRow>(
      join(
        flow("reference", condition, "none").replace(
          "mock-reference",
          "mock-reference-exhaust-no-submit",
        ),
        "results.jsonl",
      ),
    )
    const expectedSosumiCalls = condition === "sosumi" ? 12 : 0
    check(
      used.length === 1 &&
        used[0].meta.final_turn === true &&
        used[0].meta.end_reason === "submitted" &&
        used[0].grade.passes === 1 &&
        used[0].tool_calls === 13 &&
        used[0].sosumi_calls === expectedSosumiCalls,
      `after 12 calls, the final turn lets the agent submit (${condition})`,
    )
    check(
      unused.length === 1 &&
        unused[0].meta.final_turn === true &&
        unused[0].meta.end_reason === "tool_limit" &&
        unused[0].meta.failure_class === "tool_limit" &&
        unused[0].grade.passes === 0,
      `an agent that does not submit in the final turn scores as tool_limit (${condition})`,
    )
  }
  const usedTrace = JSON.parse(
    await readFile(
      join(
        runsDir,
        "mock-reference-exhaust",
        "sosumi",
        "baseline",
        "traces",
        "control-sha256-hex_rep0.json",
      ),
      "utf8",
    ),
  ) as { role: string; content: string }[]
  check(
    usedTrace.some(
      (turn) => turn.role === "user" && turn.content.includes("submit_answer is now the only tool"),
    ),
    "the trace records the final-turn message",
  )

  // A turn that ends without a submission gets the same final turn, and a context overflow
  // is scored as a failure instead of an unscored error.
  const single = ["--case", "control-sha256-hex", "--condition", "none"]
  await runEval([...common, ...single, "--mock-behavior", "end-turn"])
  await runEval([...common, ...single, "--mock-behavior", "end-turn-no-submit"])
  await runEval([...common, ...single, "--mock-failure", "context-overflow"])
  const endTurn = await readJSONL<ResultRow>(
    join(runsDir, "mock-reference-end-turn", "none", "baseline", "results.jsonl"),
  )
  const endTurnNoSubmit = await readJSONL<ResultRow>(
    join(runsDir, "mock-reference-end-turn-no-submit", "none", "baseline", "results.jsonl"),
  )
  check(
    endTurn.length === 1 &&
      endTurn[0].meta.final_turn === true &&
      endTurn[0].meta.final_turn_reason === "end_turn" &&
      endTurn[0].meta.end_reason === "submitted" &&
      endTurn[0].grade.passes === 1,
    "after an end_turn without a submission, the final turn lets the agent submit",
  )
  check(
    endTurnNoSubmit.length === 1 &&
      endTurnNoSubmit[0].meta.final_turn_reason === "end_turn" &&
      endTurnNoSubmit[0].meta.end_reason === "end_turn" &&
      endTurnNoSubmit[0].meta.failure_class === "no_submission" &&
      endTurnNoSubmit[0].grade.passes === 0,
    "an agent that does not submit in that final turn scores as no_submission",
  )
  const overflowDir = join(runsDir, "mock-reference-context-overflow", "none", "baseline")
  const overflowRows = await readJSONL<ResultRow>(join(overflowDir, "results.jsonl"))
  const overflowErrors = await readJSONL<ErrorRow>(join(overflowDir, "errors.jsonl"))
  await runEval([...common, ...single, "--mock-failure", "context-overflow"])
  const overflowAgain = await readJSONL<ResultRow>(join(overflowDir, "results.jsonl"))
  check(
    overflowRows.length === 1 &&
      overflowRows[0].meta.failure_class === "context_overflow" &&
      overflowRows[0].grade.passes === 0 &&
      overflowErrors.length === 0 &&
      overflowAgain.length === 1,
    "a context overflow is scored as a context_overflow failure, and resume does not repeat it",
  )
  check(
    sosumiRows.every((row) => row.cut_tool_results === 0),
    "rows record how many tool results were cut",
  )
  const systemTurn = (
    JSON.parse(
      await readFile(
        join(flow("reference", "none"), "traces", "control-sha256-hex_rep0.json"),
        "utf8",
      ),
    ) as { role: string; name?: string; content: string }[]
  ).find((turn) => turn.role === "system" && turn.name !== "limits")
  check(
    systemTurn?.content.includes(
      "Do not redeclare any type that the task says is already declared",
    ) === true &&
      systemTurn.content.includes("in the Swift language mode that the task states") &&
      noneRows.every((row) => row.prompt.includes("- Language mode: Swift 6")),
    "the system prompt forbids redeclarations and points to the language mode that each task states",
  )

  // The web condition: server-side searches and fetches count as calls and cost money,
  // a result from Sosumi's repository flags the row and leaves it out of the headline,
  // and a price table without a web search price refuses the condition.
  const webCases = ["--case", "control-sha256-hex", "--case", "fm-image-attachment"]
  const listed = await runEval([...common, ...webCases, "--condition", "none,web"])
  const webRows = await readJSONL<ResultRow>(join(flow("reference", "web"), "results.jsonl"))
  const webNoneRows = await readJSONL<ResultRow>(join(flow("reference", "none"), "results.jsonl"))
  check(
    listed.includes("conditions none and web") &&
      webRows.length === 2 &&
      webNoneRows.length >= 2 &&
      webRows.every(
        (row) =>
          row.grade.passes === 1 &&
          row.web_searches === 1 &&
          row.web_fetches === 1 &&
          row.tool_calls === 3 &&
          row.sosumi_calls === 0 &&
          row.meta.web_leak === false &&
          Math.abs(row.meta.cost_usd - 0.01) < 1e-9,
      ),
    "--condition none,web runs both; web rows count a search and a fetch as calls and bill the search",
  )
  const webTrace = JSON.parse(
    await readFile(
      join(flow("reference", "web"), "traces", "control-sha256-hex_rep0.json"),
      "utf8",
    ),
  ) as { role: string; name?: string; content: string }[]
  check(
    webTrace.some(
      (turn) => turn.role === "system" && turn.content.includes("web search and web fetch"),
    ) &&
      webTrace.some((turn) => turn.name === "web_search" && turn.role === "tool_call") &&
      webTrace.some((turn) => turn.name === "web_fetch" && turn.role === "tool_result"),
    "web traces record the system prompt's web sentence, each search, and each fetch",
  )
  check(
    webTrace[0]?.name === "limits" &&
      webTrace[0].content.includes("Tool-call limit: 12") &&
      webTrace[0].content.includes("max_tool_calls") === false &&
      webTrace[1]?.role === "system" &&
      webTrace[1].content.startsWith("You write Swift code"),
    "each trace starts with a header that records the call limit for readers",
  )
  check(
    traceLimits("web", "anthropic", 12).includes("at most 6 web searches and 6 web fetches") &&
      traceLimits("web", "openai", 12).includes("max_tool_calls") &&
      !traceLimits("sosumi", "anthropic", 12).includes("web"),
    "the trace header records the Anthropic 6/6 split and the OpenAI combined cap",
  )

  const leaked = await runEval([...common, ...webCases, "--condition", "web", "--mock-web-leak"])
  const leakDir = join(runsDir, "mock-reference-web-leak", "web", "baseline")
  const leakRows = await readJSONL<ResultRow>(join(leakDir, "results.jsonl"))
  const leakSummary = await summarize(leakDir)
  check(
    leakRows.length === 2 &&
      leakRows.every(
        (row) =>
          row.meta.web_leak === true &&
          JSON.stringify(row.meta.web_leak_urls) ===
            '["https://github.com/NSHipster/sosumi.ai/pull/128"]',
      ) &&
      leakSummary.leaked === 2 &&
      leakSummary.cases === 0 &&
      leaked.includes("left out for a Sosumi or repository leak: 2 rows"),
    "a web result from the eval's repository flags the row, which the headline leaves out and counts",
  )

  await runEval([
    ...common,
    "--case",
    "control-sha256-hex",
    "--condition",
    "web",
    "--mock-behavior",
    "exhaust",
  ])
  const webLimit = await readJSONL<ResultRow>(
    join(runsDir, "mock-reference-exhaust", "web", "baseline", "results.jsonl"),
  )
  check(
    webLimit.length === 1 &&
      webLimit[0].web_searches === 12 &&
      webLimit[0].tool_calls === 13 &&
      webLimit[0].meta.final_turn_reason === "tool_limit" &&
      webLimit[0].grade.passes === 1,
    "twelve web searches reach the limit, and the final turn still lets the agent submit",
  )

  const prices = JSON.parse(await readFile(join(evalDir, "prices.json"), "utf8")) as {
    web_search: Record<string, unknown>
  }
  delete prices.web_search.mock
  const pricesPath = join(runsDir, "prices-without-mock-search.json")
  await writeFile(pricesPath, JSON.stringify(prices))
  let refusal = ""
  try {
    refusal = await runEval([
      ...common,
      "--case",
      "control-sha256-hex",
      "--condition",
      "sosumi,web",
      "--prices",
      pricesPath,
      "--runs-dir",
      join(runsDir, "no-search-price"),
    ])
  } catch (error) {
    refusal = String(error)
  }
  const refusedRows = await readJSONL<ResultRow>(
    join(runsDir, "no-search-price", "mock-reference", "sosumi", "baseline", "results.jsonl"),
  )
  check(
    refusal.includes("no web search price for mock") && refusedRows.length === 0,
    "the web condition refuses to run for a provider without a web search price, before any attempt",
  )

  // 3. Resume: a second run of the same flow adds no rows; a failed attempt runs again.
  const before = noneRows.length
  await runEval([...common, "--mock-answer", "reference", "--condition", "none"])
  const after = (await readJSONL<ResultRow>(join(flow("reference", "none"), "results.jsonl")))
    .length
  check(after === before, `resume adds no duplicate rows (${before} before, ${after} after)`)
  await runEval([...common, ...one, "--mock-failure", "error"])
  const errorsAgain = await readJSONL<ErrorRow>(
    join(flow("reference", "none", "error"), "errors.jsonl"),
  )
  check(errorsAgain.length === 2, "a failed attempt is attempted again on resume")

  // 4. The spend cap stops new attempts before the next one could pass it.
  const capped = await runEval([
    ...common,
    "--mock-answer",
    "stub",
    "--condition",
    "none",
    "--runs-dir",
    join(runsDir, "capped"),
    "--mock-usd-per-attempt",
    "1",
    "--max-usd-mock",
    "2.5",
  ])
  const cappedRows = await readJSONL<ResultRow>(
    join(runsDir, "capped", "mock-stub", "none", "baseline", "results.jsonl"),
  )
  check(
    cappedRows.length === 2 && capped.includes("Stopped before the spend cap"),
    `a cap of 2.5 USD at 1 USD per attempt stops after ${cappedRows.length} attempts`,
  )
  check(
    capped.includes("Cumulative spend under") && capped.includes("mock 2.0000 USD (2 attempts)"),
    "the summary prints the cumulative spend by provider",
  )

  // The cap counts spend already on disk: a second run of the same flow starts nothing,
  // and neither does a run of another flow under the same runs directory.
  const cappedArgs = (answer: string) => [
    ...common,
    "--mock-answer",
    answer,
    "--condition",
    "none",
    "--runs-dir",
    join(runsDir, "capped"),
    "--mock-usd-per-attempt",
    "1",
    "--max-usd-mock",
    "2.5",
  ]
  const again = await runEval(cappedArgs("stub"))
  const otherFlow = await runEval(cappedArgs("reference"))
  const cappedAfter = await readJSONL<ResultRow>(
    join(runsDir, "capped", "mock-stub", "none", "baseline", "results.jsonl"),
  )
  const otherRows = await readJSONL<ResultRow>(
    join(runsDir, "capped", "mock-reference", "none", "baseline", "results.jsonl"),
  )
  check(
    cappedAfter.length === 2 && again.includes("Stopped before the spend cap"),
    "a second run of the capped flow starts no attempt",
  )
  check(
    otherRows.length === 0 && otherFlow.includes("Stopped before the spend cap"),
    "a run of another flow counts the spend of the first and starts no attempt",
  )

  // 5. The local server: each run starts its own on a free port, a taken port fails loudly,
  // and a server that dies mid-run is restarted without failing the model.
  const ownServer = (dir: string, ...more: string[]) => [
    "--provider",
    "mock",
    "--condition",
    "sosumi",
    "--runs-dir",
    join(runsDir, dir),
    ...more,
  ]
  const portLine = /Starting a local Sosumi server on port (\d+)/
  const [firstRun, secondRun] = await Promise.all([
    runEval(ownServer("ports-a", "--case", "control-sha256-hex")),
    runEval(ownServer("ports-b", "--case", "control-sha256-hex")),
  ])
  const firstPort = portLine.exec(firstRun)?.[1]
  const secondPort = portLine.exec(secondRun)?.[1]
  check(
    firstPort !== undefined && secondPort !== undefined && firstPort !== secondPort,
    `two runs started together use their own servers (ports ${firstPort} and ${secondPort})`,
  )

  const held = createServer()
  const heldPort = await new Promise<number>((done) =>
    held.listen(0, "127.0.0.1", () => done((held.address() as { port: number }).port)),
  )
  let takenOutput = ""
  try {
    takenOutput = await runEval(
      ownServer("ports-taken", "--case", "control-sha256-hex", "--sosumi-port", String(heldPort)),
    )
  } catch (error) {
    takenOutput = String(error)
  } finally {
    held.close()
  }
  const takenRows = await readJSONL<ResultRow>(
    join(runsDir, "ports-taken", "mock-reference", "sosumi", "baseline", "results.jsonl"),
  )
  check(
    takenOutput.includes(`Port ${heldPort} is already in use`) &&
      takenOutput.includes("failed") &&
      takenRows.length === 0,
    "a --sosumi-port that another process holds stops the run with an error",
  )

  const killed = await runEval(
    ownServer(
      "crash",
      "--case",
      "control-sha256-hex",
      "--case",
      "fm-image-attachment",
      "--case",
      "network-dtls",
      "--concurrency",
      "2",
      "--mock-failure",
      "kill-server",
    ),
  )
  const crashDir = join(runsDir, "crash", "mock-reference-kill-server", "sosumi", "baseline")
  const crashRows = await readJSONL<ResultRow>(join(crashDir, "results.jsonl"))
  const crashErrors = await readJSONL<ErrorRow>(join(crashDir, "errors.jsonl"))
  check(
    killed.includes("The local Sosumi server exited; restarting it") &&
      killed.includes("The Sosumi server was restarted 1 times") &&
      crashRows.length === 3 &&
      crashRows.every((row) => row.grade.passes === 1 && row.sosumi_calls === 1) &&
      crashErrors.length === 0,
    "a server killed mid-run is restarted, and every attempt still scores",
  )

  await runEval([
    ...common,
    "--case",
    "control-sha256-hex",
    "--condition",
    "sosumi",
    "--mock-failure",
    "server-error-once",
  ])
  const retryDir = flow("reference", "sosumi", "server-error-once")
  const retryRows = await readJSONL<ResultRow>(join(retryDir, "results.jsonl"))
  const retryErrors = await readJSONL<ErrorRow>(join(retryDir, "errors.jsonl"))
  const retrySummary = await summarize(retryDir)
  check(
    retryErrors.length === 1 &&
      retryErrors[0].failure_class === "sosumi_server" &&
      retryRows.length === 1 &&
      retryRows[0].grade.passes === 1 &&
      retrySummary.errors === 0,
    "an attempt that fails because of the server is retried in the same run and scored",
  )

  // 6. Grading the same answers again gives the same verdicts, twice.
  const dirs = ["reference", "stale", "stub", "empty"].flatMap((answer) =>
    ["sosumi", "none"].map((condition) => flow(answer, condition)),
  )
  const first = await regrade(dirs)
  const second = await regrade(dirs)
  check(
    first.mismatches.length === 0,
    `regrade 1 matches all ${first.verdicts.length} recorded verdicts`,
  )
  check(
    second.mismatches.length === 0,
    `regrade 2 matches all ${second.verdicts.length} recorded verdicts`,
  )
  check(
    JSON.stringify(first.verdicts) === JSON.stringify(second.verdicts),
    "the two regrades agree with each other",
  )
} finally {
  await server?.stop()
  if (!values.keep) await rm(runsDir, { recursive: true, force: true })
}

console.log("")
console.log(
  failures.length === 0 ? "All mock pipeline checks pass." : `${failures.length} checks failed.`,
)
process.exit(failures.length === 0 ? 0 : 1)

// Drives the Anthropic and OpenAI agent loops with fake clients that return
// scripted responses, so that the tool-call limit and the final turn can be
// tested without any network call.

import type Anthropic from "@anthropic-ai/sdk"
import type OpenAI from "openai"
import {
  type AgentContext,
  type AttemptProgress,
  emptyUsage,
  NOT_RUN,
  SUBMIT_TOOL,
  TOOL_RESULT_LIMIT,
  ToolSession,
  type Turn,
} from "./agent.ts"
import { runAnthropic, webBudgets } from "./providers/anthropic.ts"
import { runOpenAI } from "./providers/openai.ts"

const MAX_CALLS = 12
const DOCS_TOOL = {
  name: "fetchAppleDocumentation",
  description: "Fetches documentation.",
  inputSchema: { type: "object", properties: { path: { type: "string" } } },
}

function makeContext(condition: "sosumi" | "web" = "sosumi"): AgentContext {
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
  const trace: Turn[] = []
  return {
    condition,
    system: "system",
    task: "task",
    tools: condition === "web" ? [SUBMIT_TOOL] : [DOCS_TOOL, SUBMIT_TOOL],
    signal: new AbortController().signal,
    trace,
    progress,
    session: new ToolSession({
      sosumiTools: condition === "web" ? [] : [DOCS_TOOL.name],
      progress,
      maxToolCalls: MAX_CALLS,
      callSosumi: async () => ({ text: "# Page", isError: false }),
    }),
  }
}

/**
 * The script: ten responses with one documentation call each, then one response with
 * three documentation calls (the 11th and 12th run; the third is over the limit),
 * then the final turn. `submitInFinalTurn` decides what the agent does there.
 */
function callsInResponse(index: number): number {
  return index < 10 ? 1 : 3
}

export async function checkProviderLoops(check: (condition: boolean, message: string) => void) {
  for (const submitInFinalTurn of [true, false]) {
    const label = submitInFinalTurn ? "submits" : "does not submit"

    // Anthropic Messages API.
    {
      const requests: Anthropic.MessageCreateParams[] = []
      const fake = {
        messages: {
          stream: (params: Anthropic.MessageCreateParams) => ({
            finalMessage: async () => {
              requests.push(structuredClone(params))
              const index = requests.length - 1
              const usage = {
                input_tokens: 10,
                output_tokens: 5,
                cache_read_input_tokens: 0,
                cache_creation_input_tokens: 0,
              }
              if (index <= 10) {
                return {
                  model: "claude-sonnet-5-5",
                  stop_reason: "tool_use",
                  usage,
                  content: Array.from({ length: callsInResponse(index) }, (_, k) => ({
                    type: "tool_use",
                    id: `call_${index}_${k}`,
                    name: DOCS_TOOL.name,
                    input: { path: "/documentation/swift" },
                  })),
                }
              }
              return submitInFinalTurn
                ? {
                    model: "claude-sonnet-5-5",
                    stop_reason: "tool_use",
                    usage,
                    content: [
                      {
                        type: "tool_use",
                        id: "submit",
                        name: "submit_answer",
                        input: { code: "let x = 1" },
                      },
                    ],
                  }
                : {
                    model: "claude-sonnet-5-5",
                    stop_reason: "end_turn",
                    usage,
                    content: [{ type: "text", text: "I need more time." }],
                  }
            },
          }),
        },
      } as unknown as Anthropic
      const context = makeContext()
      const outcome = await runAnthropic(
        fake,
        { model: "claude-sonnet-5-5", effort: "medium", maxTokens: 1000 },
        context,
      )
      const final = requests[11]
      const lastMessage = final?.messages.at(-1)
      const blocks = Array.isArray(lastMessage?.content) ? lastMessage.content : []
      const results = blocks.filter((block) => block.type === "tool_result")
      const notRun = results.filter(
        (block) => block.type === "tool_result" && block.content === NOT_RUN,
      )
      const text = blocks.find((block) => block.type === "text")
      check(
        requests.length === 12 &&
          final?.tools?.length === 1 &&
          (final.tools[0] as Anthropic.Tool).name === "submit_answer" &&
          requests[10].tools?.length === 2 &&
          results.length === 3 &&
          notRun.length === 1 &&
          text?.type === "text" &&
          text.text.includes("submit_answer is now the only tool"),
        `Anthropic loop: the final request offers only submit_answer, answers every tool call, and asks for the answer (agent ${label})`,
      )
      check(
        outcome.finalTurn &&
          outcome.toolCalls === (submitInFinalTurn ? 13 : 12) &&
          outcome.endReason === (submitInFinalTurn ? "submitted" : "tool_limit") &&
          (outcome.answer !== null) === submitInFinalTurn,
        `Anthropic loop: the outcome records the final turn and ends as ${submitInFinalTurn ? "submitted" : "tool_limit"}`,
      )
    }

    // OpenAI Responses API.
    {
      const requests: OpenAI.Responses.ResponseCreateParams[] = []
      const fake = {
        responses: {
          create: async (params: OpenAI.Responses.ResponseCreateParams) => {
            requests.push(structuredClone(params))
            const index = requests.length - 1
            const usage = {
              input_tokens: 10,
              output_tokens: 5,
              total_tokens: 15,
              input_tokens_details: { cached_tokens: 0 },
              output_tokens_details: { reasoning_tokens: 0 },
            }
            const call = (id: string, name: string, args: unknown) => ({
              type: "function_call",
              call_id: id,
              name,
              arguments: JSON.stringify(args),
            })
            const output =
              index <= 10
                ? Array.from({ length: callsInResponse(index) }, (_, k) =>
                    call(`call_${index}_${k}`, DOCS_TOOL.name, { path: "/documentation/swift" }),
                  )
                : submitInFinalTurn
                  ? [call("submit", "submit_answer", { code: "let x = 1" })]
                  : [
                      {
                        type: "message",
                        role: "assistant",
                        content: [{ type: "output_text", text: "I need more time." }],
                      },
                    ]
            return {
              model: "gpt-6.1-sol",
              status: "completed",
              incomplete_details: null,
              usage,
              output,
            }
          },
        },
      } as unknown as OpenAI
      const context = makeContext()
      const outcome = await runOpenAI(
        fake,
        { model: "gpt-6.1-sol", effort: "medium", maxTokens: 1000 },
        context,
      )
      const final = requests[11]
      const input = Array.isArray(final?.input) ? final.input : []
      const outputs = input.filter(
        (item) => "type" in item && item.type === "function_call_output",
      ) as OpenAI.Responses.ResponseInputItem.FunctionCallOutput[]
      const last = input.at(-1) as { role?: string; content?: unknown } | undefined
      check(
        requests.length === 12 &&
          final?.tools?.length === 1 &&
          (final.tools[0] as OpenAI.Responses.FunctionTool).name === "submit_answer" &&
          requests[10].tools?.length === 2 &&
          outputs.length === 13 &&
          outputs.filter((item) => item.output === NOT_RUN).length === 1 &&
          last?.role === "user" &&
          String(last.content).includes("submit_answer is now the only tool"),
        `OpenAI loop: the final request offers only submit_answer, answers every function call, and asks for the answer (agent ${label})`,
      )
      check(
        outcome.finalTurn &&
          outcome.toolCalls === (submitInFinalTurn ? 13 : 12) &&
          outcome.endReason === (submitInFinalTurn ? "submitted" : "tool_limit") &&
          (outcome.answer !== null) === submitInFinalTurn,
        `OpenAI loop: the outcome records the final turn and ends as ${submitInFinalTurn ? "submitted" : "tool_limit"}`,
      )
    }
  }
}

type Script = (requestIndex: number) => "text" | "submit" | "overflow"

/** A fake Anthropic client that follows `script` and records each request. */
function fakeAnthropic(script: Script, requests: Anthropic.MessageCreateParams[]): Anthropic {
  const usage = {
    input_tokens: 10,
    output_tokens: 5,
    cache_read_input_tokens: 0,
    cache_creation_input_tokens: 0,
  }
  return {
    messages: {
      stream: (params: Anthropic.MessageCreateParams) => ({
        finalMessage: async () => {
          requests.push(structuredClone(params))
          const step = script(requests.length - 1)
          if (step === "overflow") {
            throw Object.assign(
              new Error("400 prompt is too long: 1453316 tokens > 1000000 maximum"),
              {
                status: 400,
              },
            )
          }
          return step === "submit"
            ? {
                model: "claude-sonnet-5-5",
                stop_reason: "tool_use",
                usage,
                content: [
                  {
                    type: "tool_use",
                    id: "submit",
                    name: "submit_answer",
                    input: { code: "let x = 1" },
                  },
                ],
              }
            : {
                model: "claude-sonnet-5-5",
                stop_reason: "end_turn",
                usage,
                content: [{ type: "text", text: "Here is my plan." }],
              }
        },
      }),
    },
  } as unknown as Anthropic
}

/** A fake OpenAI client that follows `script` and records each request. */
function fakeOpenAI(script: Script, requests: OpenAI.Responses.ResponseCreateParams[]): OpenAI {
  return {
    responses: {
      create: async (params: OpenAI.Responses.ResponseCreateParams) => {
        requests.push(structuredClone(params))
        const step = script(requests.length - 1)
        if (step === "overflow") {
          throw Object.assign(
            new Error("400 Your input exceeds the context window of this model."),
            {
              status: 400,
              code: "context_length_exceeded",
            },
          )
        }
        return {
          model: "gpt-6.1-sol",
          status: "completed",
          incomplete_details: null,
          usage: {
            input_tokens: 10,
            output_tokens: 5,
            total_tokens: 15,
            input_tokens_details: { cached_tokens: 0 },
            output_tokens_details: { reasoning_tokens: 0 },
          },
          output:
            step === "submit"
              ? [
                  {
                    type: "function_call",
                    call_id: "submit",
                    name: "submit_answer",
                    arguments: JSON.stringify({ code: "let x = 1" }),
                  },
                ]
              : [
                  {
                    type: "message",
                    role: "assistant",
                    content: [{ type: "output_text", text: "Here is my plan." }],
                  },
                ],
        }
      },
    },
  } as unknown as OpenAI
}

/** Checks the final turn after end_turn, context overflow, and the tool-result limit. */
export async function checkProviderEdgeCases(check: (condition: boolean, message: string) => void) {
  // A turn that ends without submit_answer gets the final submit-only turn.
  for (const submit of [true, false]) {
    const script: Script = (index) => (index === 1 && submit ? "submit" : "text")
    const label = submit ? "submits" : "does not submit"

    const anthropicRequests: Anthropic.MessageCreateParams[] = []
    const anthropicContext = makeContext()
    const anthropic = await runAnthropic(
      fakeAnthropic(script, anthropicRequests),
      { model: "claude-sonnet-5-5", effort: "medium", maxTokens: 1000 },
      anthropicContext,
    )
    const anthropicFinal = anthropicRequests[1]
    const anthropicLast = anthropicFinal?.messages.at(-1)
    check(
      anthropicRequests.length === 2 &&
        anthropicFinal?.tools?.length === 1 &&
        anthropicLast?.role === "user" &&
        String(anthropicLast.content).includes("ended your turn without calling submit_answer") &&
        anthropic.finalTurn &&
        anthropicContext.session.finalTurnReason === "end_turn" &&
        anthropic.endReason === (submit ? "submitted" : "end_turn"),
      `Anthropic loop: after end_turn, a submit-only final turn follows (agent ${label})`,
    )

    const openAIRequests: OpenAI.Responses.ResponseCreateParams[] = []
    const openAIContext = makeContext()
    const openai = await runOpenAI(
      fakeOpenAI(script, openAIRequests),
      { model: "gpt-6.1-sol", effort: "medium", maxTokens: 1000 },
      openAIContext,
    )
    const openAIFinal = openAIRequests[1]
    const openAIInput = Array.isArray(openAIFinal?.input) ? openAIFinal.input : []
    const openAILast = openAIInput.at(-1) as { role?: string; content?: unknown } | undefined
    check(
      openAIRequests.length === 2 &&
        openAIFinal?.tools?.length === 1 &&
        openAILast?.role === "user" &&
        String(openAILast.content).includes("ended your turn without calling submit_answer") &&
        openai.finalTurn &&
        openAIContext.session.finalTurnReason === "end_turn" &&
        openai.endReason === (submit ? "submitted" : "end_turn"),
      `OpenAI loop: after end_turn, a submit-only final turn follows (agent ${label})`,
    )
  }

  // A prompt longer than the context window ends the attempt as context_overflow, without retries.
  const overflow: Script = (index) => (index === 0 ? "text" : "overflow")
  const anthropicOverflow = await runAnthropic(
    fakeAnthropic(overflow, []),
    { model: "claude-sonnet-5-5", effort: "medium", maxTokens: 1000 },
    makeContext(),
  )
  check(
    anthropicOverflow.endReason === "context_overflow" &&
      anthropicOverflow.retries === 0 &&
      anthropicOverflow.answer === null,
    "Anthropic loop: a prompt-too-long 400 ends the attempt as context_overflow",
  )
  const openAIOverflow = await runOpenAI(
    fakeOpenAI(overflow, []),
    { model: "gpt-6.1-sol", effort: "medium", maxTokens: 1000 },
    makeContext(),
  )
  check(
    openAIOverflow.endReason === "context_overflow" &&
      openAIOverflow.retries === 0 &&
      openAIOverflow.answer === null,
    "OpenAI loop: a context_length_exceeded 400 ends the attempt as context_overflow",
  )

  // Tool results are cut at 100,000 characters, with a note, and counted.
  const context = makeContext()
  const long = new ToolSession({
    sosumiTools: [DOCS_TOOL.name],
    progress: context.progress,
    maxToolCalls: MAX_CALLS,
    callSosumi: async () => ({ text: "x".repeat(250_000), isError: false }),
  })
  const cut = await long.handle(DOCS_TOOL.name, {}, context.signal, context.trace)
  const short = await long.handle(DOCS_TOOL.name, {}, context.signal, context.trace)
  check(
    cut.text.startsWith("x".repeat(TOOL_RESULT_LIMIT)) &&
      cut.text.length < TOOL_RESULT_LIMIT + 200 &&
      cut.text.includes("cut at 100,000 characters") &&
      cut.text.includes("250,000 characters") &&
      short.text.length === cut.text.length &&
      context.progress.cutResults === 2 &&
      context.trace.at(-1)?.content === short.text,
    "a tool result longer than 100,000 characters is cut, noted, counted, and traced as cut",
  )
}

const APPLE = "https://developer.apple.com/documentation/foundationmodels/languagemodel"
const REPOSITORY = "https://github.com/NSHipster/sosumi.ai/pull/128"

/** Checks the web condition: server tool blocks, pause_turn, call counting, and the leak flag. */
export async function checkWebLoops(check: (condition: boolean, message: string) => void) {
  // Anthropic: a search that pauses, a resumed request with more searches and a fetch that
  // reach the limit, then the final turn, in which the agent submits.
  {
    const requests: Anthropic.MessageCreateParams[] = []
    const usage = (searches: number, fetches: number) => ({
      input_tokens: 10,
      output_tokens: 5,
      cache_read_input_tokens: 0,
      cache_creation_input_tokens: 0,
      server_tool_use: { web_search_requests: searches, web_fetch_requests: fetches },
    })
    const responses = [
      {
        stop_reason: "pause_turn",
        usage: usage(1, 0),
        content: [
          {
            type: "server_tool_use",
            id: "srvtoolu_1",
            name: "web_search",
            input: { query: "FoundationModels LanguageModel protocol" },
            caller: { type: "direct" },
          },
          {
            type: "web_search_tool_result",
            tool_use_id: "srvtoolu_1",
            content: [
              {
                type: "web_search_result",
                url: APPLE,
                title: "LanguageModel",
                encrypted_content: "e1",
              },
              {
                type: "web_search_result",
                url: REPOSITORY,
                title: "Add a Swift API eval",
                encrypted_content: "e2",
              },
            ],
          },
        ],
      },
      {
        stop_reason: "end_turn",
        usage: usage(5, 6),
        content: [
          {
            type: "server_tool_use",
            id: "srvtoolu_2",
            name: "web_fetch",
            input: { url: APPLE },
            caller: { type: "direct" },
          },
          {
            type: "web_fetch_tool_result",
            tool_use_id: "srvtoolu_2",
            content: {
              type: "web_fetch_result",
              url: APPLE,
              content: {
                type: "document",
                source: { type: "text", media_type: "text/plain", data: "protocol LanguageModel" },
                title: "LanguageModel",
              },
              retrieved_at: "2026-11-10T00:00:00Z",
            },
          },
          { type: "text", text: "I have what I need.", citations: null },
        ],
      },
      {
        stop_reason: "tool_use",
        usage: usage(0, 0),
        content: [
          { type: "tool_use", id: "submit", name: "submit_answer", input: { code: "let x = 1" } },
        ],
      },
    ]
    const fake = {
      messages: {
        stream: (params: Anthropic.MessageCreateParams) => ({
          finalMessage: async () => {
            requests.push(structuredClone(params))
            return { model: "claude-sonnet-5-5", ...responses[requests.length - 1] }
          },
        }),
      },
    } as unknown as Anthropic
    const context = makeContext("web")
    const outcome = await runAnthropic(
      fake,
      { model: "claude-sonnet-5-5", effort: "medium", maxTokens: 1000 },
      context,
    )
    const firstTools = (requests[0]?.tools ?? []) as {
      type?: string
      name: string
      blocked_domains?: string[]
      max_uses?: number
    }[]
    const search = firstTools.find((tool) => tool.type === "web_search_20260209")
    const fetch = firstTools.find((tool) => tool.type === "web_fetch_20260209")
    check(
      search?.name === "web_search" &&
        fetch?.name === "web_fetch" &&
        JSON.stringify(search.blocked_domains) === '["sosumi.ai"]' &&
        JSON.stringify(fetch.blocked_domains) === '["sosumi.ai"]' &&
        search.max_uses === MAX_CALLS / 2 &&
        fetch.max_uses === MAX_CALLS / 2,
      "Anthropic web: both server tools block sosumi.ai, and each gets half of the call budget (6 and 6)",
    )
    check(
      requests.length === 3 &&
        requests[1].messages.length === 2 &&
        requests[1].messages.at(-1)?.role === "assistant" &&
        JSON.stringify(requests[1].tools) === JSON.stringify(requests[0].tools),
      "Anthropic web: pause_turn resumes with the paused content and the same tools, and no new message",
    )
    const finalTools = (requests[2]?.tools ?? []) as { name: string }[]
    const finalMessage = requests[2]?.messages.at(-1)
    check(
      finalTools.length === 1 &&
        finalTools[0].name === "submit_answer" &&
        String(finalMessage?.content).includes("You have used all 12 tool calls"),
      "Anthropic web: 6 searches and 6 fetches reach the limit, and the final turn offers only submit_answer",
    )
    check(
      outcome.endReason === "submitted" &&
        context.session.finalTurnReason === "tool_limit" &&
        context.progress.webSearches === 6 &&
        context.progress.webFetches === 6 &&
        outcome.toolCalls === 13 &&
        JSON.stringify(context.progress.leaks) === JSON.stringify([REPOSITORY]),
      "Anthropic web: searches and fetches count as calls, and the repository result is flagged",
    )
    const traced = context.trace
      .map((turn) => `${turn.role} ${turn.name ?? ""} ${turn.content}`)
      .join("\n")
    check(
      traced.includes("FoundationModels LanguageModel protocol") &&
        traced.includes(`- LanguageModel: ${APPLE}`) &&
        traced.includes(`- Add a Swift API eval: ${REPOSITORY}`) &&
        traced.includes(`Fetched ${APPLE} (LanguageModel)`),
      "Anthropic web: the trace records each query, each result's title and URL, and each fetched URL",
    )
  }

  // OpenAI: one response with a search (whose sources include Sosumi), an opened page,
  // a citation, and the submission; then a response that ends without submitting.
  for (const submit of [true, false]) {
    const requests: OpenAI.Responses.ResponseCreateParams[] = []
    const call = (id: string, name: string, args: unknown) => ({
      type: "function_call",
      call_id: id,
      name,
      arguments: JSON.stringify(args),
    })
    const webOutput = [
      {
        type: "web_search_call",
        id: "ws_1",
        status: "completed",
        action: {
          type: "search",
          query: "FoundationModels LanguageModel protocol",
          sources: [{ type: "url", url: "https://sosumi.ai/documentation/foundationmodels" }],
        },
      },
      {
        type: "web_search_call",
        id: "ws_2",
        status: "completed",
        action: { type: "open_page", url: APPLE },
      },
      {
        type: "message",
        role: "assistant",
        content: [
          {
            type: "output_text",
            text: "LanguageModel is a protocol.",
            annotations: [
              {
                type: "url_citation",
                url: APPLE,
                title: "LanguageModel",
                start_index: 0,
                end_index: 5,
              },
            ],
          },
        ],
      },
    ]
    const fake = {
      responses: {
        create: async (params: OpenAI.Responses.ResponseCreateParams) => {
          requests.push(structuredClone(params))
          const first = requests.length === 1
          return {
            model: "gpt-6.1-sol",
            status: "completed",
            incomplete_details: null,
            usage: {
              input_tokens: 10,
              output_tokens: 5,
              total_tokens: 15,
              input_tokens_details: { cached_tokens: 0 },
              output_tokens_details: { reasoning_tokens: 0 },
            },
            output: first
              ? [
                  ...webOutput,
                  ...(submit ? [call("c1", "submit_answer", { code: "let x = 1" })] : []),
                ]
              : [call("c2", "submit_answer", { code: "let x = 2" })],
          }
        },
      },
    } as unknown as OpenAI
    const context = makeContext("web")
    const outcome = await runOpenAI(
      fake,
      { model: "gpt-6.1-sol", effort: "medium", maxTokens: 1000 },
      context,
    )
    const first = requests[0] as OpenAI.Responses.ResponseCreateParams & { max_tool_calls?: number }
    const webTool = (first?.tools ?? []).find((tool) => tool.type === "web_search") as
      | { filters?: { blocked_domains?: string[] } }
      | undefined
    if (submit) {
      check(
        JSON.stringify(webTool?.filters?.blocked_domains) === '["sosumi.ai"]' &&
          first.max_tool_calls === MAX_CALLS &&
          (first.include ?? []).includes("web_search_call.action.sources"),
        "OpenAI web: the web search tool blocks sosumi.ai, asks for sources, and caps built-in calls at the budget",
      )
      check(
        outcome.endReason === "submitted" &&
          context.progress.webSearches === 1 &&
          context.progress.webFetches === 1 &&
          outcome.toolCalls === 3 &&
          JSON.stringify(context.progress.leaks) ===
            JSON.stringify(["https://sosumi.ai/documentation/foundationmodels"]),
        "OpenAI web: a search and an opened page count as calls, and a Sosumi source is flagged",
      )
    } else {
      const second = requests[1] as OpenAI.Responses.ResponseCreateParams & {
        max_tool_calls?: number
      }
      check(
        requests.length === 2 &&
          second.tools?.length === 1 &&
          (second.tools[0] as OpenAI.Responses.FunctionTool).name === "submit_answer" &&
          second.max_tool_calls === undefined &&
          outcome.endReason === "submitted" &&
          context.session.finalTurnReason === "end_turn",
        "OpenAI web: after an end_turn without a submission, the final turn drops the web tool",
      )
    }
  }
}

/** Checks that the two server tools' max_uses never sum past the calls left, in any state. */
export function checkWebBudgets(check: (condition: boolean, message: string) => void) {
  const failures: string[] = []
  let states = 0
  for (const limit of [1, 2, 5, 12, 13]) {
    for (let searchesUsed = 0; searchesUsed <= limit; searchesUsed++) {
      for (let fetchesUsed = 0; searchesUsed + fetchesUsed <= limit; fetchesUsed++) {
        // Other calls (such as a rejected client call) can use budget too.
        for (let other = 0; searchesUsed + fetchesUsed + other <= limit; other++) {
          const remaining = limit - searchesUsed - fetchesUsed - other
          const budget = webBudgets(limit, remaining, searchesUsed, fetchesUsed)
          states++
          const half = Math.floor(limit / 2)
          if (
            budget.searches < 0 ||
            budget.fetches < 0 ||
            budget.searches + budget.fetches > remaining ||
            // A tool never passes its half from a state the runner can reach.
            (searchesUsed <= half && searchesUsed + budget.searches > half) ||
            (fetchesUsed <= limit - half && fetchesUsed + budget.fetches > limit - half)
          ) {
            failures.push(`${limit}/${searchesUsed}/${fetchesUsed}/${other}`)
          }
        }
      }
    }
  }
  const start = webBudgets(12, 12, 0, 0)
  check(
    failures.length === 0 && start.searches === 6 && start.fetches === 6,
    `Anthropic web: in all ${states} budget states, max_uses for search and fetch never sum past the calls left`,
  )
}

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
import { runAnthropic } from "./providers/anthropic.ts"
import { runOpenAI } from "./providers/openai.ts"

const MAX_CALLS = 12
const DOCS_TOOL = {
  name: "fetchAppleDocumentation",
  description: "Fetches documentation.",
  inputSchema: { type: "object", properties: { path: { type: "string" } } },
}

function makeContext(): AgentContext {
  const progress: AttemptProgress = {
    model: null,
    usage: emptyUsage(),
    requests: [],
    retries: 0,
    toolCalls: 0,
    sosumiCalls: 0,
    cutResults: 0,
  }
  const trace: Turn[] = []
  return {
    condition: "sosumi",
    system: "system",
    task: "task",
    tools: [DOCS_TOOL, SUBMIT_TOOL],
    signal: new AbortController().signal,
    trace,
    progress,
    session: new ToolSession({
      sosumiTools: [DOCS_TOOL.name],
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

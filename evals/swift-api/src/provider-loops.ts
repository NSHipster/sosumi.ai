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

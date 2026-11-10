// Runs one case with an OpenAI model through the Responses API, with function tools.

import OpenAI from "openai"
import {
  type AgentContext,
  type AgentOutcome,
  assertModel,
  type EndReason,
  recordRequest,
  retryAfterFromHeaders,
  withRetries,
} from "../agent.ts"

export interface OpenAIOptions {
  model: string
  effort: "minimal" | "low" | "medium" | "high" | "xhigh"
  maxTokens: number
}

export function openAIClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error("Set OPENAI_API_KEY to run an OpenAI model.")
  // The runner retries by itself, so that it can count and record each retry.
  return new OpenAI({ apiKey, maxRetries: 0 })
}

const retryPolicy = {
  isRetryable(error: unknown): boolean {
    if (error instanceof OpenAI.RateLimitError) return true
    if (error instanceof OpenAI.APIError) {
      // OpenAI reports overload as 503 (and sometimes 500 with server_error).
      return error.status === 503 || error.status === 529
    }
    return false
  },
  retryAfterMs: retryAfterFromHeaders,
}

export async function runOpenAI(
  client: OpenAI,
  options: OpenAIOptions,
  context: AgentContext,
): Promise<AgentOutcome> {
  const { progress, session, trace, signal } = context
  const tools: OpenAI.Responses.FunctionTool[] = context.tools.map((tool) => ({
    type: "function",
    name: tool.name,
    description: tool.description,
    parameters: tool.inputSchema,
    strict: false,
  }))
  const input: OpenAI.Responses.ResponseInputItem[] = [{ role: "user", content: context.task }]

  while (true) {
    const response = await withRetries(
      () =>
        client.responses.create(
          {
            model: options.model,
            instructions: context.system,
            input,
            tools,
            reasoning: { effort: options.effort, summary: "auto" },
            max_output_tokens: options.maxTokens,
            store: false,
            include: ["reasoning.encrypted_content"],
          },
          { signal },
        ),
      retryPolicy,
      progress,
      signal,
    )

    progress.model = response.model
    const usage = response.usage
    if (usage) {
      const cached = usage.input_tokens_details?.cached_tokens ?? 0
      recordRequest(progress, {
        input_tokens: usage.input_tokens - cached,
        output_tokens: usage.output_tokens,
        cache_read_input_tokens: cached,
        cache_creation_input_tokens: 0,
        reasoning_tokens: usage.output_tokens_details?.reasoning_tokens ?? 0,
      })
    }
    assertModel(options.model, response.model)

    let thinking = ""
    let refused = false
    const calls: OpenAI.Responses.ResponseFunctionToolCall[] = []
    for (const item of response.output) {
      if (item.type === "reasoning") {
        thinking += (item.summary ?? []).map((part) => part.text).join("\n")
      } else if (item.type === "message") {
        for (const part of item.content) {
          if (part.type === "output_text" && part.text.trim()) {
            trace.push({ role: "assistant", content: part.text, ...(thinking ? { thinking } : {}) })
            thinking = ""
          } else if (part.type === "refusal") {
            refused = true
            trace.push({ role: "assistant", content: part.refusal })
          }
        }
      } else if (item.type === "function_call") {
        let args: string
        try {
          args = JSON.stringify(JSON.parse(item.arguments), null, 2)
        } catch {
          args = item.arguments
        }
        trace.push({
          role: "tool_call",
          name: item.name,
          content: args,
          ...(thinking ? { thinking } : {}),
        })
        thinking = ""
        calls.push(item)
      }
    }
    if (thinking) trace.push({ role: "assistant", content: "", thinking })
    input.push(...(response.output as OpenAI.Responses.ResponseInputItem[]))

    const incomplete = response.incomplete_details?.reason
    const stopReason = incomplete ? `incomplete:${incomplete}` : (response.status ?? "unknown")
    const finish = (endReason: EndReason): AgentOutcome => ({
      answer: session.answer,
      endReason,
      stopReason,
      model: response.model,
      usage: progress.usage,
      toolCalls: progress.toolCalls,
      sosumiCalls: progress.sosumiCalls,
      retries: progress.retries,
    })

    if (refused || incomplete === "content_filter") return finish("refusal")
    if (incomplete === "max_output_tokens") return finish("max_tokens")
    if (calls.length === 0) return finish("end_turn")

    for (const call of calls) {
      let args: unknown
      try {
        args = JSON.parse(call.arguments)
      } catch {
        args = null
      }
      const output = await session.handle(call.name, args, signal, trace)
      input.push({ type: "function_call_output", call_id: call.call_id, output: output.text })
      if (session.done) break
    }
    if (session.answer !== null) return finish("submitted")
    if (session.limitReached) return finish("tool_limit")
  }
}

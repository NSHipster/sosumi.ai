// Runs one case with a Claude model through the Messages API, with a manual tool loop.

import Anthropic from "@anthropic-ai/sdk"
import {
  type AgentContext,
  type AgentOutcome,
  assertModel,
  ContextOverflowError,
  type EndReason,
  NOT_RUN,
  recordRequest,
  retryAfterFromHeaders,
  SUBMIT_TOOL,
  withRetries,
} from "../agent.ts"

export interface AnthropicOptions {
  model: string
  effort: "low" | "medium" | "high" | "xhigh" | "max"
  maxTokens: number
}

export function anthropicClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error("Set ANTHROPIC_API_KEY to run an Anthropic model.")
  // The runner retries by itself, so that it can count and record each retry.
  return new Anthropic({ apiKey, maxRetries: 0 })
}

const retryPolicy = {
  isRetryable(error: unknown): boolean {
    if (error instanceof Anthropic.RateLimitError) return true
    if (error instanceof Anthropic.APIError) {
      const type = (error as { type?: string }).type
      return error.status === 529 || type === "overloaded_error"
    }
    return false
  },
  retryAfterMs: retryAfterFromHeaders,
}

export async function runAnthropic(
  client: Anthropic,
  options: AnthropicOptions,
  context: AgentContext,
): Promise<AgentOutcome> {
  const { progress, session, trace, signal } = context
  let tools: Anthropic.Tool[] = context.tools.map((tool, index) => ({
    name: tool.name,
    description: tool.description,
    input_schema: tool.inputSchema as Anthropic.Tool.InputSchema,
    ...(index === context.tools.length - 1
      ? { cache_control: { type: "ephemeral" as const } }
      : {}),
  }))
  const system: Anthropic.TextBlockParam[] = [
    { type: "text", text: context.system, cache_control: { type: "ephemeral" } },
  ]
  const messages: Anthropic.MessageParam[] = [{ role: "user", content: context.task }]
  const finish = (endReason: EndReason, stopReason: string): AgentOutcome => ({
    answer: session.answer,
    endReason,
    stopReason,
    model: progress.model ?? options.model,
    usage: progress.usage,
    toolCalls: progress.toolCalls,
    sosumiCalls: progress.sosumiCalls,
    retries: progress.retries,
    finalTurn: session.finalTurn,
  })
  // The final turn offers only submit_answer.
  const submitOnly = () =>
    tools
      .filter((tool) => tool.name === SUBMIT_TOOL.name)
      .map((tool) => ({ ...tool, cache_control: { type: "ephemeral" as const } }))

  while (true) {
    let response: Anthropic.Message
    try {
      response = await withRetries(
        () =>
          client.messages
            .stream(
              {
                model: options.model,
                max_tokens: options.maxTokens,
                system,
                tools,
                messages,
                thinking: { type: "adaptive", display: "summarized" },
                output_config: { effort: options.effort },
              },
              { signal },
            )
            .finalMessage(),
        retryPolicy,
        progress,
        signal,
      )
    } catch (error) {
      if (error instanceof ContextOverflowError)
        return finish("context_overflow", "context_overflow")
      throw error
    }

    progress.model = response.model
    const usage = response.usage
    recordRequest(progress, {
      input_tokens: usage.input_tokens,
      output_tokens: usage.output_tokens,
      cache_read_input_tokens: usage.cache_read_input_tokens ?? 0,
      cache_creation_input_tokens: usage.cache_creation_input_tokens ?? 0,
    })
    assertModel(options.model, response.model)

    let thinking = ""
    const calls: Anthropic.ToolUseBlock[] = []
    for (const block of response.content) {
      if (block.type === "thinking") {
        thinking += block.thinking
      } else if (block.type === "text" && block.text.trim()) {
        trace.push({ role: "assistant", content: block.text, ...(thinking ? { thinking } : {}) })
        thinking = ""
      } else if (block.type === "tool_use") {
        trace.push({
          role: "tool_call",
          name: block.name,
          content: JSON.stringify(block.input, null, 2),
          ...(thinking ? { thinking } : {}),
        })
        thinking = ""
        calls.push(block)
      }
    }
    if (thinking) trace.push({ role: "assistant", content: "", thinking })
    messages.push({ role: "assistant", content: response.content })

    const stopReason: string = response.stop_reason ?? "unknown"
    if (stopReason === "refusal") return finish("refusal", stopReason)
    if (stopReason === "max_tokens") return finish("max_tokens", stopReason)
    if (stopReason === "model_context_window_exceeded")
      return finish("context_overflow", stopReason)
    if (stopReason === "pause_turn") continue
    if (calls.length === 0) {
      if (session.finalTurn) return finish(session.finalTurnReason ?? "end_turn", stopReason)
      // The agent stopped without submitting: one final turn asks for the answer.
      const message = session.beginFinalTurn("end_turn")
      tools = submitOnly()
      trace.push({ role: "user", content: message })
      messages.push({ role: "user", content: message })
      continue
    }

    const results: Anthropic.ToolResultBlockParam[] = []
    for (const call of calls) {
      if (session.done && !session.finalTurn) {
        // Every tool_use block needs a result, even one that the limit kept from running.
        results.push({
          type: "tool_result",
          tool_use_id: call.id,
          content: NOT_RUN,
          is_error: true,
        })
        continue
      }
      const output = await session.handle(call.name, call.input, signal, trace)
      results.push({
        type: "tool_result",
        tool_use_id: call.id,
        content: output.text,
        ...(output.isError ? { is_error: true } : {}),
      })
      if (session.answer !== null) break
    }
    if (session.answer !== null) return finish("submitted", stopReason)
    if (session.finalTurn) return finish(session.finalTurnReason ?? "tool_limit", stopReason)
    if (session.limitReached) {
      // One final turn: only submit_answer is offered, and a message asks for the answer now.
      const message = session.beginFinalTurn("tool_limit")
      tools = submitOnly()
      trace.push({ role: "user", content: message })
      messages.push({ role: "user", content: [...results, { type: "text", text: message }] })
      continue
    }
    messages.push({ role: "user", content: results })
  }
}

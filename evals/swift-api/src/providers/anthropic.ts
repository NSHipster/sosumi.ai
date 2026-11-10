// Runs one case with a Claude model through the Messages API, with a manual tool loop.

import Anthropic from "@anthropic-ai/sdk"
import {
  type AgentContext,
  type AgentOutcome,
  assertModel,
  BLOCKED_DOMAINS,
  ContextOverflowError,
  type EndReason,
  NOT_RUN,
  recordRequest,
  retryAfterFromHeaders,
  SUBMIT_TOOL,
  type Turn,
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
  const clientTools: Anthropic.Tool[] = context.tools.map((tool, index) => ({
    name: tool.name,
    description: tool.description,
    input_schema: tool.inputSchema as Anthropic.Tool.InputSchema,
    ...(index === context.tools.length - 1
      ? { cache_control: { type: "ephemeral" as const } }
      : {}),
  }))
  // In the web condition, the server-side web tools come first. Each tool's max_uses is the
  // call budget left when the turn starts. The API counts uses across every request in a turn
  // (pause_turn resumes included), so the value stays the same for the whole turn and the tool
  // list keeps its cache prefix. The API has no limit across both tools together.
  let tools: Anthropic.ToolUnion[] = [
    ...(context.condition === "web" ? webTools(session.remaining) : []),
    ...clientTools,
  ]
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
  const submitOnly = (): Anthropic.ToolUnion[] =>
    clientTools
      .filter((tool) => tool.name === SUBMIT_TOOL.name)
      .map((tool) => ({ ...tool, cache_control: { type: "ephemeral" as const } }))
  let pauses = 0

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
    // Searches and fetches the server ran in this request, including ones run from code
    // execution through dynamic filtering, which have no direct block of their own.
    session.recordServerCalls(
      usage.server_tool_use?.web_search_requests ?? 0,
      usage.server_tool_use?.web_fetch_requests ?? 0,
    )

    let thinking = ""
    const calls: Anthropic.ToolUseBlock[] = []
    for (const block of response.content) {
      if (block.type === "thinking") {
        thinking += block.thinking
      } else if (block.type === "text") {
        session.noteWebEvidence(
          (block.citations ?? []).map((citation) => ("url" in citation ? citation.url : null)),
        )
        if (block.text.trim()) {
          trace.push({ role: "assistant", content: block.text, ...(thinking ? { thinking } : {}) })
          thinking = ""
        }
      } else if (traceServerBlock(block, trace, session, thinking)) {
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
    if (stopReason === "pause_turn") {
      // The server paused its own tool loop. Sending the assistant content back unchanged,
      // with the same tools, resumes it.
      if (++pauses > MAX_PAUSE_RESUMES) return finish("end_turn", stopReason)
      continue
    }
    if (calls.length === 0) {
      if (session.finalTurn) return finish(session.finalTurnReason ?? "end_turn", stopReason)
      // The agent stopped without submitting: one final turn asks for the answer.
      const message = session.beginFinalTurn(session.limitReached ? "tool_limit" : "end_turn")
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

/** pause_turn resumes allowed in one attempt, so that a server loop cannot run forever. */
const MAX_PAUSE_RESUMES = 10

/** The server-side web tools, each limited to `budget` uses in a turn and blocked from Sosumi. */
export function webTools(budget: number): Anthropic.ToolUnion[] {
  return [
    {
      type: "web_search_20260209",
      name: "web_search",
      blocked_domains: BLOCKED_DOMAINS,
      max_uses: budget,
    },
    {
      type: "web_fetch_20260209",
      name: "web_fetch",
      blocked_domains: BLOCKED_DOMAINS,
      max_uses: budget,
    },
  ]
}

/**
 * Records a server tool block in the trace (each query, each result's title and URL, each
 * fetched URL) and notes possible leaks. Returns false for any other block.
 */
function traceServerBlock(
  block: Anthropic.ContentBlock,
  trace: Turn[],
  session: AgentContext["session"],
  thinking: string,
): boolean {
  const viaCode = (block as { caller?: { type?: string } }).caller?.type?.startsWith(
    "code_execution",
  )
  const note = viaCode ? " (from code execution)" : ""
  if (block.type === "server_tool_use") {
    const input = block.input as { query?: string; url?: string; code?: string; command?: string }
    session.noteWebEvidence([input.query, input.url])
    trace.push({
      role: "tool_call",
      name: `${block.name}${note}`,
      content: JSON.stringify(block.input, null, 2),
      ...(thinking ? { thinking } : {}),
    })
    return true
  }
  if (block.type === "web_search_tool_result") {
    const content = block.content
    if (Array.isArray(content)) {
      session.noteWebEvidence(content.map((result) => result.url))
      trace.push({
        role: "tool_result",
        name: `web_search${note}`,
        content:
          content.map((result) => `- ${result.title}: ${result.url}`).join("\n") || "No results.",
      })
    } else {
      trace.push({
        role: "tool_result",
        name: `web_search${note}`,
        content: `Error: ${content.error_code}`,
      })
    }
    return true
  }
  if (block.type === "web_fetch_tool_result") {
    const content = block.content as {
      type: string
      url?: string
      error_code?: string
      content?: { title?: string | null; source?: { data?: string } }
    }
    if (content.type === "web_fetch_result") {
      session.noteWebEvidence([content.url])
      const length = content.content?.source?.data?.length
      trace.push({
        role: "tool_result",
        name: `web_fetch${note}`,
        content:
          `Fetched ${content.url}` +
          `${content.content?.title ? ` (${content.content.title})` : ""}` +
          `${length !== undefined ? `, ${length.toLocaleString("en-US")} characters` : ""}`,
      })
    } else {
      trace.push({
        role: "tool_result",
        name: `web_fetch${note}`,
        content: `Error: ${content.error_code}`,
      })
    }
    return true
  }
  if (
    block.type === "code_execution_tool_result" ||
    block.type === "bash_code_execution_tool_result" ||
    block.type === "text_editor_code_execution_tool_result"
  ) {
    const content = block.content as { stdout?: string; stderr?: string; return_code?: number }
    const output = [content.stdout, content.stderr].filter(Boolean).join("\n").slice(0, 4_000)
    trace.push({
      role: "tool_result",
      name: block.type,
      content: output || JSON.stringify(content).slice(0, 4_000),
    })
    return true
  }
  return false
}

// Runs one case with an OpenAI model through the Responses API, with function tools.

import OpenAI from "openai"
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
  const functionTools: OpenAI.Responses.FunctionTool[] = context.tools.map((tool) => ({
    type: "function",
    name: tool.name,
    description: tool.description,
    parameters: tool.inputSchema,
    strict: false,
  }))
  const web = context.condition === "web"
  let tools: OpenAI.Responses.Tool[] = [...(web ? [webSearchTool()] : []), ...functionTools]
  const input: OpenAI.Responses.ResponseInputItem[] = [{ role: "user", content: context.task }]
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

  while (true) {
    let response: OpenAI.Responses.Response
    try {
      response = await withRetries(
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
              include: web
                ? ["reasoning.encrypted_content", "web_search_call.action.sources"]
                : ["reasoning.encrypted_content"],
              // Built-in tool calls in one response cannot pass the budget that is left.
              ...(web && !session.finalTurn ? { max_tool_calls: session.remaining } : {}),
            },
            { signal },
          ),
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
    let searches = 0
    let pageActions = 0
    for (const item of response.output) {
      if (item.type === "web_search_call") {
        // A search is billed; opening a page or finding in a page is not, but each is a call.
        const action = item.action as {
          type: string
          query?: string
          queries?: string[]
          url?: string | null
          pattern?: string
          sources?: { url?: string }[]
        }
        if (action.type === "search") searches++
        else pageActions++
        const queries = action.queries ?? (action.query ? [action.query] : [])
        const sources = (action.sources ?? []).map((source) => source.url)
        session.noteWebEvidence([...queries, action.url, ...sources])
        trace.push({
          role: "tool_call",
          name: `web_search.${action.type}`,
          content: JSON.stringify(
            {
              queries: queries.length > 0 ? queries : undefined,
              url: action.url,
              pattern: action.pattern,
            },
            null,
            2,
          ),
          ...(thinking ? { thinking } : {}),
        })
        thinking = ""
        trace.push({
          role: "tool_result",
          name: `web_search.${action.type}`,
          content:
            sources.length > 0
              ? sources.map((url) => `- ${url}`).join("\n")
              : `Status: ${item.status}${action.url ? `, ${action.url}` : ""}`,
        })
      } else if (item.type === "reasoning") {
        thinking += (item.summary ?? []).map((part) => part.text).join("\n")
      } else if (item.type === "message") {
        for (const part of item.content) {
          if (part.type === "output_text") {
            session.noteWebEvidence(
              (part.annotations ?? []).map((annotation) =>
                annotation.type === "url_citation" ? annotation.url : null,
              ),
            )
          }
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
    session.recordServerCalls(searches, pageActions)
    input.push(...(response.output as OpenAI.Responses.ResponseInputItem[]))

    const incomplete = response.incomplete_details?.reason
    const stopReason = incomplete ? `incomplete:${incomplete}` : (response.status ?? "unknown")
    if (refused || incomplete === "content_filter") return finish("refusal", stopReason)
    if (incomplete === "max_output_tokens") return finish("max_tokens", stopReason)
    if (calls.length === 0) {
      if (session.finalTurn) return finish(session.finalTurnReason ?? "end_turn", stopReason)
      // The agent stopped without submitting: one final turn asks for the answer.
      const message = session.beginFinalTurn(session.limitReached ? "tool_limit" : "end_turn")
      tools = functionTools.filter((tool) => tool.name === SUBMIT_TOOL.name)
      trace.push({ role: "user", content: message })
      input.push({ role: "user", content: message })
      continue
    }

    for (const call of calls) {
      let args: unknown
      try {
        args = JSON.parse(call.arguments)
      } catch {
        args = null
      }
      if (session.done && !session.finalTurn) {
        // Every function call needs an output, even one that the limit kept from running.
        input.push({ type: "function_call_output", call_id: call.call_id, output: NOT_RUN })
        continue
      }
      const output = await session.handle(call.name, args, signal, trace)
      input.push({ type: "function_call_output", call_id: call.call_id, output: output.text })
      if (session.answer !== null) break
    }
    if (session.answer !== null) return finish("submitted", stopReason)
    if (session.finalTurn) return finish(session.finalTurnReason ?? "tool_limit", stopReason)
    if (session.limitReached) {
      // One final turn: only submit_answer is offered, and a message asks for the answer now.
      const message = session.beginFinalTurn("tool_limit")
      tools = functionTools.filter((tool) => tool.name === SUBMIT_TOOL.name)
      trace.push({ role: "user", content: message })
      input.push({ role: "user", content: message })
    }
  }
}

/**
 * The built-in web search tool, told to skip Sosumi. The installed SDK types list only
 * allowed_domains in filters; OpenAI's web search guide documents blocked_domains as well.
 */
export function webSearchTool(): OpenAI.Responses.Tool {
  return {
    type: "web_search",
    filters: { blocked_domains: BLOCKED_DOMAINS },
  } as unknown as OpenAI.Responses.Tool
}

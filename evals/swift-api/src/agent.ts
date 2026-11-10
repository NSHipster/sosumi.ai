// Pieces that every provider's agent loop shares:
// the prompt, the tools, the tool-call budget, retries, and the attempt result.

import { SosumiServerError, type ToolOutput, type ToolSpec } from "./sosumi.ts"

/**
 * sosumi: Sosumi's MCP tools. none: no documentation tools.
 * web: the provider's built-in web search and fetch tools.
 */
export type Condition = "sosumi" | "none" | "web"

export const CONDITIONS: Condition[] = ["sosumi", "none", "web"]

/**
 * A web result that could carry the eval's answers: Sosumi itself, or the repository
 * that holds the reference answers (github.com/NSHipster/sosumi.ai), which contains "sosumi.ai".
 */
export const LEAK_PATTERN = /sosumi\.ai/i

/** The domains that the web tools are told to skip. */
export const BLOCKED_DOMAINS = ["sosumi.ai"]

export const SUBMIT_TOOL: ToolSpec = {
  name: "submit_answer",
  description:
    "Submit your answer: one complete Swift source file, including its import statements. " +
    "Calling this tool ends the task.",
  inputSchema: {
    type: "object",
    properties: {
      code: { type: "string", description: "The complete contents of one Swift source file." },
    },
    required: ["code"],
    additionalProperties: false,
  },
}

export function systemPrompt(condition: Condition, maxToolCalls: number): string {
  const tools = {
    sosumi: "You can use the documentation tools to read Apple's developer documentation.",
    none: "No documentation tools are available.",
    web: "You can use web search and web fetch to find and read pages on the web.",
  }[condition]
  return [
    "You write Swift code for Apple platforms.",
    "The user gives you a programming task.",
    "You cannot compile or run code, and you cannot read or write files.",
    tools,
    "The grader compiles your file together with a check file that uses the declarations " +
      "the task asks for, in the Swift language mode that the task states.",
    "Do not redeclare any type that the task says is already declared.",
    `You can make at most ${maxToolCalls} tool calls in total, including submit_answer.`,
    "When you are ready, call submit_answer once with one complete Swift source file.",
  ].join(" ")
}

/** One entry of a trace file, in the shape of the hillclimb report's Turn. */
export interface Turn {
  role: "system" | "user" | "assistant" | "tool_call" | "tool_result"
  content: string
  name?: string
  thinking?: string
}

export interface Usage {
  input_tokens: number
  output_tokens: number
  cache_read_input_tokens: number
  cache_creation_input_tokens: number
  reasoning_tokens?: number
}

/** Adds one request's usage to the attempt's totals and keeps it for pricing. */
export function recordRequest(progress: AttemptProgress, usage: Usage): void {
  progress.requests.push(usage)
  progress.usage.input_tokens += usage.input_tokens
  progress.usage.output_tokens += usage.output_tokens
  progress.usage.cache_read_input_tokens += usage.cache_read_input_tokens
  progress.usage.cache_creation_input_tokens += usage.cache_creation_input_tokens
  if (usage.reasoning_tokens !== undefined) {
    progress.usage.reasoning_tokens =
      (progress.usage.reasoning_tokens ?? 0) + usage.reasoning_tokens
  }
}

export function emptyUsage(): Usage {
  return {
    input_tokens: 0,
    output_tokens: 0,
    cache_read_input_tokens: 0,
    cache_creation_input_tokens: 0,
  }
}

/** Why the agent loop ended. */
export type EndReason =
  | "submitted"
  | "end_turn"
  | "tool_limit"
  | "refusal"
  | "max_tokens"
  | "context_overflow"

/** Tool results longer than this many characters are cut, in every condition and provider. */
export const TOOL_RESULT_LIMIT = 100_000

/** Cuts a tool result at TOOL_RESULT_LIMIT characters and says so at the end. */
export function cutToolResult(text: string): { text: string; cut: boolean } {
  if (text.length <= TOOL_RESULT_LIMIT) return { text, cut: false }
  const note =
    `[This result was cut at ${TOOL_RESULT_LIMIT.toLocaleString("en-US")} characters; ` +
    `the full result has ${text.length.toLocaleString("en-US")} characters.]`
  return { text: `${text.slice(0, TOOL_RESULT_LIMIT)}\n\n${note}`, cut: true }
}

/** A request failed because the prompt is longer than the model's context window. */
export class ContextOverflowError extends Error {
  override name = "ContextOverflowError"
}

/** True for a provider's error that says the prompt exceeds the context window. */
export function isContextOverflow(error: unknown): boolean {
  const e = error as { status?: number; message?: string; code?: string; error?: { code?: string } }
  if (e?.status !== 400) return false
  if (e.code === "context_length_exceeded" || e.error?.code === "context_length_exceeded")
    return true
  return /prompt is too long|context length|context window|maximum context/i.test(e.message ?? "")
}

export interface AgentOutcome {
  answer: string | null
  endReason: EndReason
  stopReason: string
  model: string
  usage: Usage
  toolCalls: number
  sosumiCalls: number
  retries: number
  /** The agent stopped without submitting and was given one final turn to submit. */
  finalTurn: boolean
}

/** What a provider's loop records as it runs, so that a failed attempt keeps its spend. */
export interface AttemptProgress {
  model: string | null
  usage: Usage
  /** The usage of each model request, for prices that depend on the size of one request. */
  requests: Usage[]
  retries: number
  toolCalls: number
  sosumiCalls: number
  /** Tool results cut at TOOL_RESULT_LIMIT characters. */
  cutResults: number
  /** Server-side web searches, counted toward the tool-call limit. */
  webSearches: number
  /** Server-side page fetches (and, for OpenAI, other page actions), counted toward the limit. */
  webFetches: number
  /** Search queries and URLs from web tools that match LEAK_PATTERN. */
  leaks: string[]
}

export type FailureClass =
  | "timeout"
  | "api_error"
  | "model_mismatch"
  | "tool_error"
  | "sosumi_server"
  | "grader_error"
  | "harness_error"

/** An attempt that produced no scorable answer. */
export class AttemptError extends Error {
  readonly failureClass: FailureClass
  constructor(failureClass: FailureClass, message: string, options?: { cause?: unknown }) {
    super(message, options)
    this.failureClass = failureClass
  }
}

/** Fails the attempt when the served model is not the requested one. */
export function assertModel(requested: string, served: string): void {
  // Allow only the documented alias-to-snapshot form: the requested ID plus a date suffix.
  const snapshot = new RegExp(
    `^${requested.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}-\\d{4}-?\\d{2}-?\\d{2}$`,
  )
  if (served !== requested && !snapshot.test(served)) {
    throw new AttemptError(
      "model_mismatch",
      `Requested ${requested}, but the response came from ${served}`,
    )
  }
}

export interface AgentContext {
  condition: Condition
  system: string
  task: string
  tools: ToolSpec[]
  signal: AbortSignal
  trace: Turn[]
  progress: AttemptProgress
  session: ToolSession
}

/**
 * Runs the tools that the model calls, counts calls against the budget,
 * and records the submitted answer.
 */
/** The result for a tool call that was not run, because the limit was reached first. */
export const NOT_RUN = "This call was not run, because the tool-call limit was reached."

export class ToolSession {
  answer: string | null = null
  limitReached = false
  /** True during the one final turn in which only submit_answer is offered. */
  finalTurn = false
  /** Why the final turn was given: the call limit, or a turn that ended without a submission. */
  finalTurnReason: "tool_limit" | "end_turn" | null = null
  private readonly sosumiTools: Set<string>
  private readonly progress: AttemptProgress
  private readonly maxToolCalls: number
  private readonly callSosumi: (
    name: string,
    args: unknown,
    signal: AbortSignal,
  ) => Promise<ToolOutput>

  constructor(options: {
    sosumiTools: string[]
    progress: AttemptProgress
    maxToolCalls: number
    callSosumi: (name: string, args: unknown, signal: AbortSignal) => Promise<ToolOutput>
  }) {
    this.sosumiTools = new Set(options.sosumiTools)
    this.progress = options.progress
    this.maxToolCalls = options.maxToolCalls
    this.callSosumi = options.callSosumi
  }

  /** Tool calls left under the limit. */
  get remaining(): number {
    return Math.max(0, this.maxToolCalls - this.progress.toolCalls)
  }

  /**
   * Counts web searches and fetches that the provider ran server-side.
   * They count toward the limit like any other tool call.
   */
  recordServerCalls(searches: number, fetches: number): void {
    this.progress.toolCalls += searches + fetches
    this.progress.webSearches += searches
    this.progress.webFetches += fetches
    if (this.answer === null && !this.finalTurn && this.remaining <= 0) this.limitReached = true
  }

  /** Records any search query, result URL, fetched URL, or cited URL that could leak answers. */
  noteWebEvidence(values: (string | null | undefined)[]): void {
    for (const value of values) {
      if (value && LEAK_PATTERN.test(value) && !this.progress.leaks.includes(value)) {
        this.progress.leaks.push(value)
      }
    }
  }

  get done(): boolean {
    return this.answer !== null || this.limitReached
  }

  /**
   * Starts the final turn, after the call limit or after a turn that ended without
   * a submission: the provider offers only submit_answer and sends the returned message.
   */
  beginFinalTurn(reason: "tool_limit" | "end_turn"): string {
    this.finalTurn = true
    this.finalTurnReason = reason
    const why =
      reason === "tool_limit"
        ? `You have used all ${this.maxToolCalls} tool calls. `
        : "You ended your turn without calling submit_answer. "
    return (
      why +
      "submit_answer is now the only tool. " +
      "Call submit_answer now with your best answer as one complete Swift source file."
    )
  }

  async handle(
    name: string,
    args: unknown,
    signal: AbortSignal,
    trace: Turn[],
  ): Promise<ToolOutput> {
    this.progress.toolCalls++
    let output: ToolOutput
    if (name === SUBMIT_TOOL.name) {
      const code = (args as { code?: unknown } | null)?.code
      if (typeof code === "string") {
        this.answer = code
        output = { text: "Answer received.", isError: false }
      } else {
        output = { text: "submit_answer requires a string argument named code.", isError: true }
      }
    } else if (this.finalTurn) {
      output = { text: "Only submit_answer is available now.", isError: true }
    } else if (this.sosumiTools.has(name)) {
      this.progress.sosumiCalls++
      try {
        output = await this.callSosumi(name, args, signal)
      } catch (error) {
        if (signal.aborted) throw error
        if (error instanceof SosumiServerError) {
          // The server failed, not the tool: the runner retries the attempt.
          throw new AttemptError("sosumi_server", error.message, { cause: error })
        }
        throw new AttemptError("tool_error", `Sosumi tool ${name} failed: ${String(error)}`, {
          cause: error,
        })
      }
    } else {
      output = { text: `There is no tool named ${name}.`, isError: true }
    }
    const limited = cutToolResult(output.text)
    if (limited.cut) this.progress.cutResults++
    output = { ...output, text: limited.text }
    trace.push({ role: "tool_result", name, content: output.text })

    if (this.answer === null && !this.finalTurn) {
      const remaining = this.maxToolCalls - this.progress.toolCalls
      if (remaining <= 0) {
        this.limitReached = true
      } else if (remaining <= 2) {
        const note = `You have ${remaining} tool call${remaining === 1 ? "" : "s"} left, including submit_answer.`
        output = { ...output, text: `${output.text}\n\n${note}` }
      }
    }
    return output
  }
}

export interface RetryPolicy {
  isRetryable(error: unknown): boolean
  retryAfterMs?(error: unknown): number | undefined
}

/** Retries `operation` with jittered exponential backoff, counting each retry. */
export async function withRetries<T>(
  operation: () => Promise<T>,
  policy: RetryPolicy,
  progress: AttemptProgress,
  signal: AbortSignal,
  maxRetries = 6,
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await operation()
    } catch (error) {
      if (signal.aborted) throw error
      if (isContextOverflow(error))
        throw new ContextOverflowError(describeError(error), { cause: error })
      if (attempt >= maxRetries || !policy.isRetryable(error)) {
        if (error instanceof AttemptError) throw error
        throw new AttemptError("api_error", describeError(error), { cause: error })
      }
      progress.retries++
      const base = Math.min(60_000, 1_000 * 2 ** attempt)
      const hinted = policy.retryAfterMs?.(error)
      const delay = Math.max(hinted ?? 0, base * (0.5 + Math.random()))
      await sleep(delay, signal)
    }
  }
}

export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolvePromise, rejectPromise) => {
    if (signal?.aborted) {
      rejectPromise(signal.reason)
      return
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort)
      resolvePromise()
    }, ms)
    const onAbort = () => {
      clearTimeout(timer)
      rejectPromise(signal?.reason)
    }
    signal?.addEventListener("abort", onAbort, { once: true })
  })
}

export function describeError(error: unknown): string {
  if (error instanceof Error) return `${error.name}: ${error.message}`
  return String(error)
}

/** Reads a Retry-After header in seconds, if the error carries one. */
export function retryAfterFromHeaders(error: unknown): number | undefined {
  const headers = (error as { headers?: Headers | Record<string, string> } | null)?.headers
  if (!headers) return undefined
  const value =
    typeof (headers as Headers).get === "function"
      ? (headers as Headers).get("retry-after")
      : (headers as Record<string, string>)["retry-after"]
  const seconds = value ? Number(value) : Number.NaN
  return Number.isFinite(seconds) ? seconds * 1_000 : undefined
}

// Pieces that every provider's agent loop shares:
// the prompt, the tools, the tool-call budget, retries, and the attempt result.

import type { ToolOutput, ToolSpec } from "./sosumi.ts"

export type Condition = "sosumi" | "none"

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
  const tools =
    condition === "sosumi"
      ? "You can use the documentation tools to read Apple's developer documentation."
      : "No documentation tools are available."
  return [
    "You write Swift code for Apple platforms.",
    "The user gives you a programming task.",
    "You cannot compile or run code, and you cannot read or write files.",
    tools,
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
export type EndReason = "submitted" | "end_turn" | "tool_limit" | "refusal" | "max_tokens"

export interface AgentOutcome {
  answer: string | null
  endReason: EndReason
  stopReason: string
  model: string
  usage: Usage
  toolCalls: number
  sosumiCalls: number
  retries: number
  /** The agent reached the tool-call limit and was given one final turn to submit. */
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
}

export type FailureClass =
  | "timeout"
  | "api_error"
  | "model_mismatch"
  | "tool_error"
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
  /** True after the limit, during the one final turn in which only submit_answer is offered. */
  finalTurn = false
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

  get done(): boolean {
    return this.answer !== null || this.limitReached
  }

  /**
   * Starts the final turn after the limit: the provider offers only submit_answer
   * and sends the returned message to the agent.
   */
  beginFinalTurn(): string {
    this.finalTurn = true
    return (
      `You have used all ${this.maxToolCalls} tool calls. ` +
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
        throw new AttemptError("tool_error", `Sosumi tool ${name} failed: ${String(error)}`, {
          cause: error,
        })
      }
    } else {
      output = { text: `There is no tool named ${name}.`, isError: true }
    }
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

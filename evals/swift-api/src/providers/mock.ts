// A provider that makes no model call, so that the whole pipeline can be tested for free.
//
// It submits reference.swift, stale.swift, stub.swift, or an empty file.
// In the sosumi condition it first calls one Sosumi tool on the local server.
// It can also fail on purpose, to test how the runner records failures.

import { readFile } from "node:fs/promises"
import { join } from "node:path"
import {
  type AgentContext,
  type AgentOutcome,
  assertModel,
  ContextOverflowError,
  withRetries,
} from "../agent.ts"

export type MockAnswer = "reference" | "stale" | "stub" | "empty"
/** kill-server and server-error-once are handled by the runner, around the Sosumi calls. */
export type MockFailure =
  | "none"
  | "error"
  | "timeout"
  | "rate-limit-once"
  | "mismatch"
  | "kill-server"
  | "server-error-once"
  | "context-overflow"
/**
 * submit: submit after at most one Sosumi call.
 * exhaust: use every tool call without submitting, then submit in the final turn.
 * exhaust-no-submit: use every tool call, and do not submit in the final turn either.
 */
export type MockBehavior =
  | "submit"
  | "exhaust"
  | "exhaust-no-submit"
  | "end-turn"
  | "end-turn-no-submit"

export interface MockOptions {
  answer: MockAnswer
  failure: MockFailure
  behavior: MockBehavior
  caseDir: string
  docsPath: string
}

class MockRateLimitError extends Error {
  override name = "MockRateLimitError"
}

class MockServerError extends Error {
  override name = "MockServerError"
}

export function mockModelID(answer: MockAnswer): string {
  return `mock-${answer}`
}

export async function runMock(options: MockOptions, context: AgentContext): Promise<AgentOutcome> {
  const { progress, session, trace, signal } = context
  const model = mockModelID(options.answer)
  let rateLimited = false

  const respond = async (): Promise<string> => {
    if (options.failure === "error") throw new MockServerError("Induced provider error")
    if (options.failure === "context-overflow") {
      // The shape of the Messages API's 400 for a prompt longer than the context window.
      throw Object.assign(new Error("400 prompt is too long: 1453316 tokens > 1000000 maximum"), {
        status: 400,
      })
    }
    if (options.failure === "rate-limit-once" && !rateLimited) {
      rateLimited = true
      throw new MockRateLimitError("Induced rate limit")
    }
    if (options.failure === "timeout") {
      await new Promise((_, rejectPromise) => {
        signal.addEventListener("abort", () => rejectPromise(signal.reason), { once: true })
      })
    }
    return options.failure === "mismatch" ? "mock-other-model" : model
  }
  const policy = { isRetryable: (error: unknown) => error instanceof MockRateLimitError }

  let served: string
  try {
    served = await withRetries(respond, policy, progress, signal)
  } catch (error) {
    if (!(error instanceof ContextOverflowError)) throw error
    return {
      answer: null,
      endReason: "context_overflow",
      stopReason: "context_overflow",
      model,
      usage: progress.usage,
      toolCalls: progress.toolCalls,
      sosumiCalls: progress.sosumiCalls,
      retries: progress.retries,
      finalTurn: false,
    }
  }
  progress.model = served
  assertModel(model, served)

  // Behaviors that end without a submission get the final submit-only turn, as the providers give it.
  let finalReason: "tool_limit" | "end_turn" | null = null
  if (options.behavior.startsWith("exhaust")) {
    // Spend the whole budget on documentation calls. In the none condition the tool
    // does not exist, so each call returns an error but still counts.
    const args = { path: options.docsPath }
    while (!session.limitReached) {
      trace.push({
        role: "tool_call",
        name: "fetchAppleDocumentation",
        content: JSON.stringify(args, null, 2),
      })
      await session.handle("fetchAppleDocumentation", args, signal, trace)
    }
    finalReason = "tool_limit"
  } else if (options.behavior.startsWith("end-turn")) {
    trace.push({ role: "assistant", content: "Here is my plan for the answer." })
    finalReason = "end_turn"
  } else if (context.condition === "sosumi") {
    const args = { path: options.docsPath }
    trace.push({
      role: "tool_call",
      name: "fetchAppleDocumentation",
      content: JSON.stringify(args, null, 2),
    })
    await session.handle("fetchAppleDocumentation", args, signal, trace)
  }

  if (finalReason) {
    const message = session.beginFinalTurn(finalReason)
    trace.push({ role: "user", content: message })
    if (options.behavior.endsWith("no-submit")) {
      trace.push({ role: "assistant", content: "I am not ready to answer." })
      return {
        answer: null,
        endReason: finalReason,
        stopReason: "end_turn",
        model: served,
        usage: progress.usage,
        toolCalls: progress.toolCalls,
        sosumiCalls: progress.sosumiCalls,
        retries: progress.retries,
        finalTurn: true,
      }
    }
  }

  const code =
    options.answer === "empty"
      ? ""
      : await readFile(join(options.caseDir, `${options.answer}.swift`), "utf8")
  trace.push({
    role: "tool_call",
    name: "submit_answer",
    content: JSON.stringify({ code }, null, 2),
  })
  await session.handle("submit_answer", { code }, signal, trace)

  return {
    answer: session.answer,
    endReason: "submitted",
    stopReason: "tool_use",
    model: served,
    usage: progress.usage,
    toolCalls: progress.toolCalls,
    sosumiCalls: progress.sosumiCalls,
    retries: progress.retries,
    finalTurn: session.finalTurn,
  }
}

// A provider that makes no model call, so that the whole pipeline can be tested for free.
//
// It submits reference.swift, stale.swift, stub.swift, or an empty file.
// In the sosumi condition it first calls one Sosumi tool on the local server.
// It can also fail on purpose, to test how the runner records failures.

import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { type AgentContext, type AgentOutcome, assertModel, withRetries } from "../agent.ts"

export type MockAnswer = "reference" | "stale" | "stub" | "empty"
export type MockFailure = "none" | "error" | "timeout" | "rate-limit-once" | "mismatch"

export interface MockOptions {
  answer: MockAnswer
  failure: MockFailure
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

  const served = await withRetries(respond, policy, progress, signal)
  progress.model = served
  assertModel(model, served)

  if (context.condition === "sosumi") {
    const args = { path: options.docsPath }
    trace.push({
      role: "tool_call",
      name: "fetchAppleDocumentation",
      content: JSON.stringify(args, null, 2),
    })
    await session.handle("fetchAppleDocumentation", args, signal, trace)
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
  }
}

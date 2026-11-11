/**
 * Logging for failures at the boundaries that handle them:
 * `app.onError` for HTTP routes and the MCP tool handlers.
 * Each failure is logged once, by its boundary, so the helpers that fetch
 * from Apple or from external hosts do not log the errors that they throw.
 */

import { HTTPException } from "hono/http-exception"

import { ExternalAccessError } from "./external/policy"
import { NotFoundError, UpstreamNotFoundError } from "./fetch"
import { TranscriptNotFoundError } from "./video"

/**
 * Whether an error is caused by the request rather than by Sosumi or an upstream host.
 */
export function isClientError(error: unknown): boolean {
  if (error instanceof HTTPException || error instanceof ExternalAccessError) {
    return error.status < 500
  }
  if (error instanceof UpstreamNotFoundError) {
    return false
  }
  return error instanceof NotFoundError || error instanceof TranscriptNotFoundError
}

/**
 * Log a client error with `console.warn` and every other error with `console.error`.
 */
export function logError(error: unknown): void {
  if (isClientError(error)) {
    console.warn("Client error occurred:", error)
  } else {
    console.error("Error occurred:", error)
  }
}

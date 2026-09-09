import { z } from "zod"
import { resolveFetchEndpoint, resolveSearchEndpoint } from "./cli-endpoints"
import { MCP_SERVER_INFO, TOOL_DEFINITIONS } from "./mcp"

/**
 * The A2A protocol version each interface exposes, as `major.minor`.
 * See https://a2a-protocol.org/latest/specification/
 */
export const A2A_PROTOCOL_VERSION = "1.0"

/** The HTTP+JSON media type registered by the A2A specification. */
export const A2A_MEDIA_TYPE = "application/a2a+json"

/** The synchronous HTTP+JSON operation exposed by Sosumi. */
export const A2A_MESSAGE_PATH = "/message:send"

/** The media type returned by every Sosumi A2A skill. */
export const A2A_OUTPUT_MEDIA_TYPE = "text/markdown"

/** Maximum wire size accepted for an unauthenticated A2A request body. */
export const A2A_MAX_REQUEST_BYTES = 32 * 1024

/** Maximum capability output that can be safely wrapped in an A2A JSON response. */
export const A2A_MAX_RESPONSE_BYTES = 8 * 1024 * 1024

/**
 * The transport binding advertised for the agent's interface.
 * Sosumi exposes its documentation service over plain HTTP requests,
 * so the `HTTP+JSON` binding is the closest of A2A's officially supported bindings.
 */
const TRANSPORT = "HTTP+JSON"

const AGENT_DESCRIPTION =
  "Making Apple docs AI-readable. " +
  "Sosumi converts Apple Developer documentation, Human Interface Guidelines, " +
  "WWDC session transcripts, and public Swift-DocC sites " +
  "into clean Markdown for AI agents."

/** Keyword tags describing each skill's capabilities. */
const SKILL_TAGS: Record<string, string[]> = {
  searchAppleDocumentation: ["apple", "search", "documentation"],
  fetchAppleDocumentation: ["apple", "documentation", "markdown", "hig"],
  fetchExternalDocumentation: ["swift-docc", "documentation", "markdown"],
  fetchAppleVideoTranscript: ["apple", "wwdc", "video", "transcript"],
}

/** Example prompts illustrating how each skill is used. */
const SKILL_EXAMPLES: Record<string, string[]> = {
  searchAppleDocumentation: ["Search Apple documentation for URLSession"],
  fetchAppleDocumentation: ["Fetch /documentation/swiftui/view as Markdown"],
  fetchExternalDocumentation: [
    "Fetch https://apple.github.io/swift-argument-parser/documentation/argumentparser",
  ],
  fetchAppleVideoTranscript: ["Fetch the transcript for /videos/play/wwdc2021/10133"],
}

interface AgentInterface {
  url: string
  /** The A2A protocol version this interface exposes. */
  protocolVersion: string
  /** Transport binding. Named `protocolBinding` by the current A2A proto schema. */
  protocolBinding: string
}

/**
 * Build an A2A Agent Card for the given origin.
 * Conforms to the A2A Agent Card schema for agent-to-agent discovery.
 * https://a2a-protocol.org/latest/topics/agent-discovery/
 */
export function buildAgentCard(origin: string) {
  const service: AgentInterface = {
    url: origin,
    protocolVersion: A2A_PROTOCOL_VERSION,
    protocolBinding: TRANSPORT,
  }

  const skills = Object.values(TOOL_DEFINITIONS).map((def) => ({
    // Convert the camelCase tool name to a kebab-case skill id.
    id: def.name.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase(),
    name: def.title,
    description: def.description,
    tags: SKILL_TAGS[def.name] ?? ["apple", "documentation"],
    examples: SKILL_EXAMPLES[def.name],
  }))

  return {
    name: MCP_SERVER_INFO.name,
    description: AGENT_DESCRIPTION,
    version: MCP_SERVER_INFO.version,
    supportedInterfaces: [service],
    provider: {
      organization: "NSHipster",
      url: origin,
    },
    documentationUrl: `${origin}/SKILL.md`,
    capabilities: {
      streaming: false,
      pushNotifications: false,
    },
    defaultInputModes: ["text/plain"],
    defaultOutputModes: [A2A_OUTPUT_MEDIA_TYPE],
    skills,
  }
}

type A2AHttpStatus = 400 | 403 | 404 | 413 | 500 | 503

const metadataSchema = z.record(z.unknown())

const authenticationInfoSchema = z
  .object({
    scheme: z.string().min(1),
    credentials: z.string().optional(),
  })
  .strict()

const taskPushNotificationConfigSchema = z
  .object({
    tenant: z.string().optional(),
    id: z.string().optional(),
    taskId: z.string().optional(),
    url: z.string().url(),
    token: z.string().optional(),
    authentication: authenticationInfoSchema.optional(),
  })
  .strict()

const sendMessageConfigurationSchema = z
  .object({
    acceptedOutputModes: z.array(z.string()).optional(),
    taskPushNotificationConfig: taskPushNotificationConfigSchema.optional(),
    historyLength: z.number().int().nonnegative().optional(),
    returnImmediately: z.boolean().optional(),
  })
  .strict()

const partSchema = z
  .object({
    text: z.string().optional(),
    raw: z.string().optional(),
    url: z.string().optional(),
    data: z.unknown().optional(),
    metadata: metadataSchema.optional(),
    filename: z.string().optional(),
    mediaType: z.string().min(1).optional(),
  })
  .strict()

const messageSchema = z
  .object({
    messageId: z.string().min(1),
    contextId: z.string().min(1).optional(),
    taskId: z.string().min(1).optional(),
    role: z.enum(["ROLE_UNSPECIFIED", "ROLE_USER", "ROLE_AGENT"]),
    parts: z.array(partSchema).min(1),
    metadata: metadataSchema.optional(),
    extensions: z.array(z.string().min(1)).optional(),
    referenceTaskIds: z.array(z.string().min(1)).optional(),
  })
  .strict()

const sendMessageRequestSchema = z
  .object({
    tenant: z.string().optional(),
    message: messageSchema,
    configuration: sendMessageConfigurationSchema.optional(),
    metadata: metadataSchema.optional(),
  })
  .strict()

const LIST_TASK_QUERY_FIELDS = new Set([
  "A2A-Version",
  "tenant",
  "contextId",
  "status",
  "pageSize",
  "pageToken",
  "historyLength",
  "statusTimestampAfter",
  "includeArtifacts",
])

const TASK_STATES = new Set([
  "TASK_STATE_SUBMITTED",
  "TASK_STATE_WORKING",
  "TASK_STATE_COMPLETED",
  "TASK_STATE_FAILED",
  "TASK_STATE_CANCELED",
  "TASK_STATE_INPUT_REQUIRED",
  "TASK_STATE_REJECTED",
  "TASK_STATE_AUTH_REQUIRED",
])

interface ParsedA2AMessage {
  contextId?: string
  prompt: string
  outputMode: typeof A2A_OUTPUT_MEDIA_TYPE
}

export interface A2AMessageResponse {
  message: {
    messageId: string
    contextId: string
    role: "ROLE_AGENT"
    parts: Array<{
      text: string
      mediaType: typeof A2A_OUTPUT_MEDIA_TYPE
    }>
  }
}

export interface A2AErrorBody {
  error: {
    code: A2AHttpStatus
    status: string
    message: string
    details: Array<{
      "@type": "type.googleapis.com/google.rpc.ErrorInfo"
      reason: string
      domain: "a2a-protocol.org"
      metadata?: Record<string, string>
    }>
  }
}

/** A protocol-aware error that can be serialized as google.rpc.Status JSON. */
export class A2AError extends Error {
  constructor(
    readonly statusCode: A2AHttpStatus,
    readonly status: string,
    readonly reason: string | null,
    message: string,
    readonly metadata?: Record<string, string>,
  ) {
    super(message)
    this.name = "A2AError"
  }
}

/** Validate the transport headers required by the advertised A2A 1.0 interface. */
export function validateA2ARequestHeaders(
  contentType: string | null,
  requestedVersion: string | null,
): void {
  if (contentType) {
    const mediaType = contentType.split(";", 1)[0]?.trim().toLowerCase()
    if (mediaType !== "application/json" && mediaType !== A2A_MEDIA_TYPE) {
      throw new A2AError(
        400,
        "INVALID_ARGUMENT",
        "CONTENT_TYPE_NOT_SUPPORTED",
        `Unsupported Content-Type "${contentType}"; expected application/json or ${A2A_MEDIA_TYPE}.`,
      )
    }
  }

  // Per A2A 1.0, an omitted version header means the legacy 0.3 protocol.
  const version = requestedVersion?.trim() || "0.3"
  if (version !== A2A_PROTOCOL_VERSION) {
    throw new A2AError(
      400,
      "FAILED_PRECONDITION",
      "VERSION_NOT_SUPPORTED",
      `The requested A2A protocol version "${version}" is not supported.`,
      { requestedVersion: version, supportedVersions: A2A_PROTOCOL_VERSION },
    )
  }
}

/** Convert an execution or validation failure to the A2A HTTP error envelope. */
export function toA2AErrorResponse(error: unknown): {
  statusCode: A2AHttpStatus
  body: A2AErrorBody
} {
  const protocolError =
    error instanceof A2AError
      ? error
      : new A2AError(500, "INTERNAL", null, "The agent could not complete the request.")

  return {
    statusCode: protocolError.statusCode,
    body: {
      error: {
        code: protocolError.statusCode,
        status: protocolError.status,
        message: protocolError.message,
        details: protocolError.reason
          ? [
              {
                "@type": "type.googleapis.com/google.rpc.ErrorInfo",
                reason: protocolError.reason,
                domain: "a2a-protocol.org",
                ...(protocolError.metadata ? { metadata: protocolError.metadata } : {}),
              },
            ]
          : [],
      },
    },
  }
}

/** Serialize a failure with the response headers required by the HTTP+JSON binding. */
export function createA2AErrorResponse(error: unknown): Response {
  const failure = toA2AErrorResponse(error)
  return new Response(JSON.stringify(failure.body), {
    status: failure.statusCode,
    headers: {
      "Content-Type": A2A_MEDIA_TYPE,
      "Cache-Control": "no-store",
    },
  })
}

/** Read and parse a JSON request without buffering more than the A2A body limit. */
export async function readA2AJsonBody(request: Request): Promise<unknown> {
  const contentLength = request.headers.get("Content-Length")
  if (contentLength !== null) {
    const declaredBytes = Number(contentLength)
    if (!Number.isSafeInteger(declaredBytes) || declaredBytes < 0) {
      throw malformed("Content-Length must be a non-negative integer.")
    }
    if (declaredBytes > A2A_MAX_REQUEST_BYTES) {
      throw requestTooLarge()
    }
  }

  if (!request.body) {
    throw malformed("A JSON payload is required.")
  }

  const bytes = await readLimitedBody(request.body, A2A_MAX_REQUEST_BYTES, requestTooLarge, () =>
    malformed("The JSON payload could not be read."),
  )

  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes))
  } catch {
    throw malformed("Invalid JSON payload.")
  }
}

/** Read a capability response without buffering an unbounded document. */
export async function readA2ACapabilityText(response: Response): Promise<string> {
  const contentLength = response.headers.get("Content-Length")
  if (contentLength !== null) {
    const declaredBytes = Number(contentLength)
    if (Number.isSafeInteger(declaredBytes) && declaredBytes > A2A_MAX_RESPONSE_BYTES) {
      throw capabilityResponseTooLarge()
    }
  }

  if (!response.body) {
    return ""
  }

  const bytes = await readLimitedBody(
    response.body,
    A2A_MAX_RESPONSE_BYTES,
    capabilityResponseTooLarge,
    () => new A2AError(503, "UNAVAILABLE", null, "The capability response could not be read."),
  )
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes)
  } catch {
    throw new A2AError(503, "UNAVAILABLE", null, "The capability returned invalid UTF-8.")
  }
}

/** Return the canonical error for an operation against unknown stateless task data. */
export function taskNotFound(taskId: string): A2AError {
  return new A2AError(
    404,
    "NOT_FOUND",
    "TASK_NOT_FOUND",
    `Task "${taskId}" was not created by this stateless agent.`,
    { taskId },
  )
}

/** Return the canonical error for an operation disabled by the Agent Card. */
export function unsupportedOperation(operation: string): A2AError {
  return new A2AError(
    400,
    "FAILED_PRECONDITION",
    "UNSUPPORTED_OPERATION",
    `${operation} is not supported by this stateless agent.`,
  )
}

/** Return the canonical error for push operations disabled by the Agent Card. */
export function pushNotificationsNotSupported(): A2AError {
  return new A2AError(
    400,
    "FAILED_PRECONDITION",
    "PUSH_NOTIFICATION_NOT_SUPPORTED",
    "Sosumi does not support A2A push notifications.",
  )
}

/** Validate a ListTasks query and return the page size used by the empty stateless result. */
export function parseA2AListTasksQuery(query: URLSearchParams): number {
  for (const key of query.keys()) {
    if (!LIST_TASK_QUERY_FIELDS.has(key)) {
      throw malformed(`Unsupported ListTasks query field "${key}".`)
    }
    if (query.getAll(key).length > 1) {
      throw malformed(`ListTasks query field "${key}" must not be repeated.`)
    }
  }

  if (query.get("tenant")) {
    throw malformed("tenant is not supported by this interface.")
  }

  const status = query.get("status")
  if (status !== null && !TASK_STATES.has(status)) {
    throw malformed(`Invalid task status "${status}".`)
  }

  parseIntegerQuery(query.get("historyLength"), "historyLength", 0)

  const timestamp = query.get("statusTimestampAfter")
  if (
    timestamp !== null &&
    (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z$/.test(timestamp) ||
      Number.isNaN(Date.parse(timestamp)))
  ) {
    throw malformed("statusTimestampAfter must be an ISO 8601 UTC timestamp.")
  }

  const includeArtifacts = query.get("includeArtifacts")
  if (includeArtifacts !== null && includeArtifacts !== "true" && includeArtifacts !== "false") {
    throw malformed('includeArtifacts must be "true" or "false".')
  }

  return parseIntegerQuery(query.get("pageSize"), "pageSize", 1, 100) ?? 50
}

/**
 * Execute a synchronous A2A message using one of Sosumi's existing HTTP
 * capabilities and return a direct Message response (no persistent Task).
 */
export async function handleA2AMessage(
  input: unknown,
  invoke: (endpoint: string, outputMode: typeof A2A_OUTPUT_MEDIA_TYPE) => Promise<string>,
): Promise<A2AMessageResponse> {
  const request = parseA2AMessage(input)
  const endpoint = resolveA2AEndpoint(request.prompt)
  const text = await invoke(endpoint, request.outputMode)

  return {
    message: {
      messageId: crypto.randomUUID(),
      contextId: request.contextId ?? crypto.randomUUID(),
      role: "ROLE_AGENT",
      parts: [{ text, mediaType: request.outputMode }],
    },
  }
}

/** Infer the existing Sosumi capability endpoint described by a text prompt. */
export function resolveA2AEndpoint(prompt: string): string {
  const fetchTarget = extractFetchTarget(prompt)
  if (fetchTarget) {
    try {
      const endpoint = resolveFetchEndpoint(fetchTarget)
      if (endpoint.startsWith("/external/")) {
        const target = new URL(endpoint.slice("/external/".length))
        target.hash = ""
        return `/external/${encodeURIComponent(target.toString())}`
      }
      return endpoint
    } catch (error) {
      throw malformed(error instanceof Error ? error.message : "Invalid fetch target.")
    }
  }

  const query = prompt
    .replace(
      /^(?:please\s+)?(?:search|find|look up)(?:\s+(?:the\s+)?apple(?: developer)?\s+documentation)?(?:\s+(?:for|about))?\s+/i,
      "",
    )
    .trim()

  try {
    return resolveSearchEndpoint(query || prompt)
  } catch (error) {
    throw malformed(error instanceof Error ? error.message : "Invalid search query.")
  }
}

/** Map an existing capability's HTTP failure into the A2A error envelope. */
export function capabilityError(statusCode: number, message: string): A2AError {
  if (statusCode === 400) {
    return new A2AError(400, "INVALID_ARGUMENT", null, message)
  }
  if (statusCode === 403) {
    return new A2AError(403, "PERMISSION_DENIED", null, message)
  }
  if (statusCode === 404) {
    return new A2AError(404, "NOT_FOUND", null, message)
  }
  return new A2AError(503, "UNAVAILABLE", null, message)
}

function parseA2AMessage(input: unknown): ParsedA2AMessage {
  const parsed = sendMessageRequestSchema.safeParse(input)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    const field = issue?.path.length ? issue.path.join(".") : "request"
    throw malformed(`${field}: ${issue?.message ?? "Invalid A2A request."}`)
  }

  const request = parsed.data
  if (request.tenant) {
    throw malformed("tenant is not supported by this interface.")
  }
  const message = request.message
  if (message.role !== "ROLE_USER") {
    throw malformed('message.role must be "ROLE_USER".')
  }
  if (message.taskId !== undefined) {
    throw taskNotFound(message.taskId)
  }
  const referencedTaskId = message.referenceTaskIds?.[0]
  if (referencedTaskId) {
    throw taskNotFound(referencedTaskId)
  }

  const textParts = message.parts.map(parseTextPart)
  const prompt = textParts.join("\n").trim()
  if (!prompt) {
    throw malformed("message.parts must contain non-empty text.")
  }
  if (prompt.length > 10_000) {
    throw malformed("Combined message text must not exceed 10,000 characters.")
  }

  return {
    contextId: message.contextId,
    prompt,
    outputMode: selectOutputMode(request.configuration),
  }
}

function parseTextPart(part: z.infer<typeof partSchema>): string {
  const contentFields = ["text", "raw", "url", "data"].filter((field) => field in part)
  if (contentFields.length !== 1 || contentFields[0] !== "text" || typeof part.text !== "string") {
    throw new A2AError(
      400,
      "INVALID_ARGUMENT",
      "CONTENT_TYPE_NOT_SUPPORTED",
      "Sosumi accepts text message parts only.",
    )
  }
  if (part.mediaType !== undefined && part.mediaType !== "text/plain") {
    throw new A2AError(
      400,
      "INVALID_ARGUMENT",
      "CONTENT_TYPE_NOT_SUPPORTED",
      `Unsupported input media type "${String(part.mediaType)}"; expected text/plain.`,
    )
  }

  return part.text
}

function selectOutputMode(
  configuration: z.infer<typeof sendMessageConfigurationSchema> | undefined,
): typeof A2A_OUTPUT_MEDIA_TYPE {
  if (configuration === undefined) {
    return A2A_OUTPUT_MEDIA_TYPE
  }
  if (configuration.taskPushNotificationConfig !== undefined) {
    throw pushNotificationsNotSupported()
  }

  const modes = configuration.acceptedOutputModes
  if (modes === undefined || (Array.isArray(modes) && modes.length === 0)) {
    return A2A_OUTPUT_MEDIA_TYPE
  }
  if (!Array.isArray(modes) || !modes.every((mode) => typeof mode === "string")) {
    throw malformed("configuration.acceptedOutputModes must be an array of media types.")
  }
  if (modes.includes(A2A_OUTPUT_MEDIA_TYPE)) {
    return A2A_OUTPUT_MEDIA_TYPE
  }

  throw new A2AError(
    400,
    "INVALID_ARGUMENT",
    "CONTENT_TYPE_NOT_SUPPORTED",
    `Sosumi returns ${A2A_OUTPUT_MEDIA_TYPE} only.`,
  )
}

function extractFetchTarget(prompt: string): string | null {
  const url = prompt.match(/https:\/\/[^\s<>"'`]+/i)?.[0]
  if (url) {
    return trimTargetPunctuation(url)
  }

  const pathPrefixes = ["/documentation/", "/design/human-interface-guidelines", "/videos/play/"]
  const lowerPrompt = prompt.toLowerCase()
  for (const prefix of pathPrefixes) {
    const index = lowerPrompt.indexOf(prefix)
    if (index >= 0) {
      return trimTargetPunctuation(prompt.slice(index).split(/\s/, 1)[0] ?? "")
    }
  }

  return null
}

function trimTargetPunctuation(target: string): string {
  return target.replace(/[`'",.;:!?\])}]+$/g, "")
}

function malformed(message: string): A2AError {
  return new A2AError(400, "INVALID_ARGUMENT", null, message)
}

function requestTooLarge(): A2AError {
  return new A2AError(
    413,
    "RESOURCE_EXHAUSTED",
    null,
    `Request body exceeds the ${A2A_MAX_REQUEST_BYTES}-byte limit.`,
  )
}

function parseIntegerQuery(
  value: string | null,
  name: string,
  minimum: number,
  maximum = Number.MAX_SAFE_INTEGER,
): number | undefined {
  if (value === null) {
    return undefined
  }
  if (!/^\d+$/.test(value)) {
    throw malformed(`${name} must be an integer.`)
  }

  const parsed = Number(value)
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw malformed(`${name} must be between ${minimum} and ${maximum}.`)
  }
  return parsed
}

function capabilityResponseTooLarge(): A2AError {
  return new A2AError(
    503,
    "UNAVAILABLE",
    null,
    `Capability response exceeds the ${A2A_MAX_RESPONSE_BYTES}-byte A2A limit.`,
  )
}

async function readLimitedBody(
  body: ReadableStream<Uint8Array>,
  maximumBytes: number,
  tooLarge: () => A2AError,
  readFailure: () => A2AError,
): Promise<Uint8Array> {
  const reader = body.getReader()
  const chunks: Uint8Array[] = []
  let byteLength = 0

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) {
        break
      }

      byteLength += value.byteLength
      if (byteLength > maximumBytes) {
        try {
          await reader.cancel()
        } catch {
          // The bounded error below is more useful than a cancellation failure.
        }
        throw tooLarge()
      }
      chunks.push(value)
    }
  } catch (error) {
    if (error instanceof A2AError) {
      throw error
    }
    throw readFailure()
  } finally {
    reader.releaseLock()
  }

  const bytes = new Uint8Array(byteLength)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  return bytes
}

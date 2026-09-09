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
    defaultOutputModes: ["text/markdown", "text/plain"],
    skills,
  }
}

type A2AHttpStatus = 400 | 403 | 404 | 500 | 502

type JsonRecord = Record<string, unknown>

interface ParsedA2AMessage {
  contextId?: string
  prompt: string
  outputMode: "text/markdown" | "text/plain"
}

export interface A2AMessageResponse {
  message: {
    messageId: string
    contextId: string
    role: "ROLE_AGENT"
    parts: Array<{
      text: string
      mediaType: "text/markdown" | "text/plain"
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

/**
 * Execute a synchronous A2A message using one of Sosumi's existing HTTP
 * capabilities and return a direct Message response (no persistent Task).
 */
export async function handleA2AMessage(
  input: unknown,
  invoke: (endpoint: string, outputMode: "text/markdown" | "text/plain") => Promise<string>,
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
      return resolveFetchEndpoint(fetchTarget)
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
  return new A2AError(502, "UNAVAILABLE", null, message)
}

function parseA2AMessage(input: unknown): ParsedA2AMessage {
  if (!isJsonRecord(input) || !isJsonRecord(input.message)) {
    throw malformed("message is required.")
  }

  const message = input.message
  if (typeof message.messageId !== "string" || !message.messageId.trim()) {
    throw malformed("message.messageId is required.")
  }
  if (message.role !== "ROLE_USER") {
    throw malformed('message.role must be "ROLE_USER".')
  }
  if (message.contextId !== undefined && !isNonEmptyString(message.contextId)) {
    throw malformed("message.contextId must be a non-empty string when provided.")
  }
  if (message.taskId !== undefined) {
    if (!isNonEmptyString(message.taskId)) {
      throw malformed("message.taskId must be a non-empty string when provided.")
    }
    throw new A2AError(
      404,
      "NOT_FOUND",
      "TASK_NOT_FOUND",
      `Task "${message.taskId}" was not created by this stateless agent.`,
      { taskId: message.taskId },
    )
  }
  if (!Array.isArray(message.parts) || message.parts.length === 0) {
    throw malformed("message.parts must contain at least one text part.")
  }

  const textParts = message.parts.map((part, index) => parseTextPart(part, index))
  const prompt = textParts.join("\n").trim()
  if (!prompt) {
    throw malformed("message.parts must contain non-empty text.")
  }
  if (prompt.length > 10_000) {
    throw malformed("Combined message text must not exceed 10,000 characters.")
  }

  return {
    contextId: typeof message.contextId === "string" ? message.contextId : undefined,
    prompt,
    outputMode: selectOutputMode(input.configuration),
  }
}

function parseTextPart(part: unknown, index: number): string {
  if (!isJsonRecord(part)) {
    throw malformed(`message.parts[${index}] must be an object.`)
  }

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

function selectOutputMode(configuration: unknown): "text/markdown" | "text/plain" {
  if (configuration === undefined) {
    return "text/markdown"
  }
  if (!isJsonRecord(configuration)) {
    throw malformed("configuration must be an object when provided.")
  }
  if (configuration.taskPushNotificationConfig !== undefined) {
    throw new A2AError(
      400,
      "FAILED_PRECONDITION",
      "PUSH_NOTIFICATION_NOT_SUPPORTED",
      "Sosumi does not support A2A push notifications.",
    )
  }

  const modes = configuration.acceptedOutputModes
  if (modes === undefined || (Array.isArray(modes) && modes.length === 0)) {
    return "text/markdown"
  }
  if (!Array.isArray(modes) || !modes.every((mode) => typeof mode === "string")) {
    throw malformed("configuration.acceptedOutputModes must be an array of media types.")
  }
  if (modes.includes("text/markdown")) {
    return "text/markdown"
  }
  if (modes.includes("text/plain")) {
    return "text/plain"
  }

  throw new A2AError(
    400,
    "INVALID_ARGUMENT",
    "CONTENT_TYPE_NOT_SUPPORTED",
    "Sosumi can return text/markdown or text/plain only.",
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
  return new A2AError(400, "INVALID_ARGUMENT", "REQUEST_MALFORMED", message)
}

function isJsonRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0
}

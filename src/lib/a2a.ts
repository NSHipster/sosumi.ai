import { MCP_SERVER_INFO, TOOL_DEFINITIONS } from "./mcp"

/**
 * The A2A protocol version each interface exposes, as `major.minor`.
 * See https://a2a-protocol.org/latest/specification/
 */
const A2A_PROTOCOL_VERSION = "0.3"

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
  /** Alias of `protocolBinding` for clients reading the published JSON schema's `transport`. */
  transport: string
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
    transport: TRANSPORT,
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

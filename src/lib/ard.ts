import { PUBLISHER_DID, PUBLISHER_DOMAIN } from "./identity"
import { SKILL_NAME } from "./skill"

export const AI_CATALOG_MEDIA_TYPE = "application/ai-catalog+json"

export interface AiCatalogEntry {
  identifier: string
  displayName: string
  type: string
  url: string
  description: string
  representativeQueries: string[]
}

export interface AiCatalog {
  specVersion: string
  host: {
    displayName: string
    identifier: string
    documentationUrl: string
  }
  entries: AiCatalogEntry[]
}

/** Build the ARD capability manifest for the origin serving the request. */
export function buildAiCatalog(origin: string): AiCatalog {
  return {
    specVersion: "1.0",
    host: {
      displayName: PUBLISHER_DOMAIN,
      identifier: PUBLISHER_DID,
      documentationUrl: `${origin}/`,
    },
    entries: [
      {
        identifier: `urn:air:${PUBLISHER_DOMAIN}:server:mcp`,
        displayName: "Sosumi MCP Server",
        type: "application/mcp-server-card+json",
        url: `${origin}/.well-known/mcp/server-card.json`,
        description:
          "Searches and fetches Apple Developer documentation, Human Interface Guidelines, WWDC transcripts, and public Swift-DocC pages.",
        representativeQueries: [
          "Search Apple Developer documentation for URLSession",
          "Fetch the SwiftUI View documentation as Markdown",
          "Get the transcript for a WWDC session",
          "Read a public Swift-DocC documentation page",
        ],
      },
      {
        identifier: `urn:air:${PUBLISHER_DOMAIN}:agent:documentation`,
        displayName: "Sosumi Documentation Agent",
        type: "application/a2a-agent-card+json",
        url: `${origin}/.well-known/agent-card.json`,
        description:
          "An A2A agent for searching and fetching Apple and Swift-DocC documentation as text or Markdown.",
        representativeQueries: [
          "Find Apple documentation about Swift actors",
          "Fetch the SwiftUI View documentation as Markdown",
          "Fetch the transcript for /videos/play/wwdc2021/10133",
        ],
      },
      {
        identifier: `urn:air:${PUBLISHER_DOMAIN}:skill:${SKILL_NAME}`,
        displayName: "Sosumi Agent Skill",
        type: 'text/markdown; profile="urn:air:agent-skills"',
        url: `${origin}/.well-known/agent-skills/${SKILL_NAME}/SKILL.md`,
        description:
          "Instructions for using Sosumi to research Apple APIs, design guidance, videos, and Swift-DocC documentation.",
        representativeQueries: [
          "Research an Apple framework API before writing code",
          "Look up current SwiftUI documentation",
          "Find Apple's design guidance for an interface",
        ],
      },
    ],
  }
}

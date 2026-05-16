import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"

import type { ExternalPolicyEnv } from "./external"
import { fetchExternalDocumentationMarkdown } from "./external"
import { fetchHIGPageData, renderHIGFromJSON } from "./hig"
import { fetchJSONData, renderFromJSON } from "./reference"
import { searchAppleDeveloperDocs } from "./search"
import { generateAppleDocUrl, normalizeDocumentationPath } from "./url"
import { fetchVideoTranscriptMarkdown } from "./video"

export function createMcpServer(externalPolicyEnv: ExternalPolicyEnv = {}) {
  const server = new McpServer({
    name: "sosumi.ai",
    version: "1.0.0",
  })

  // Register Apple search tool
  server.registerTool(
    "searchAppleDocumentation",
    {
      title: "Search Apple Documentation",
      description: "Search Apple Developer documentation and return structured results",
      inputSchema: {
        query: z.string().describe("Search query for Apple documentation"),
      },
      outputSchema: {
        query: z.string().describe("The search query that was executed"),
        results: z
          .array(
            z.object({
              title: z.string().describe("Title of the documentation page"),
              url: z.string().describe("Full URL to the documentation page"),
              description: z.string().describe("Brief description of the page content"),
              breadcrumbs: z
                .array(z.string())
                .describe("Navigation breadcrumbs showing the page hierarchy"),
              tags: z
                .array(z.string())
                .describe("Tags associated with the page (languages, platforms, etc.)"),
              type: z.string().describe("Type of result (documentation, general, etc.)"),
            }),
          )
          .describe("Array of search results"),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ query }) => {
      try {
        const searchResponse = await searchAppleDeveloperDocs(query)

        const structuredContent = {
          query: searchResponse.query,
          results: searchResponse.results.map((result) => ({
            title: result.title,
            url: result.url,
            description: result.description,
            breadcrumbs: result.breadcrumbs,
            tags: result.tags,
            type: result.type,
          })),
        }

        if (searchResponse.results.length === 0) {
          return {
            content: [
              {
                type: "text" as const,
                text: `No results found for "${query}"`,
              },
            ],
            structuredContent,
          }
        }

        // Provide a readable text summary
        const resultText =
          `Found ${searchResponse.results.length} result(s) for "${query}":\n\n` +
          searchResponse.results
            .map(
              (result, index) =>
                `${index + 1}. ${result.title}\n   ${result.url}\n   ${result.description || "No description"}`,
            )
            .join("\n\n")

        return {
          content: [
            {
              type: "text" as const,
              text: resultText,
            },
          ],
          structuredContent,
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error"

        const structuredContent = {
          query,
          results: [],
        }

        return {
          content: [
            {
              type: "text" as const,
              text: `Error searching Apple Developer documentation: ${errorMessage}`,
            },
          ],
          structuredContent,
        }
      }
    },
  )

  // Register documentation fetch tool (supports both dev docs and HIG)
  server.registerTool(
    "fetchAppleDocumentation",
    {
      title: "Fetch Apple Documentation",
      description:
        "Fetch Apple Developer documentation and Human Interface Guidelines by path and return as markdown",
      inputSchema: {
        path: z
          .string()
          .describe(
            "Documentation path (e.g., '/documentation/swift', 'swiftui/view', 'design/human-interface-guidelines/foundations/color')",
          ),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ path }) => {
      try {
        // Check if this is a HIG path
        if (path.includes("design/human-interface-guidelines")) {
          // Handle HIG content
          const higPath = path.replace(/^\/?(design\/human-interface-guidelines\/)/, "")
          const sourceUrl = `https://developer.apple.com/design/human-interface-guidelines/${higPath}`

          const jsonData = await fetchHIGPageData(higPath)
          const markdown = await renderHIGFromJSON(jsonData, sourceUrl)

          if (!markdown || markdown.trim().length < 100) {
            throw new Error("Insufficient content in HIG page")
          }

          return {
            content: [
              {
                type: "text" as const,
                text: markdown,
              },
            ],
          }
        } else {
          // Handle regular developer documentation
          const normalizedPath = normalizeDocumentationPath(path)
          const appleUrl = generateAppleDocUrl(normalizedPath)

          const jsonData = await fetchJSONData(normalizedPath)
          const markdown = await renderFromJSON(jsonData, appleUrl)

          if (!markdown || markdown.trim().length < 100) {
            throw new Error("Insufficient content in documentation")
          }

          return {
            content: [
              {
                type: "text" as const,
                text: markdown,
              },
            ],
          }
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error"

        return {
          content: [
            {
              type: "text" as const,
              text: `Error fetching content for "${path}": ${errorMessage}`,
            },
          ],
        }
      }
    },
  )

  // Register external documentation fetch tool
  server.registerTool(
    "fetchExternalDocumentation",
    {
      title: "Fetch External Documentation",
      description:
        "Fetch external Swift-DocC documentation by absolute https URL and return as markdown",
      inputSchema: {
        url: z
          .string()
          .describe(
            "External Swift-DocC URL (e.g., 'https://apple.github.io/swift-argument-parser/documentation/argumentparser')",
          ),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ url }) => {
      try {
        const markdown = await fetchExternalDocumentationMarkdown(url, externalPolicyEnv)

        if (!markdown || markdown.trim().length < 100) {
          throw new Error("Insufficient content in external documentation")
        }

        return {
          content: [
            {
              type: "text" as const,
              text: markdown,
            },
          ],
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error"

        return {
          content: [
            {
              type: "text" as const,
              text: `Error fetching external content for "${url}": ${errorMessage}`,
            },
          ],
        }
      }
    },
  )

  // Register Apple video transcript fetch tool
  server.registerTool(
    "fetchAppleVideoTranscript",
    {
      title: "Fetch Apple Video Transcript",
      description: "Fetch transcript for an Apple Developer video path and return as markdown",
      inputSchema: {
        path: z
          .string()
          .describe(
            "Apple video path (e.g., '/videos/play/wwdc2021/10133' or '/videos/play/meet-with-apple/208')",
          ),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ path }) => {
      try {
        const normalizedPath = path.startsWith("/") ? path : `/${path}`
        const match = normalizedPath.match(/^\/videos\/play\/([a-z0-9-]+)\/(\d+)\/?$/i)
        if (!match) {
          throw new Error(
            "Invalid Apple video path. Expected format: /videos/play/COLLECTION/VIDEO_ID",
          )
        }

        const collection = match[1]
        const videoId = match[2]
        const sourceUrl = `https://developer.apple.com/videos/play/${collection}/${videoId}/`
        const markdown = await fetchVideoTranscriptMarkdown(sourceUrl, collection, videoId)

        if (!markdown || markdown.trim().length < 100) {
          throw new Error("Insufficient content in video transcript")
        }

        return {
          content: [
            {
              type: "text" as const,
              text: markdown,
            },
          ],
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error"
        return {
          content: [
            {
              type: "text" as const,
              text: `Error fetching Apple video transcript for "${path}": ${errorMessage}`,
            },
          ],
        }
      }
    },
  )

  return server
}

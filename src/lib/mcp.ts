import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { HTTPException } from "hono/http-exception"
import { z } from "zod"
import { logError } from "./errors"
import type { ExternalPolicyEnv } from "./external"
import { fetchExternalDocumentationMarkdown } from "./external"
import { fetchHIGPageData, renderHIGFromJSON } from "./hig"
import { PUBLISHER_DOMAIN } from "./identity"
import { fetchDocumentationPage, renderFromJSON } from "./reference"
import { searchAppleDeveloperDocs } from "./search"
import { generateAppleDocUrl, normalizeDocumentationPath } from "./url"
import { fetchVideoTranscriptMarkdown } from "./video"

export const MCP_SERVER_INFO = {
  name: PUBLISHER_DOMAIN,
  version: "1.0.0",
} as const

/**
 * Guidance for clients, kept out of the documentation itself
 * so that fetched pages stay 1:1 with Apple's content.
 */
export const MCP_SERVER_INSTRUCTIONS =
  "Sosumi returns Apple's documentation as Markdown. " +
  'The conformance conditions in Apple\'s data, such as "Conforms when `Element` conforms to `Hashable`.", ' +
  "can be missing or wrong. " +
  "When a condition matters, read the declaration in the module's `.swiftinterface` file in the SDK."

export interface ToolHttpBinding {
  path?: string
  pathFrom?: string
  pathPrefix?: string
  query?: Record<string, string>
}

export interface ToolMeta {
  name: string
  title: string
  description: string
  inputSchema: z.ZodRawShape
  outputSchema?: z.ZodRawShape
  annotations: {
    title: string
    readOnlyHint: boolean
    destructiveHint: boolean
    idempotentHint: boolean
    openWorldHint: boolean
  }
  http: ToolHttpBinding
}

const searchResultSchema = z.object({
  title: z.string().describe("Title of the documentation page"),
  url: z.string().describe("Full URL to the documentation page"),
  description: z.string().describe("Brief description of the page content"),
  breadcrumbs: z.array(z.string()).describe("Navigation breadcrumbs showing the page hierarchy"),
  tags: z.array(z.string()).describe("Tags associated with the page (languages, platforms, etc.)"),
  type: z.string().describe("Type of result (documentation, general, etc.)"),
})

function readOnlyAnnotations(title: string) {
  return {
    title,
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true,
  } as const
}

export const TOOL_DEFINITIONS = {
  searchAppleDocumentation: {
    name: "searchAppleDocumentation",
    title: "Search Apple Documentation",
    description:
      "Search Apple Developer documentation (https://developer.apple.com/documentation) and return structured results",
    inputSchema: {
      query: z.string().describe("Search query for Apple documentation"),
    },
    outputSchema: {
      query: z.string().describe("The search query that was executed"),
      results: z.array(searchResultSchema).describe("Array of search results"),
    },
    annotations: readOnlyAnnotations("Search Apple Documentation"),
    http: { path: "/search", query: { q: "query" } },
  },
  fetchAppleDocumentation: {
    name: "fetchAppleDocumentation",
    title: "Fetch Apple Documentation",
    description:
      "Fetch a page of Apple Developer documentation (https://developer.apple.com/documentation) or the Human Interface Guidelines (https://developer.apple.com/design/human-interface-guidelines) by path and return it as Markdown",
    inputSchema: {
      path: z
        .string()
        .describe(
          "Documentation path (e.g., '/documentation/swift', '/documentation/swiftui/view', '/design/human-interface-guidelines/foundations/color')",
        ),
    },
    annotations: readOnlyAnnotations("Fetch Apple Documentation"),
    http: { pathFrom: "path" },
  },
  fetchExternalDocumentation: {
    name: "fetchExternalDocumentation",
    title: "Fetch External Documentation",
    description:
      "Fetch a page from a public Swift-DocC documentation site (https://www.swift.org/documentation/docc/) by absolute HTTPS URL and return it as Markdown",
    inputSchema: {
      url: z
        .string()
        .describe(
          "External Swift-DocC URL (e.g., 'https://swiftlang.github.io/swift-docc-plugin/documentation/swiftdoccplugin')",
        ),
    },
    annotations: readOnlyAnnotations("Fetch External Documentation"),
    http: { pathFrom: "url", pathPrefix: "/external/" },
  },
  fetchAppleVideoTranscript: {
    name: "fetchAppleVideoTranscript",
    title: "Fetch Apple Video Transcript",
    description:
      "Fetch the transcript of an Apple Developer video (https://developer.apple.com/videos) by path and return it as Markdown",
    inputSchema: {
      path: z
        .string()
        .describe(
          "Apple video path (e.g., '/videos/play/wwdc2021/10133' or '/videos/play/meet-with-apple/208')",
        ),
    },
    annotations: readOnlyAnnotations("Fetch Apple Video Transcript"),
    http: { pathFrom: "path" },
  },
} satisfies Record<string, ToolMeta>

/**
 * Each tool returns a failure as an `isError` result, so `app.onError` never sees it.
 * The tool handler logs the failure instead.
 */
export function createMcpServer(externalPolicyEnv: ExternalPolicyEnv = {}) {
  const server = new McpServer(MCP_SERVER_INFO, { instructions: MCP_SERVER_INSTRUCTIONS })

  const search = TOOL_DEFINITIONS.searchAppleDocumentation
  server.registerTool(
    search.name,
    {
      title: search.title,
      description: search.description,
      inputSchema: search.inputSchema,
      outputSchema: search.outputSchema,
      annotations: search.annotations,
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
        logError(error)
        const errorMessage = error instanceof Error ? error.message : "Unknown error"

        // Report the failure as an error rather than as structured content.
        // An empty `results` array reads as "this documentation does not exist",
        // which would leave the caller trusting its own memory instead of looking again.
        return {
          isError: true,
          content: [
            {
              type: "text" as const,
              text: `Error searching Apple Developer documentation: ${errorMessage}`,
            },
          ],
        }
      }
    },
  )

  const fetchDocs = TOOL_DEFINITIONS.fetchAppleDocumentation
  server.registerTool(
    fetchDocs.name,
    {
      title: fetchDocs.title,
      description: fetchDocs.description,
      inputSchema: fetchDocs.inputSchema,
      annotations: fetchDocs.annotations,
    },
    async ({ path }) => {
      try {
        if (path.includes("design/human-interface-guidelines")) {
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
        }

        const requestedPath = normalizeDocumentationPath(path)
        const page = await fetchDocumentationPage(requestedPath)
        const markdown = await renderFromJSON(page.data, generateAppleDocUrl(page.path))

        if (!markdown || markdown.trim().length < 100) {
          throw new Error("Insufficient content in documentation")
        }

        const content = [{ type: "text" as const, text: markdown }]
        // Say when the page is at another path, because a resolved path
        // can have a different signature from the requested one.
        if (page.path.toLowerCase() !== requestedPath.toLowerCase()) {
          content.unshift({
            type: "text" as const,
            text: `No page exists at /documentation/${requestedPath}. This is the page at /documentation/${page.path}.`,
          })
        }

        return { content }
      } catch (error) {
        logError(error)
        const errorMessage = error instanceof Error ? error.message : "Unknown error"

        return {
          isError: true,
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

  const fetchExternal = TOOL_DEFINITIONS.fetchExternalDocumentation
  server.registerTool(
    fetchExternal.name,
    {
      title: fetchExternal.title,
      description: fetchExternal.description,
      inputSchema: fetchExternal.inputSchema,
      annotations: fetchExternal.annotations,
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
        logError(error)
        const errorMessage = error instanceof Error ? error.message : "Unknown error"

        return {
          isError: true,
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

  const fetchVideo = TOOL_DEFINITIONS.fetchAppleVideoTranscript
  server.registerTool(
    fetchVideo.name,
    {
      title: fetchVideo.title,
      description: fetchVideo.description,
      inputSchema: fetchVideo.inputSchema,
      annotations: fetchVideo.annotations,
    },
    async ({ path }) => {
      try {
        const normalizedPath = path.startsWith("/") ? path : `/${path}`
        const match = normalizedPath.match(/^\/videos\/play\/([a-z0-9-]+)\/(\d+)\/?$/i)
        if (!match) {
          // The HTTP route answers an invalid path with 400, so log it as a client error too.
          throw new HTTPException(400, {
            message: "Invalid Apple video path. Expected format: /videos/play/COLLECTION/VIDEO_ID",
          })
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
        logError(error)
        const errorMessage = error instanceof Error ? error.message : "Unknown error"
        return {
          isError: true,
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

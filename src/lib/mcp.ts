import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"

import { fetchJSONData } from "./fetch"
import { renderFromJSON } from "./render"
import { searchAppleDeveloperDocs } from "./search"
import { generateAppleDocUrl, normalizeDocumentationPath } from "./url"

export function createMcpServer() {
  const server = new McpServer({
    name: "sosumi.ai",
    version: "1.0.0",
  })

  // Register doc://{path} resource template
  server.registerResource(
    "appleDocumentation",
    new ResourceTemplate("doc://{path}", { list: undefined }),
    {
      title: "Apple Documentation",
      description: "Apple Developer documentation as Markdown",
    },
    async (uri, { path }) => {
      try {
        // Percent decode the path first, then generate URL
        const decodedPath = decodeURIComponent(path.toString())
        const normalizedPath = normalizeDocumentationPath(decodedPath)
        const appleUrl = generateAppleDocUrl(normalizedPath)

        const jsonData = await fetchJSONData(normalizedPath)
        const markdown = await renderFromJSON(jsonData, appleUrl)

        if (!markdown || markdown.trim().length < 100) {
          throw new Error("Insufficient content in documentation")
        }

        return {
          contents: [
            {
              uri: uri.href,
              text: markdown,
              mimeType: "text/markdown",
            },
          ],
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error"
        return {
          contents: [
            {
              uri: uri.href,
              text: `Error fetching documentation: ${errorMessage}`,
              mimeType: "text/plain",
            },
          ],
        }
      }
    },
  )

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

  // Register documentation fetch tool (complements resource template for tool-only clients)
  server.registerTool(
    "fetchAppleDocumentation",
    {
      title: "Fetch Apple Documentation",
      description: "Fetch Apple Developer documentation by path and return as markdown",
      inputSchema: {
        path: z
          .string()
          .describe(
            "Full or relative documentation path (e.g., '/documentation/swift', 'swiftui/view')",
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
        // Generate Apple Developer URL (path normalization handled by fetchJSONData)
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
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error"

        return {
          content: [
            {
              type: "text" as const,
              text: `Error fetching documentation for "${path}": ${errorMessage}`,
            },
          ],
        }
      }
    },
  )

  return server
}

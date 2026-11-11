import { beforeEach, describe, expect, it, vi } from "vitest"

const toolHandlers = new Map<string, (input: unknown) => Promise<unknown>>()
let serverOptions: { instructions?: string } | undefined
const fetchVideoTranscriptMarkdown = vi.fn()
const searchAppleDeveloperDocs = vi.fn()
const fetchDocumentationPage = vi.fn()
const renderFromJSON = vi.fn()
const fetchExternalDocumentationMarkdown = vi.fn()

vi.mock("@modelcontextprotocol/sdk/server/mcp.js", () => {
  class McpServerMock {
    constructor(_serverInfo: unknown, options?: { instructions?: string }) {
      serverOptions = options
    }

    registerTool(
      name: string,
      _config: unknown,
      handler: (input: unknown) => Promise<unknown>,
    ): void {
      toolHandlers.set(name, handler)
    }
  }

  return {
    McpServer: McpServerMock,
  }
})

vi.mock("../src/lib/video", () => ({
  fetchVideoTranscriptMarkdown,
}))

vi.mock("../src/lib/search", () => ({
  searchAppleDeveloperDocs,
}))

vi.mock("../src/lib/reference", () => ({
  fetchDocumentationPage,
  renderFromJSON,
}))

vi.mock("../src/lib/external", () => ({
  fetchExternalDocumentationMarkdown,
}))

describe("MCP tools registration", () => {
  beforeEach(() => {
    toolHandlers.clear()
    serverOptions = undefined
    fetchVideoTranscriptMarkdown.mockReset()
    searchAppleDeveloperDocs.mockReset()
    fetchDocumentationPage.mockReset()
    renderFromJSON.mockReset()
    fetchExternalDocumentationMarkdown.mockReset()
  })

  it("gives instructions about conformance conditions", async () => {
    const { createMcpServer } = await import("../src/lib/mcp")
    createMcpServer()

    expect(serverOptions?.instructions).toContain("conformance conditions")
    expect(serverOptions?.instructions).toContain(".swiftinterface")
  })

  it("registers and runs fetchAppleVideoTranscript with path input", async () => {
    fetchVideoTranscriptMarkdown.mockResolvedValue(`# Transcript\n\n${"A".repeat(150)}`)

    const { createMcpServer } = await import("../src/lib/mcp")
    createMcpServer()

    const handler = toolHandlers.get("fetchAppleVideoTranscript")
    expect(handler).toBeDefined()

    const result = (await handler?.({
      path: "/videos/play/wwdc2021/10133",
    })) as { content: Array<{ text: string }> }

    expect(fetchVideoTranscriptMarkdown).toHaveBeenCalledWith(
      "https://developer.apple.com/videos/play/wwdc2021/10133/",
      "wwdc2021",
      "10133",
    )
    expect(result.content[0].text).toContain("# Transcript")
  })

  it("supports non-WWDC /videos/play collections", async () => {
    fetchVideoTranscriptMarkdown.mockResolvedValue(`# Transcript\n\n${"A".repeat(150)}`)

    const { createMcpServer } = await import("../src/lib/mcp")
    createMcpServer()

    const handler = toolHandlers.get("fetchAppleVideoTranscript")
    const result = (await handler?.({
      path: "/videos/play/meet-with-apple/208",
    })) as { content: Array<{ text: string }> }

    expect(fetchVideoTranscriptMarkdown).toHaveBeenCalledWith(
      "https://developer.apple.com/videos/play/meet-with-apple/208/",
      "meet-with-apple",
      "208",
    )
    expect(result.content[0].text).toContain("# Transcript")
  })

  it("returns a readable error for invalid video path input", async () => {
    const { createMcpServer } = await import("../src/lib/mcp")
    createMcpServer()

    const handler = toolHandlers.get("fetchAppleVideoTranscript")
    const result = (await handler?.({
      path: "/videos/wwdc2021/",
    })) as { content: Array<{ text: string }> }

    expect(fetchVideoTranscriptMarkdown).not.toHaveBeenCalled()
    expect(result.content[0].text).toContain(
      'Error fetching Apple video transcript for "/videos/wwdc2021/"',
    )
    expect(result.content[0].text).toContain("Invalid Apple video path")
  })

  it("registers and runs searchAppleDocumentation with structured results", async () => {
    searchAppleDeveloperDocs.mockResolvedValue({
      query: "SchemaMigrationPlan",
      results: [
        {
          title: "SchemaMigrationPlan",
          url: "https://developer.apple.com/documentation/swiftdata/schemamigrationplan",
          description:
            "An interface for describing the evolution of a schema and how to migrate between specific versions.",
          breadcrumbs: ["SwiftData", "SchemaMigrationPlan"],
          tags: ["symbol"],
          type: "documentation",
        },
      ],
    })

    const { createMcpServer } = await import("../src/lib/mcp")
    createMcpServer()

    const handler = toolHandlers.get("searchAppleDocumentation")
    expect(handler).toBeDefined()

    const result = (await handler?.({
      query: "SchemaMigrationPlan",
    })) as {
      content: Array<{ text: string }>
      structuredContent: { query: string; results: Array<{ title: string }> }
    }

    expect(searchAppleDeveloperDocs).toHaveBeenCalledWith("SchemaMigrationPlan")
    expect(result.content[0].text).toContain("Found 1 result(s)")
    expect(result.structuredContent.query).toBe("SchemaMigrationPlan")
    expect(result.structuredContent.results[0]?.title).toBe("SchemaMigrationPlan")
  })

  it("reports an upstream search failure as an error rather than an empty result set", async () => {
    searchAppleDeveloperDocs.mockRejectedValue(new Error("Search request failed: 404"))

    const { createMcpServer } = await import("../src/lib/mcp")
    createMcpServer()

    const handler = toolHandlers.get("searchAppleDocumentation")
    const result = (await handler?.({ query: "WKWebView" })) as {
      isError?: boolean
      content: Array<{ text: string }>
      structuredContent?: { query: string; results: unknown[] }
    }

    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain("Search request failed: 404")
    // An empty `results` array would read as "no such documentation exists",
    // which is exactly the answer the caller must not trust here.
    expect(result.structuredContent).toBeUndefined()
  })

  it("says when a fetched page is at another path", async () => {
    fetchDocumentationPage.mockResolvedValue({
      path: "examplekit/canvas/draw(in:options:)",
      data: {},
    })
    renderFromJSON.mockResolvedValue(`# draw(in:options:)\n\n${"Draws the canvas. ".repeat(10)}`)

    const { createMcpServer } = await import("../src/lib/mcp")
    createMcpServer()

    const result = (await toolHandlers.get("fetchAppleDocumentation")?.({
      path: "/documentation/examplekit/canvas/draw(in:)",
    })) as { content: Array<{ text: string }> }

    expect(result.content).toHaveLength(2)
    expect(result.content[0].text).toBe(
      "No page exists at /documentation/examplekit/canvas/draw(in:). This is the page at /documentation/examplekit/canvas/draw(in:options:).",
    )
    expect(result.content[1].text).toContain("# draw(in:options:)")
  })

  it("does not add a note when a fetched page is at the requested path", async () => {
    fetchDocumentationPage.mockResolvedValue({ path: "examplekit/canvas", data: {} })
    renderFromJSON.mockResolvedValue(`# Canvas\n\n${"A drawing surface. ".repeat(10)}`)

    const { createMcpServer } = await import("../src/lib/mcp")
    createMcpServer()

    const result = (await toolHandlers.get("fetchAppleDocumentation")?.({
      path: "/documentation/ExampleKit/Canvas/",
    })) as { content: Array<{ text: string }> }

    expect(result.content).toHaveLength(1)
  })

  it.each([
    {
      tool: "fetchAppleDocumentation",
      input: { path: "/documentation/notarealframework" },
      fail: () =>
        fetchDocumentationPage.mockRejectedValue(new Error("Apple documentation page not found")),
    },
    {
      tool: "fetchExternalDocumentation",
      input: { url: "https://example.com/documentation/missing" },
      fail: () =>
        fetchExternalDocumentationMarkdown.mockRejectedValue(
          new Error("External documentation page not found"),
        ),
    },
    {
      tool: "fetchAppleVideoTranscript",
      input: { path: "/videos/play/wwdc2099/1" },
      fail: () => fetchVideoTranscriptMarkdown.mockRejectedValue(new Error("Video not found")),
    },
  ])("reports a $tool failure as a tool error", async ({ tool, input, fail }) => {
    fail()

    const { createMcpServer } = await import("../src/lib/mcp")
    createMcpServer()

    const result = (await toolHandlers.get(tool)?.(input)) as {
      isError?: boolean
      content: Array<{ text: string }>
    }

    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain("not found")
  })
})

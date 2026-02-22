import { beforeEach, describe, expect, it, vi } from "vitest"

const toolHandlers = new Map<string, (input: unknown) => Promise<unknown>>()
const fetchVideoTranscriptMarkdown = vi.fn()

vi.mock("@modelcontextprotocol/sdk/server/mcp.js", () => {
  class McpServerMock {
    registerResource() {}

    registerTool(
      name: string,
      _config: unknown,
      handler: (input: unknown) => Promise<unknown>,
    ): void {
      toolHandlers.set(name, handler)
    }
  }

  class ResourceTemplateMock {}

  return {
    McpServer: McpServerMock,
    ResourceTemplate: ResourceTemplateMock,
  }
})

vi.mock("../src/lib/video", () => ({
  fetchVideoTranscriptMarkdown,
}))

describe("MCP tools registration", () => {
  beforeEach(() => {
    toolHandlers.clear()
    fetchVideoTranscriptMarkdown.mockReset()
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
})

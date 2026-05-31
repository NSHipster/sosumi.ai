import { SELF } from "cloudflare:test"
import { describe, expect, it } from "vitest"

describe("WebMCP", () => {
  it("serves a tool manifest derived from MCP definitions", async () => {
    const response = await SELF.fetch("https://sosumi.ai/webmcp/manifest.json")

    expect(response.status).toBe(200)
    expect(response.headers.get("Content-Type")).toContain("application/json")

    const tools = (await response.json()) as Array<{
      name: string
      inputSchema: { type?: string; properties?: Record<string, unknown> }
    }>

    expect(tools).toHaveLength(4)
    expect(tools.map((tool) => tool.name)).toEqual([
      "searchAppleDocumentation",
      "fetchAppleDocumentation",
      "fetchExternalDocumentation",
      "fetchAppleVideoTranscript",
    ])
    expect(tools[0].inputSchema.type).toBe("object")
    expect(tools[0].inputSchema.properties).toHaveProperty("query")
    expect(tools[1].inputSchema.properties).toHaveProperty("path")
    expect(tools[2].inputSchema.properties).toHaveProperty("url")
  })

  it("serves a static WebMCP bootstrap script", async () => {
    const response = await SELF.fetch("https://sosumi.ai/webmcp.js")

    expect(response.status).toBe(200)

    const script = await response.text()
    expect(script).toContain("registerTool")
    expect(script).toContain("modelContext")
    expect(script).toContain("/webmcp/manifest.json")
  })

  it("includes the WebMCP script on the homepage", async () => {
    const response = await SELF.fetch("https://sosumi.ai/")

    expect(response.status).toBe(200)

    const html = await response.text()
    expect(html).toContain('<script src="/webmcp.js" defer></script>')
  })
})

import { env, SELF } from "cloudflare:test"
import { describe, expect, it } from "vitest"
import { buildWebMcpManifest } from "../src/lib/webmcp"

async function listMcpTools(): Promise<Array<{ name: string; outputSchema?: unknown }>> {
  const response = await SELF.fetch("https://sosumi.ai/mcp", {
    method: "POST",
    headers: {
      Accept: "application/json, text/event-stream",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} }),
  })
  const body = await response.text()
  // The transport can answer with an SSE stream, which carries the JSON-RPC message in a `data:` line.
  const json = body.startsWith("{") ? body : (body.match(/^data: (.*)$/m)?.[1] ?? "")
  return JSON.parse(json).result.tools
}

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

  it("declares the MCP output schema for search, or a tool error", async () => {
    const tools = buildWebMcpManifest()
    const search = tools.find((tool) => tool.name === "searchAppleDocumentation")
    const mcpSearch = (await listMcpTools()).find(
      (tool) => tool.name === "searchAppleDocumentation",
    )
    const { $schema: _, ...mcpOutputSchema } = mcpSearch?.outputSchema as Record<string, unknown>

    expect(search?.outputSchema).toEqual({
      type: "object",
      anyOf: [mcpOutputSchema, expect.objectContaining({ required: ["isError", "content"] })],
    })
  })

  it("declares no output schema for the fetch tools", () => {
    const fetchTools = buildWebMcpManifest().filter((tool) => tool.name.startsWith("fetch"))

    expect(fetchTools).toHaveLength(3)
    for (const tool of fetchTools) {
      expect(tool).not.toHaveProperty("outputSchema")
    }
  })

  it("serves a static WebMCP bootstrap script", async () => {
    // `SELF` dispatches straight to the Worker in the current Workers test pool,
    // so static files are requested through the assets binding
    // the same way the router reaches them in production.
    const response = await env.ASSETS.fetch(new Request("https://sosumi.ai/webmcp.js"))

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

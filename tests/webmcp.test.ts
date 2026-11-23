import { env, SELF } from "cloudflare:test"
import { describe, expect, it, vi } from "vitest"
import { buildWebMcpManifest } from "../src/lib/webmcp"

const searchResponse = {
  query: "SwiftUI",
  results: [
    {
      title: "SwiftUI",
      url: "https://developer.apple.com/documentation/swiftui",
      description: "Declare the user interface and behavior for your app on every platform.",
      breadcrumbs: ["Documentation"],
      tags: ["framework"],
      type: "documentation",
    },
  ],
}

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

interface Registration {
  name: string
  outputSchema?: unknown
  execute: (input: Record<string, unknown>) => Promise<unknown>
}

/** Runs `public/webmcp.js` against a fake `navigator.modelContext` and `fetch`. */
async function loadWebMcpScript(fetchSearch: (url: URL) => Promise<Response>) {
  const asset = await env.ASSETS.fetch(new Request("https://sosumi.ai/webmcp.js"))
  const script = await asset.text()
  const registrations: Registration[] = []
  const navigator = {
    modelContext: { registerTool: (tool: Registration) => registrations.push(tool) },
  }
  const location = { origin: "https://sosumi.ai" }
  const fetch = async (input: string | URL) => {
    const url = new URL(input, location.origin)
    if (url.pathname === "/webmcp/manifest.json") return Response.json(buildWebMcpManifest())
    return await fetchSearch(url)
  }

  new Function("navigator", "document", "fetch", "location", script)(navigator, {}, fetch, location)
  await vi.waitFor(() => expect(registrations).toHaveLength(4))
  return registrations
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

  it("registers search with its output schema and the fetch tools without one", async () => {
    const registrations = await loadWebMcpScript(async () => new Response(null, { status: 500 }))
    const manifest = buildWebMcpManifest()

    expect(registrations.map((tool) => tool.name)).toEqual(manifest.map((tool) => tool.name))
    expect(registrations[0].outputSchema).toEqual(manifest[0].outputSchema)
    for (const tool of registrations.slice(1)) {
      expect(tool).not.toHaveProperty("outputSchema")
    }
  })

  it("resolves a search with the search object", async () => {
    const requests: URL[] = []
    const [search] = await loadWebMcpScript(async (url) => {
      requests.push(url)
      return Response.json(searchResponse)
    })

    const result = await search.execute({ query: "SwiftUI" })

    expect(requests.map((url) => `${url.pathname}${url.search}`)).toEqual(["/search?q=SwiftUI"])
    expect(result).toEqual(searchResponse)
    expect(Object.keys(result as object)).toEqual(["query", "results"])
  })

  it("resolves a failed search with a tool error instead of rejecting", async () => {
    const [search] = await loadWebMcpScript(async () =>
      Response.json(
        { error: "Service temporarily unavailable", message: "Try again." },
        { status: 500 },
      ),
    )

    const result = await search.execute({ query: "SwiftUI" })

    expect(result).toEqual({
      isError: true,
      content: [{ type: "text", text: expect.stringContaining("Service temporarily unavailable") }],
    })
  })

  it("resolves a search that cannot reach Sosumi with a tool error", async () => {
    const [search] = await loadWebMcpScript(async () => {
      throw new TypeError("Failed to fetch")
    })

    await expect(search.execute({ query: "SwiftUI" })).resolves.toEqual({
      isError: true,
      content: [{ type: "text", text: "Request to Sosumi failed: Failed to fetch" }],
    })
  })
})

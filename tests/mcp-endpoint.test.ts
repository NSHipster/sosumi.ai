import { env, SELF } from "cloudflare:test"
import { afterEach, describe, expect, it, vi } from "vitest"
import app from "../src/index"

const MCP_URL = "https://sosumi.ai/mcp"

describe("MCP endpoint", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it.each([
    ["GET", {}],
    ["GET", { Accept: "application/json" }],
    ["GET", { Accept: "text/event-stream" }],
    ["DELETE", {}],
  ])("answers %s %j with 405 and no error log", async (method, headers) => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {})

    const response = await SELF.fetch(MCP_URL, { method, headers })

    expect(response.status).toBe(405)
    expect(response.headers.get("Allow")).toBe("POST")
    expect(response.headers.get("Content-Type")).toContain("application/json")
    expect(await response.json()).toEqual({
      jsonrpc: "2.0",
      error: { code: -32000, message: "Method not allowed." },
      id: null,
    })
    expect(consoleError).not.toHaveBeenCalled()
  })

  it("answers a CORS preflight for POST", async () => {
    const response = await SELF.fetch(MCP_URL, {
      method: "OPTIONS",
      headers: {
        Origin: "https://example.com",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "content-type,mcp-protocol-version",
      },
    })

    expect(response.status).toBe(204)
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*")
    expect(response.headers.get("Access-Control-Allow-Methods")).toContain("POST")
    expect(response.headers.get("Access-Control-Allow-Headers")).toBe(
      "content-type,mcp-protocol-version",
    )
  })

  it("still handles POST requests", async () => {
    const response = await SELF.fetch(MCP_URL, {
      method: "POST",
      headers: {
        Accept: "application/json, text/event-stream",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-06-18",
          capabilities: {},
          clientInfo: { name: "test", version: "1.0.0" },
        },
      }),
    })

    expect(response.status).toBe(200)
    expect(await response.text()).toContain('"serverInfo"')
  })
})

describe("Error logging", () => {
  const originalFetch = global.fetch
  const bindings = { ASSETS: env.ASSETS, NODE_ENV: "production" }

  afterEach(() => {
    global.fetch = originalFetch
    vi.restoreAllMocks()
  })

  it("logs an HTTPException with a 4xx status as a warning", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {})
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {})

    const response = await app.request("https://sosumi.ai/search", undefined, bindings)

    expect(response.status).toBe(400)
    expect(consoleWarn).toHaveBeenCalledOnce()
    expect(consoleError).not.toHaveBeenCalled()
  })

  it("logs a NotFoundError as a warning", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {})
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {})
    global.fetch = vi.fn().mockResolvedValue(new Response("Not Found", { status: 404 }))

    const response = await app.request(
      "https://sosumi.ai/documentation/nonexistentframework",
      { headers: { Accept: "application/json" } },
      bindings,
    )

    expect(response.status).toBe(404)
    expect(consoleWarn).toHaveBeenCalled()
    expect(consoleError).not.toHaveBeenCalled()
  })

  it("logs an HTTPException with a 5xx status as an error", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {})
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {})

    const response = await app.request(
      "https://sosumi.ai/",
      { headers: { Accept: "text/markdown" } },
      {
        ...bindings,
        ASSETS: { fetch: async () => new Response("Not Found", { status: 404 }) },
      },
    )

    expect(response.status).toBe(500)
    expect(consoleError).toHaveBeenCalledOnce()
    expect(consoleWarn).not.toHaveBeenCalled()
  })
})

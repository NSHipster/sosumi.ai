import { env, SELF } from "cloudflare:test"
import { afterEach, describe, expect, it, vi } from "vitest"
import app from "../src/index"
import arrayData from "./fixtures/reference/array.json"

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
  it("logs a 404 for the HIG table of contents as an error", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {})
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {})
    global.fetch = vi.fn().mockResolvedValue(new Response("Not Found", { status: 404 }))

    const response = await app.request(
      "https://sosumi.ai/design/human-interface-guidelines",
      undefined,
      bindings,
    )

    expect(response.status).toBe(404)
    expect(consoleError).toHaveBeenCalledOnce()
    expect(consoleError).toHaveBeenCalledWith(
      "Error occurred:",
      expect.objectContaining({ message: expect.stringContaining("HIG table of contents") }),
    )
    expect(consoleWarn).not.toHaveBeenCalled()
  })

  it("logs one error for an Apple 5xx", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {})
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {})
    global.fetch = vi
      .fn()
      .mockResolvedValue(
        new Response("Service Unavailable", { status: 503, statusText: "Service Unavailable" }),
      )

    const response = await app.request(
      "https://sosumi.ai/documentation/swift",
      { headers: { Accept: "application/json" } },
      bindings,
    )

    expect(response.status).toBe(500)
    expect(consoleError).toHaveBeenCalledOnce()
    expect(consoleError).toHaveBeenCalledWith(
      "Error occurred:",
      expect.objectContaining({ message: "Failed to fetch JSON: 503 Service Unavailable" }),
    )
    expect(consoleWarn).not.toHaveBeenCalled()
  })
})

describe("Error logging for MCP tool calls", () => {
  const originalFetch = global.fetch
  const bindings = { ASSETS: env.ASSETS, NODE_ENV: "production" }

  afterEach(() => {
    global.fetch = originalFetch
    vi.restoreAllMocks()
  })

  function mockApple(pages: Record<string, unknown>) {
    global.fetch = vi.fn().mockImplementation((url: string) => {
      const page = pages[url]
      return Promise.resolve(
        page
          ? new Response(JSON.stringify(page), { status: 200 })
          : new Response("Not Found", { status: 404 }),
      )
    })
  }

  async function fetchAppleDocumentation(path: string): Promise<string> {
    const response = await app.request(
      MCP_URL,
      {
        method: "POST",
        headers: {
          Accept: "application/json, text/event-stream",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "tools/call",
          params: { name: "fetchAppleDocumentation", arguments: { path } },
        }),
      },
      bindings,
    )
    expect(response.status).toBe(200)
    return response.text()
  }

  it("logs one warning and no error for a missing reference page", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {})
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {})
    mockApple({})

    const body = await fetchAppleDocumentation("/documentation/swift/nonexistent")

    expect(body).toContain('"isError":true')
    expect(consoleWarn).toHaveBeenCalledOnce()
    expect(consoleWarn).toHaveBeenCalledWith("Client error occurred:", expect.any(Error))
    expect(consoleError).not.toHaveBeenCalled()
  })

  it("logs one warning and no error for a missing HIG page", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {})
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {})
    mockApple({})

    const body = await fetchAppleDocumentation("/design/human-interface-guidelines/nonexistent")

    expect(body).toContain('"isError":true')
    expect(consoleWarn).toHaveBeenCalledOnce()
    expect(consoleWarn).toHaveBeenCalledWith("Client error occurred:", expect.any(Error))
    expect(consoleError).not.toHaveBeenCalled()
  })

  it.each([
    {
      failure: "an Apple 5xx",
      fail: () =>
        Promise.resolve(
          new Response("Service Unavailable", { status: 503, statusText: "Service Unavailable" }),
        ),
      message: "Failed to fetch JSON: 503 Service Unavailable",
    },
    {
      failure: "a network failure",
      fail: () => Promise.reject(new TypeError("fetch failed")),
      message: "fetch failed",
    },
  ])("logs one error and no warning for $failure", async ({ fail, message }) => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {})
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {})
    global.fetch = vi.fn().mockImplementation(fail)

    const body = await fetchAppleDocumentation("/documentation/swift")

    expect(body).toContain('"isError":true')
    expect(consoleError).toHaveBeenCalledOnce()
    expect(consoleError).toHaveBeenCalledWith(
      "Error occurred:",
      expect.objectContaining({ message }),
    )
    expect(consoleWarn).not.toHaveBeenCalled()
  })

  it("logs nothing when a missing path resolves to a page", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {})
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {})
    const base = "https://developer.apple.com/tutorials/data/documentation"
    mockApple({
      [`${base}/swift.json`]: {
        metadata: { title: "Swift" },
        references: {
          "doc://com.apple.documentation/documentation/Swift/Array": {
            title: "Array",
            url: "/documentation/swift/array-1a2b3",
          },
        },
      },
      [`${base}/swift/array-1a2b3.json`]: arrayData,
    })

    const body = await fetchAppleDocumentation("/documentation/swift/array")

    expect(body).not.toContain('"isError":true')
    expect(body).toContain("No page exists at /documentation/swift/array.")
    expect(consoleWarn).not.toHaveBeenCalled()
    expect(consoleError).not.toHaveBeenCalled()
  })
})

describe("Upstream failures while looking up the parent page", () => {
  const originalFetch = global.fetch
  const bindings = { ASSETS: env.ASSETS, NODE_ENV: "production" }
  // Apple has no page at `swift/array`, so the lookup fetches `swift`.
  const parentURL = "https://developer.apple.com/tutorials/data/documentation/swift.json"

  afterEach(() => {
    global.fetch = originalFetch
    vi.restoreAllMocks()
  })

  const failures = [
    {
      failure: "a 5xx response",
      fail: () =>
        Promise.resolve(
          new Response("Service Unavailable", { status: 503, statusText: "Service Unavailable" }),
        ),
      message: "Failed to fetch JSON: 503 Service Unavailable",
    },
    {
      failure: "a network failure",
      fail: () => Promise.reject(new TypeError("fetch failed")),
      message: "fetch failed",
    },
  ]

  function mockParentFailure(fail: () => Promise<Response>) {
    global.fetch = vi
      .fn()
      .mockImplementation((url: string) =>
        url === parentURL ? fail() : Promise.resolve(new Response("Not Found", { status: 404 })),
      )
  }

  it.each(failures)("answers the HTTP route with 500 for $failure", async ({ fail }) => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {})
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {})
    mockParentFailure(fail)

    const response = await app.request(
      "https://sosumi.ai/documentation/swift/array",
      { headers: { Accept: "application/json" } },
      bindings,
    )

    expect(response.status).toBe(500)
    expect(await response.json()).toMatchObject({ error: "Service temporarily unavailable" })
    expect(consoleError).toHaveBeenCalled()
    expect(consoleWarn).not.toHaveBeenCalled()
  })

  it.each(failures)(
    "reports the upstream failure from fetchAppleDocumentation for $failure",
    async ({ fail, message }) => {
      vi.spyOn(console, "error").mockImplementation(() => {})
      const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {})
      mockParentFailure(fail)

      const response = await app.request(
        MCP_URL,
        {
          method: "POST",
          headers: {
            Accept: "application/json, text/event-stream",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method: "tools/call",
            params: {
              name: "fetchAppleDocumentation",
              arguments: { path: "/documentation/swift/array" },
            },
          }),
        },
        bindings,
      )

      expect(response.status).toBe(200)
      const body = await response.text()
      expect(body).toContain('"isError":true')
      expect(body).toContain(message)
      expect(body).not.toContain("not found")
      expect(consoleWarn).not.toHaveBeenCalled()
    },
  )
})

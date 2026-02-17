import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { fetchExternalDocumentationMarkdown } from "../src/lib/external"

describe("MCP external documentation helper", () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  it("should honor external host blocklist policy", async () => {
    global.fetch = vi.fn()

    await expect(
      fetchExternalDocumentationMarkdown("https://apple.github.io/documentation/argumentparser", {
        EXTERNAL_DOC_HOST_BLOCKLIST: "apple.github.io",
      }),
    ).rejects.toThrow(/blocked by configuration/)

    expect(global.fetch).not.toHaveBeenCalled()
  })

  it("should honor external host allowlist policy", async () => {
    global.fetch = vi.fn()

    await expect(
      fetchExternalDocumentationMarkdown("https://apple.github.io/documentation/argumentparser", {
        EXTERNAL_DOC_HOST_ALLOWLIST: "developer.apple.com",
      }),
    ).rejects.toThrow(/not allowlisted/)

    expect(global.fetch).not.toHaveBeenCalled()
  })

  it("should allow explicitly allowlisted private hosts", async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response("User-agent: *\nAllow: /", { status: 200 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ metadata: { title: "Example" } }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      )

    const markdown = await fetchExternalDocumentationMarkdown(
      "https://127.0.0.1/documentation/example",
      {
        EXTERNAL_DOC_HOST_ALLOWLIST: "127.0.0.1",
      },
    )

    expect(markdown).toContain("# Example")
    expect(global.fetch).toHaveBeenCalledWith("https://127.0.0.1/robots.txt", expect.any(Object))
    expect(global.fetch).toHaveBeenCalledWith(
      "https://127.0.0.1/data/documentation/example.json",
      expect.any(Object),
    )
  })
})

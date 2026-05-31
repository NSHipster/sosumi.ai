import { SELF } from "cloudflare:test"
import { describe, expect, it } from "vitest"

describe("Agent discovery endpoints", () => {
  it("serves an RFC 9727 API catalog", async () => {
    const response = await SELF.fetch("https://sosumi.ai/.well-known/api-catalog")

    expect(response.status).toBe(200)
    expect(response.headers.get("Content-Type")).toContain("application/linkset+json")

    const catalog = (await response.json()) as {
      linkset: Array<{ anchor: string; "service-desc"?: Array<{ href: string }> }>
    }

    expect(Array.isArray(catalog.linkset)).toBe(true)
    expect(catalog.linkset.length).toBeGreaterThan(0)
    expect(catalog.linkset[0].anchor).toMatch(/\/mcp$/)
    expect(catalog.linkset[0]["service-desc"]?.[0].href).toContain(
      "/.well-known/mcp/server-card.json",
    )
  })

  it("serves an MCP server card", async () => {
    const response = await SELF.fetch("https://sosumi.ai/.well-known/mcp/server-card.json")

    expect(response.status).toBe(200)
    expect(response.headers.get("Content-Type")).toContain("application/json")

    const card = (await response.json()) as {
      serverInfo: { name: string; version: string }
      transport: { type: string; endpoint: string }
      capabilities: { tools: Record<string, never> }
    }

    expect(card.serverInfo.name).toBe("sosumi.ai")
    expect(card.transport.endpoint).toMatch(/\/mcp$/)
    expect(card.transport.type).toBe("streamable-http")
    expect(card.capabilities.tools).toEqual({})
  })

  it("includes Link headers on the homepage", async () => {
    const response = await SELF.fetch("https://sosumi.ai/")

    expect(response.status).toBe(200)

    const link = response.headers.get("Link")
    expect(link).toContain('rel="api-catalog"')
    expect(link).toContain("/.well-known/api-catalog")
  })
})

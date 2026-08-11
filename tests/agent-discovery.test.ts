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

  it("serves an A2A agent card", async () => {
    const response = await SELF.fetch("https://sosumi.ai/.well-known/agent-card.json")

    expect(response.status).toBe(200)
    expect(response.headers.get("Content-Type")).toContain("application/json")

    const card = (await response.json()) as {
      name: string
      version: string
      description: string
      supportedInterfaces: Array<{
        url: string
        protocolVersion: string
        protocolBinding: string
        transport: string
      }>
      capabilities: Record<string, unknown>
      skills: Array<{ id: string; name: string; description: string; tags: string[] }>
    }

    expect(card.name).toBe("sosumi.ai")
    expect(card.version).toBeTruthy()
    expect(card.description).toBeTruthy()

    expect(Array.isArray(card.supportedInterfaces)).toBe(true)
    expect(card.supportedInterfaces.length).toBeGreaterThan(0)
    expect(card.supportedInterfaces[0].url).toBe("https://sosumi.ai")
    expect(card.supportedInterfaces[0].protocolVersion).toBeTruthy()
    expect(card.supportedInterfaces[0].protocolBinding).toBe("HTTP+JSON")
    expect(card.supportedInterfaces[0].transport).toBe("HTTP+JSON")

    expect(card.capabilities).toBeTypeOf("object")

    expect(Array.isArray(card.skills)).toBe(true)
    expect(card.skills.length).toBeGreaterThan(0)
    for (const skill of card.skills) {
      expect(skill.id).toBeTruthy()
      expect(skill.name).toBeTruthy()
      expect(skill.description).toBeTruthy()
      expect(Array.isArray(skill.tags)).toBe(true)
    }

    const searchSkill = card.skills.find((skill) => skill.id === "search-apple-documentation")
    expect(searchSkill).toBeDefined()
  })

  it("includes Link headers on the homepage", async () => {
    const response = await SELF.fetch("https://sosumi.ai/")

    expect(response.status).toBe(200)

    const link = response.headers.get("Link")
    expect(link).toContain('rel="api-catalog"')
    expect(link).toContain("/.well-known/api-catalog")
    expect(link).toContain("/.well-known/agent-card.json")
  })
})

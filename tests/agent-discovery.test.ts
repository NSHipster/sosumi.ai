import { env, SELF } from "cloudflare:test"
import { describe, expect, it } from "vitest"
import app from "../src/index"
import { SKILL_NAME } from "../src/lib/skill"

describe("Agent discovery endpoints", () => {
  it("serves a security.txt file with a rolling expiry", async () => {
    const requestedAt = Date.now()
    const response = await SELF.fetch("https://sosumi.ai/.well-known/security.txt")

    expect(response.status).toBe(200)
    expect(response.headers.get("Content-Type")).toContain("text/plain")
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*")
    expect(response.headers.get("Cache-Control")).toBe("public, max-age=300, s-maxage=600")

    const body = await response.text()
    expect(body).toContain("Contact: mailto:info@sosumi.ai")
    expect(body).toContain("Canonical: https://sosumi.ai/.well-known/security.txt")
    expect(body).toContain("Preferred-Languages: en")

    const expires = body.match(/^Expires: (.+)$/m)?.[1]
    expect(expires).toBeDefined()

    const expiresAt = Date.parse(expires ?? "")
    expect(expiresAt).toBeGreaterThan(requestedAt + 363 * 24 * 60 * 60 * 1000)
    expect(expiresAt).toBeLessThan(requestedAt + 365 * 24 * 60 * 60 * 1000)
  })

  it("serves an ARD capability manifest", async () => {
    const response = await SELF.fetch("https://sosumi.ai/.well-known/ai-catalog.json")

    expect(response.status).toBe(200)
    expect(response.headers.get("Content-Type")).toContain("application/ai-catalog+json")
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*")

    const catalog = (await response.json()) as {
      specVersion: string
      host: { displayName: string; identifier: string }
      entries: Array<{
        identifier: string
        displayName: string
        type: string
        url?: string
        data?: unknown
        representativeQueries: string[]
      }>
    }

    expect(catalog.specVersion).toBeTruthy()
    expect(catalog.host).toEqual(
      expect.objectContaining({
        displayName: "sosumi.ai",
        identifier: "did:web:sosumi.ai",
      }),
    )
    expect(catalog.entries).toHaveLength(3)

    for (const entry of catalog.entries) {
      expect(entry.identifier).toMatch(/^urn:air:sosumi\.ai:[a-z0-9-]+:[a-z0-9-]+$/)
      expect(entry.displayName).toBeTruthy()
      expect(entry.type).toMatch(/^[a-z]+\/[a-z0-9.+-]+(?:; .+)?$/i)
      expect(Number("url" in entry) + Number("data" in entry)).toBe(1)
      expect(entry.representativeQueries.length).toBeGreaterThanOrEqual(2)
      expect(entry.representativeQueries.length).toBeLessThanOrEqual(5)
    }

    expect(catalog.entries.map((entry) => entry.type)).toEqual([
      "application/mcp-server-card+json",
      "application/a2a-agent-card+json",
      'text/markdown; profile="urn:air:agent-skills"',
    ])

    const skillEntry = catalog.entries.find((entry) => entry.type.startsWith("text/markdown"))
    expect(skillEntry).toMatchObject({
      identifier: `urn:air:sosumi.ai:skill:${SKILL_NAME}`,
      url: `https://sosumi.ai/.well-known/agent-skills/${SKILL_NAME}/SKILL.md`,
    })
  })

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
    expect(response.headers.get("Content-Usage")).toBe("train-ai=n, search=y")

    const link = response.headers.get("Link")
    expect(link).toContain('rel="api-catalog"')
    expect(link).toContain("/.well-known/api-catalog")
    expect(link).toContain("/.well-known/ai-catalog.json")
    expect(link).toContain("/.well-known/agent-card.json")
    expect(link).toContain('</llms.txt>; rel="alternate"; type="text/markdown"')
    expect(link).toContain('</llms.txt>; rel="describedby"')
  })

  it("describes the site with llms.txt on every response", async () => {
    const response = await SELF.fetch("https://sosumi.ai/.well-known/api-catalog")

    expect(response.status).toBe(200)
    expect(response.headers.get("Link")).toContain('</llms.txt>; rel="describedby"')
  })

  it("preserves Link headers from downstream responses", async () => {
    const canonicalLink = '<https://sosumi.ai/>; rel="canonical"'
    const response = await app.request("https://sosumi.ai/", undefined, {
      ASSETS: {
        fetch: async () => new Response("Homepage", { headers: { Link: canonicalLink } }),
      } as Fetcher,
      NODE_ENV: "production",
    })

    expect(response.status).toBe(200)
    expect(response.headers.get("Link")).toContain(canonicalLink)
    expect(response.headers.get("Link")).toContain('</llms.txt>; rel="describedby"')
  })

  it("advertises content routes as their own Markdown alternate", async () => {
    const paths = ["/videos/play/invalid!/not-a-number", "/external/not-a-url"]

    for (const path of paths) {
      const response = await SELF.fetch(`https://sosumi.ai${path}`)

      expect(response.status).toBe(400)
      expect(response.headers.get("Link")).toContain('</llms.txt>; rel="describedby"')
      expect(response.headers.get("Link")).toContain(
        `<${path}>; rel="alternate"; type="text/markdown"`,
      )
    }
  })

  it("publishes AI content usage preferences in robots.txt", async () => {
    const response = await env.ASSETS.fetch(new Request("https://sosumi.ai/robots.txt"))

    expect(response.status).toBe(200)

    const robots = await response.text()
    expect(robots).toContain("Content-Signal: search=yes, ai-input=yes, ai-train=no")
    expect(robots).toContain("Content-Usage: train-ai=n, search=y")
  })

  it("advertises the ARD manifest in HTML and robots.txt", async () => {
    const [homepageResponse, robotsResponse] = await Promise.all([
      SELF.fetch("https://sosumi.ai/"),
      env.ASSETS.fetch(new Request("https://sosumi.ai/robots.txt")),
    ])

    expect(await homepageResponse.text()).toContain(
      '<link rel="ai-catalog" href="/.well-known/ai-catalog.json" type="application/ai-catalog+json">',
    )
    expect(await robotsResponse.text()).toContain(
      "Agentmap: https://sosumi.ai/.well-known/ai-catalog.json",
    )
  })
})

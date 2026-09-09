import { env, SELF } from "cloudflare:test"
import { describe, expect, it, vi } from "vitest"
import app from "../src/index"
import { buildAiCatalog } from "../src/lib/ard"
import { PUBLISHER_DID, PUBLISHER_DOMAIN, PUBLISHER_ORIGIN } from "../src/lib/identity"
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
    const response = await SELF.fetch("https://sosumi.ai/.well-known/ard.json")

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
        displayName: PUBLISHER_DOMAIN,
        identifier: PUBLISHER_DID,
      }),
    )
    expect(catalog.entries).toHaveLength(2)

    for (const entry of catalog.entries) {
      expect(entry.identifier).toMatch(
        new RegExp(`^urn:air:${PUBLISHER_DOMAIN.replaceAll(".", "\\.")}:[a-z0-9-]+:[a-z0-9-]+$`),
      )
      expect(entry.displayName).toBeTruthy()
      expect(entry.type).toMatch(/^[a-z]+\/[a-z0-9.+-]+(?:; .+)?$/i)
      expect(Number("url" in entry) + Number("data" in entry)).toBe(1)
      expect(entry.representativeQueries.length).toBeGreaterThanOrEqual(2)
      expect(entry.representativeQueries.length).toBeLessThanOrEqual(5)
    }

    expect(catalog.entries.map((entry) => entry.type)).toEqual([
      "application/mcp-server-card+json",
      'text/markdown; profile="urn:air:agent-skills"',
    ])

    const skillEntry = catalog.entries.find((entry) => entry.type.startsWith("text/markdown"))
    expect(skillEntry).toMatchObject({
      identifier: `urn:air:${PUBLISHER_DOMAIN}:skill:${SKILL_NAME}`,
      url: `${PUBLISHER_ORIGIN}/.well-known/agent-skills/${SKILL_NAME}/SKILL.md`,
    })
  })

  it("keeps the predecessor AI catalog path as an alias", async () => {
    const [ardResponse, legacyResponse] = await Promise.all([
      SELF.fetch("https://sosumi.ai/.well-known/ard.json"),
      SELF.fetch("https://sosumi.ai/.well-known/ai-catalog.json"),
    ])

    expect(legacyResponse.status).toBe(200)
    expect(await legacyResponse.json()).toEqual(await ardResponse.json())
  })

  it("keeps publisher identity stable across catalog locations", () => {
    const catalog = buildAiCatalog("https://preview.example.com")

    expect(catalog.host.identifier).toBe(PUBLISHER_DID)
    for (const entry of catalog.entries) {
      expect(entry.identifier.startsWith(`urn:air:${PUBLISHER_DOMAIN}:`)).toBe(true)
      expect(entry.url).toMatch(/^https:\/\/preview\.example\.com\//)
    }
  })

  it("serves a verifiable did:web document", async () => {
    const [didResponse, directoryResponse] = await Promise.all([
      SELF.fetch(`${PUBLISHER_ORIGIN}/.well-known/did.json`),
      SELF.fetch(`${PUBLISHER_ORIGIN}/.well-known/http-message-signatures-directory`),
    ])

    expect(didResponse.status).toBe(200)
    expect(didResponse.headers.get("Content-Type")).toContain("application/did+ld+json")
    expect(didResponse.headers.get("Access-Control-Allow-Origin")).toBe("*")

    const did = (await didResponse.json()) as {
      "@context": string[]
      id: string
      alsoKnownAs: string[]
      verificationMethod: Array<{
        id: string
        type: string
        controller: string
        publicKeyJwk: Record<string, string>
      }>
      authentication: string[]
      assertionMethod: string[]
    }
    const directory = (await directoryResponse.json()) as {
      keys: Array<Record<string, string>>
    }
    const verificationMethod = did.verificationMethod[0]
    const publishedKey = directory.keys[0]

    expect(did["@context"]).toContain("https://www.w3.org/ns/did/v1")
    expect(did.id).toBe(PUBLISHER_DID)
    expect(did.alsoKnownAs).toContain(PUBLISHER_ORIGIN)
    expect(verificationMethod).toMatchObject({
      id: `${PUBLISHER_DID}#${publishedKey.kid}`,
      type: "JsonWebKey2020",
      controller: PUBLISHER_DID,
      publicKeyJwk: {
        kty: publishedKey.kty,
        crv: publishedKey.crv,
        x: publishedKey.x,
        kid: publishedKey.kid,
      },
    })
    expect(verificationMethod.publicKeyJwk).not.toHaveProperty("d")
    expect(did.authentication).toContain(verificationMethod.id)
    expect(did.assertionMethod).toContain(verificationMethod.id)
  })

  it("does not publish a DID document without a valid signing key", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {})

    try {
      const bindings = {
        ASSETS: env.ASSETS,
        NODE_ENV: "production",
      }
      const [missingKeyResponse, invalidKeyResponse] = await Promise.all([
        app.request(`${PUBLISHER_ORIGIN}/.well-known/did.json`, undefined, bindings),
        app.request(`${PUBLISHER_ORIGIN}/.well-known/did.json`, undefined, {
          ...bindings,
          WEB_BOT_AUTH_KEY: "not-json",
        }),
      ])

      expect(missingKeyResponse.status).toBe(404)
      expect(invalidKeyResponse.status).toBe(404)
      expect(missingKeyResponse.headers.get("Cache-Control")).toBe("no-store")
      expect(invalidKeyResponse.headers.get("Cache-Control")).toBe("no-store")
    } finally {
      consoleError.mockRestore()
    }
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
    expect(link).toContain('</.well-known/ard.json>; rel="ard"')
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

    const homepage = await homepageResponse.text()
    expect(homepage).toContain('<link rel="ard" href="/.well-known/ard.json"')
    expect(homepage).toContain('<link rel="ai-catalog" href="/.well-known/ai-catalog.json"')
    expect(await robotsResponse.text()).toContain(
      "Agentmap: https://sosumi.ai/.well-known/ard.json",
    )
  })
})

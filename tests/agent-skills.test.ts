import { SELF } from "cloudflare:test"
import { describe, expect, it } from "vitest"

describe("Agent Skills discovery", () => {
  const indexUrl = "https://sosumi.ai/.well-known/agent-skills/index.json"
  const skillUrl = "https://sosumi.ai/.well-known/agent-skills/sosumi/SKILL.md"

  it("serves a v0.2.0 discovery index", async () => {
    const response = await SELF.fetch(indexUrl)

    expect(response.status).toBe(200)
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*")
    expect(response.headers.get("Content-Type")).toContain("application/json")

    const index = (await response.json()) as {
      $schema: string
      skills: Array<{
        name: string
        type: string
        description: string
        url: string
        digest: string
        files: string[]
      }>
    }

    expect(index.$schema).toBe("https://schemas.agentskills.io/discovery/0.2.0/schema.json")
    expect(index.skills).toHaveLength(1)
    expect(index.skills[0]).toMatchObject({
      name: "sosumi",
      type: "skill-md",
      description:
        "Fetches Apple documentation as Markdown via Sosumi. Use for Apple API reference, Human Interface Guidelines, WWDC transcripts, and external Swift-DocC pages.",
      url: "/.well-known/agent-skills/sosumi/SKILL.md",
      files: ["SKILL.md"],
    })
    expect(index.skills[0].digest).toMatch(/^sha256:[a-f0-9]{64}$/)
  })

  it("serves the canonical SKILL.md artifact", async () => {
    const response = await SELF.fetch(skillUrl)
    const markdown = await response.text()

    expect(response.status).toBe(200)
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*")
    expect(response.headers.get("Content-Type")).toContain("text/markdown")
    expect(markdown).toContain("name: sosumi")
    expect(markdown).toContain("# Sosumi Skill")
  })

  it("indexes the digest for the served SKILL.md bytes", async () => {
    const [indexResponse, skillResponse] = await Promise.all([
      SELF.fetch(indexUrl),
      SELF.fetch(skillUrl),
    ])

    const index = (await indexResponse.json()) as { skills: Array<{ digest: string }> }
    const skillBytes = await skillResponse.arrayBuffer()
    const digest = await crypto.subtle.digest("SHA-256", skillBytes)
    const hexDigest = [...new Uint8Array(digest)]
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("")

    expect(index.skills[0].digest).toBe(`sha256:${hexDigest}`)
  })

  it("supports HEAD requests", async () => {
    const [indexResponse, skillResponse] = await Promise.all([
      SELF.fetch(indexUrl, { method: "HEAD" }),
      SELF.fetch(skillUrl, { method: "HEAD" }),
    ])

    expect(indexResponse.status).toBe(200)
    expect(indexResponse.headers.get("Content-Type")).toContain("application/json")
    expect(await indexResponse.text()).toBe("")

    expect(skillResponse.status).toBe(200)
    expect(skillResponse.headers.get("Content-Type")).toContain("text/markdown")
    expect(await skillResponse.text()).toBe("")
  })

  it("returns 404 for missing discovery artifacts", async () => {
    const [missingSkillResponse, missingFileResponse] = await Promise.all([
      SELF.fetch("https://sosumi.ai/.well-known/agent-skills/missing/SKILL.md"),
      SELF.fetch("https://sosumi.ai/.well-known/agent-skills/sosumi/NOPE.md"),
    ])

    expect(missingSkillResponse.status).toBe(404)
    expect(missingFileResponse.status).toBe(404)
  })
})

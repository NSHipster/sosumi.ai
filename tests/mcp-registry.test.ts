import { env, SELF } from "cloudflare:test"
import { describe, expect, it } from "vitest"
import packageJson from "../package.json"
import serverJson from "../server.json"
import app from "../src/index"
import wranglerConfig from "../wrangler.jsonc?raw"

// The public key from RFC 8032 section 7.1, test 1, in base64.
const TEST_PUBLIC_KEY = "11qYAYKxCrfVS/7TyWQHOg7hcvPaYiMlrwIaaPcHURo="
const AUTH_URL = "https://sosumi.ai/.well-known/mcp-registry-auth"

function bindings(publicKey?: string) {
  return {
    ASSETS: env.ASSETS,
    NODE_ENV: "production",
    MCP_REGISTRY_PUBLIC_KEY: publicKey,
  }
}

describe("MCP Registry server.json", () => {
  it("has the same version as package.json", () => {
    expect(serverJson.version).toBe(packageJson.version)
  })

  it("lists the remote Streamable HTTP endpoint", () => {
    expect(serverJson.name).toBe("ai.sosumi/sosumi")
    expect(serverJson.description.length).toBeLessThanOrEqual(100)
    expect(serverJson.remotes).toEqual([{ type: "streamable-http", url: "https://sosumi.ai/mcp" }])
  })
})

describe("MCP Registry HTTP authentication", () => {
  it("returns 404 when no public key is configured", async () => {
    const response = await SELF.fetch(AUTH_URL, { redirect: "manual" })

    expect(response.status).toBe(404)
    expect(response.headers.get("Location")).toBeNull()
  })

  it("returns 404 when the public key is blank", async () => {
    const response = await app.request(AUTH_URL, undefined, bindings("  \n"))

    expect(response.status).toBe(404)
  })

  it("serves the proof record as plain text", async () => {
    const response = await app.request(
      AUTH_URL,
      { headers: { Accept: "text/plain", "User-Agent": "mcp-registry/1.0" } },
      bindings(`${TEST_PUBLIC_KEY}\n`),
    )

    expect(response.status).toBe(200)
    expect(response.headers.get("Content-Type")).toBe("text/plain; charset=utf-8")
    expect(response.headers.get("Location")).toBeNull()
    expect(await response.text()).toBe(`v=MCPv1; k=ed25519; p=${TEST_PUBLIC_KEY}`)
  })

  it("answers HEAD requests without a body", async () => {
    const response = await app.request(AUTH_URL, { method: "HEAD" }, bindings(TEST_PUBLIC_KEY))

    expect(response.status).toBe(200)
    expect(await response.text()).toBe("")
  })

  it("runs the Worker before static assets for the proof path", () => {
    expect(wranglerConfig).toContain('"/.well-known/mcp-registry-auth"')
  })
})

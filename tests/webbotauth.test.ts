import { SELF } from "cloudflare:test"
import { beforeEach, describe, expect, it } from "vitest"
import { verify } from "web-bot-auth"
import { verifierFromJWK } from "web-bot-auth/crypto"
import {
  configureWebBotAuth,
  DIRECTORY_MEDIA_TYPE,
  webBotAuthDirectory,
  webBotAuthHeaders,
} from "../src/lib/webbotauth"

// The published RFC 9421 Appendix B.1.4 `test-key-ed25519` vector.
// Mirrors the JWK configured as WEB_BOT_AUTH_KEY in vitest.config.ts.
const TEST_PRIVATE_JWK = {
  kty: "OKP",
  crv: "Ed25519",
  x: "JrQLj5P_89iXES9-vFgrIy29clF9CC_oPPsw3c5D0bs",
  d: "n4Ni-HpISpVObnQMW0wOhCKROaIKqKtW_2ZYb2p9KcU",
}
const TEST_PUBLIC_JWK = {
  kty: TEST_PRIVATE_JWK.kty,
  crv: TEST_PRIVATE_JWK.crv,
  x: TEST_PRIVATE_JWK.x,
}

describe("Web Bot Auth key directory", () => {
  it("serves a signed JWKS at the well-known path", async () => {
    const response = await SELF.fetch(
      "https://sosumi.ai/.well-known/http-message-signatures-directory",
    )

    expect(response.status).toBe(200)
    expect(response.headers.get("Content-Type")).toContain(
      "application/http-message-signatures-directory+json",
    )

    const directory = (await response.json()) as { keys: Array<Record<string, unknown>> }
    expect(Array.isArray(directory.keys)).toBe(true)
    expect(directory.keys.length).toBeGreaterThan(0)

    const [key] = directory.keys
    expect(key.kty).toBe("OKP")
    expect(key.crv).toBe("Ed25519")
    expect(typeof key.x).toBe("string")
    expect(typeof key.kid).toBe("string")
    // Never publish private key material.
    expect(key.d).toBeUndefined()

    // The directory response signs over itself.
    expect(response.headers.get("Signature")).toBeTruthy()
    expect(response.headers.get("Signature-Input")).toContain(
      'tag="http-message-signatures-directory"',
    )
  })

  it("builds a directory whose kid matches the published key", async () => {
    configureWebBotAuth({ WEB_BOT_AUTH_KEY: JSON.stringify(TEST_PRIVATE_JWK) })

    const directory = await webBotAuthDirectory(
      "https://sosumi.ai/.well-known/http-message-signatures-directory",
    )
    expect(directory).not.toBeNull()
    expect(directory?.headers["Content-Type"]).toBe(DIRECTORY_MEDIA_TYPE)

    const key = directory?.body.keys[0]
    expect(key?.x).toBe(TEST_PRIVATE_JWK.x)
    expect(key?.kid).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(key).not.toHaveProperty("d")
  })

  it("returns null when no signing key is configured", async () => {
    configureWebBotAuth({})
    expect(await webBotAuthDirectory("https://sosumi.ai/")).toBeNull()
  })
})

describe("Web Bot Auth request signing", () => {
  beforeEach(() => {
    configureWebBotAuth({ WEB_BOT_AUTH_KEY: JSON.stringify(TEST_PRIVATE_JWK) })
  })

  it("produces verifiable Signature headers for an outbound request", async () => {
    const url = "https://developer.apple.com/tutorials/data/documentation/swift.json"
    const headers = await webBotAuthHeaders("GET", url)

    expect(headers["Signature-Agent"]).toBe('"https://sosumi.ai"')
    expect(headers["Signature-Input"]).toContain('"@authority"')
    expect(headers["Signature-Input"]).toContain('"signature-agent"')
    expect(headers["Signature-Input"]).toContain('alg="ed25519"')
    expect(headers["Signature-Input"]).toContain('tag="web-bot-auth"')
    expect(headers["Signature-Input"]).toMatch(/keyid="[A-Za-z0-9_-]+"/)
    expect(headers.Signature).toMatch(/^sig1=:.+:$/)

    // A receiving site reconstructs the request
    // and verifies the signature with the public key from the directory.
    const message = { method: "GET", url, headers: new Headers(headers) }
    await expect(verify(message, await verifierFromJWK(TEST_PUBLIC_JWK))).resolves.not.toThrow()
  })

  it("uses a configurable signature agent", async () => {
    configureWebBotAuth({
      WEB_BOT_AUTH_KEY: JSON.stringify(TEST_PRIVATE_JWK),
      SIGNATURE_AGENT: "https://docs.example.com",
    })

    const headers = await webBotAuthHeaders("GET", "https://example.com/data.json")
    expect(headers["Signature-Agent"]).toBe('"https://docs.example.com"')
  })

  it("returns no headers when no signing key is configured", async () => {
    configureWebBotAuth({})
    expect(await webBotAuthHeaders("GET", "https://example.com/data.json")).toEqual({})
  })
})

describe("Web Bot Auth configuration validation", () => {
  it("fails closed on a key missing the private `d` parameter", async () => {
    // A public-only JWK cannot sign, so it must not be published or used.
    configureWebBotAuth({ WEB_BOT_AUTH_KEY: JSON.stringify(TEST_PUBLIC_JWK) })
    expect(await webBotAuthDirectory("https://sosumi.ai/")).toBeNull()
    expect(await webBotAuthHeaders("GET", "https://example.com/data.json")).toEqual({})
  })

  it("fails closed on a non-Ed25519 key", async () => {
    configureWebBotAuth({
      WEB_BOT_AUTH_KEY: JSON.stringify({ ...TEST_PRIVATE_JWK, crv: "X25519" }),
    })
    expect(await webBotAuthDirectory("https://sosumi.ai/")).toBeNull()
  })

  it("fails closed on malformed JSON", async () => {
    configureWebBotAuth({ WEB_BOT_AUTH_KEY: "not-json" })
    expect(await webBotAuthHeaders("GET", "https://example.com/data.json")).toEqual({})
  })

  it("recovers once a valid key is configured after a bad one", async () => {
    configureWebBotAuth({ WEB_BOT_AUTH_KEY: "not-json" })
    expect(await webBotAuthHeaders("GET", "https://example.com/data.json")).toEqual({})

    configureWebBotAuth({ WEB_BOT_AUTH_KEY: JSON.stringify(TEST_PRIVATE_JWK) })
    const headers = await webBotAuthHeaders("GET", "https://example.com/data.json")
    expect(headers.Signature).toBeTruthy()
  })
})

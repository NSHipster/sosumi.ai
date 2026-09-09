import { env } from "cloudflare:test"
import { afterEach, describe, expect, it, vi } from "vitest"
import app from "../src/index"
import {
  A2A_MEDIA_TYPE,
  A2A_PROTOCOL_VERSION,
  type A2AMessageResponse,
  handleA2AMessage,
  resolveA2AEndpoint,
  validateA2ARequestHeaders,
} from "../src/lib/a2a"

const originalFetch = globalThis.fetch

function userMessage(text: string, extra: Record<string, unknown> = {}) {
  return {
    message: {
      messageId: "client-message-1",
      role: "ROLE_USER",
      parts: [{ text, mediaType: "text/plain" }],
      ...extra,
    },
  }
}

afterEach(() => {
  vi.restoreAllMocks()
  globalThis.fetch = originalFetch
})

describe("A2A HTTP+JSON service", () => {
  it("routes fetch prompts to an existing documentation capability", async () => {
    const invoke = vi.fn(async () => "# View\n\nSwiftUI view documentation.")

    const result = await handleA2AMessage(
      {
        ...userMessage("Fetch /documentation/swiftui/view as Markdown"),
        configuration: { acceptedOutputModes: ["text/markdown"] },
      },
      invoke,
    )

    expect(invoke).toHaveBeenCalledWith("/documentation/swiftui/view", "text/markdown")
    expect(result.message).toMatchObject({
      role: "ROLE_AGENT",
      parts: [{ text: expect.stringContaining("SwiftUI"), mediaType: "text/markdown" }],
    })
    expect(result.message.messageId).toBeTruthy()
    expect(result.message.contextId).toBeTruthy()
  })

  it("preserves context and honors text/plain output negotiation", async () => {
    const result = await handleA2AMessage(
      {
        ...userMessage("Find Apple documentation about Swift actors", {
          contextId: "conversation-1",
        }),
        configuration: { acceptedOutputModes: ["text/plain"] },
      },
      async () => "Search results",
    )

    expect(result.message.contextId).toBe("conversation-1")
    expect(result.message.parts[0]?.mediaType).toBe("text/plain")
  })

  it("normalizes natural-language searches and supported fetch targets", () => {
    expect(resolveA2AEndpoint("Search Apple Developer documentation for URLSession")).toBe(
      "/search?q=URLSession",
    )
    expect(
      resolveA2AEndpoint("Read https://developer.apple.com/videos/play/wwdc2021/10133/ for me."),
    ).toBe("/videos/play/wwdc2021/10133")
  })

  it("requires the protocol version advertised by the Agent Card", () => {
    expect(() => validateA2ARequestHeaders(A2A_MEDIA_TYPE, A2A_PROTOCOL_VERSION)).not.toThrow()
    expect(() => validateA2ARequestHeaders(A2A_MEDIA_TYPE, null)).toThrow(
      expect.objectContaining({ reason: "VERSION_NOT_SUPPORTED" }),
    )
  })

  it("executes search messages through POST /message:send", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          kind: "quickSearch",
          response: {
            results: [
              {
                metadata: {
                  title: "URLSession",
                  permalink: "https://developer.apple.com/documentation/foundation/urlsession",
                  description: "An object that coordinates network data transfer tasks.",
                  hierarchy: "Foundation > URLSession",
                  kind: "class",
                  metadataKind: "documentation",
                },
              },
            ],
          },
        }),
        { headers: { "Content-Type": "application/jsonl" } },
      ),
    )

    const response = await app.request(
      "https://sosumi.ai/message:send",
      {
        method: "POST",
        headers: {
          "A2A-Version": A2A_PROTOCOL_VERSION,
          "Content-Type": A2A_MEDIA_TYPE,
        },
        body: JSON.stringify(userMessage("Search Apple Developer documentation for URLSession")),
      },
      { ASSETS: env.ASSETS, NODE_ENV: "development" },
    )

    expect(response.status).toBe(200)
    expect(response.headers.get("Content-Type")).toContain(A2A_MEDIA_TYPE)
    expect(response.headers.get("Cache-Control")).toBe("no-store")

    const body = (await response.json()) as A2AMessageResponse
    expect(body.message.role).toBe("ROLE_AGENT")
    expect(body.message.parts[0]).toMatchObject({
      mediaType: "text/markdown",
      text: expect.stringContaining(
        "https://developer.apple.com/documentation/foundation/urlsession",
      ),
    })
  })

  it("returns protocol errors for malformed requests", async () => {
    const [missingVersion, malformedJson] = await Promise.all([
      app.request(
        "https://sosumi.ai/message:send",
        {
          method: "POST",
          headers: { "Content-Type": A2A_MEDIA_TYPE },
          body: JSON.stringify(userMessage("Search for SwiftUI")),
        },
        { ASSETS: env.ASSETS, NODE_ENV: "development" },
      ),
      app.request(
        "https://sosumi.ai/message:send",
        {
          method: "POST",
          headers: {
            "A2A-Version": A2A_PROTOCOL_VERSION,
            "Content-Type": A2A_MEDIA_TYPE,
          },
          body: "{",
        },
        { ASSETS: env.ASSETS, NODE_ENV: "development" },
      ),
    ])

    expect(missingVersion.status).toBe(400)
    expect(malformedJson.status).toBe(400)

    const missingVersionBody = (await missingVersion.json()) as {
      error: { details: Array<{ reason: string }> }
    }
    const malformedJsonBody = (await malformedJson.json()) as {
      error: { code: number; details: Array<{ reason: string }> }
    }
    expect(missingVersionBody.error.details[0]?.reason).toBe("VERSION_NOT_SUPPORTED")
    expect(malformedJsonBody.error.code).toBe(400)
    expect(malformedJsonBody.error.details[0]?.reason).toBe("REQUEST_MALFORMED")
  })
})

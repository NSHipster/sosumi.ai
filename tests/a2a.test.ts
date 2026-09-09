import { env } from "cloudflare:test"
import { afterEach, describe, expect, it, vi } from "vitest"
import app from "../src/index"
import {
  A2A_MAX_REQUEST_BYTES,
  A2A_MAX_RESPONSE_BYTES,
  A2A_MEDIA_TYPE,
  A2A_PROTOCOL_VERSION,
  type A2AMessageResponse,
  capabilityError,
  handleA2AMessage,
  readA2ACapabilityText,
  resolveA2AEndpoint,
  validateA2ARequestHeaders,
} from "../src/lib/a2a"
import { decodeExternalTargetPath, validateExternalDocumentationUrl } from "../src/lib/external"

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

  it("preserves context for Markdown responses", async () => {
    const result = await handleA2AMessage(
      {
        ...userMessage("Find Apple documentation about Swift actors", {
          contextId: "conversation-1",
        }),
        configuration: { acceptedOutputModes: ["text/markdown"] },
      },
      async () => "Search results",
    )

    expect(result.message.contextId).toBe("conversation-1")
    expect(result.message.parts[0]?.mediaType).toBe("text/markdown")
  })

  it("rejects plain-only output negotiation instead of mislabeling Markdown", async () => {
    const response = await app.request(
      "https://sosumi.ai/message:send",
      {
        method: "POST",
        headers: {
          "A2A-Version": A2A_PROTOCOL_VERSION,
          "Content-Type": A2A_MEDIA_TYPE,
        },
        body: JSON.stringify({
          ...userMessage("Fetch /documentation/swiftui/view"),
          configuration: { acceptedOutputModes: ["text/plain"] },
        }),
      },
      { ASSETS: env.ASSETS, NODE_ENV: "development" },
    )

    expect(response.status).toBe(400)
    const body = (await response.json()) as {
      error: { details: Array<{ reason: string }> }
    }
    expect(body.error.details[0]?.reason).toBe("CONTENT_TYPE_NOT_SUPPORTED")
  })

  it("normalizes natural-language searches and supported fetch targets", () => {
    expect(resolveA2AEndpoint("Search Apple Developer documentation for URLSession")).toBe(
      "/search?q=URLSession",
    )
    expect(
      resolveA2AEndpoint("Read https://developer.apple.com/videos/play/wwdc2021/10133/ for me."),
    ).toBe("/videos/play/wwdc2021/10133")

    const externalTarget =
      "https://apple.github.io/swift-argument-parser/documentation/argumentparser?language=swift#overview"
    const externalEndpoint = resolveA2AEndpoint(`Fetch ${externalTarget}`)
    const internalUrl = new URL(externalEndpoint, "https://sosumi.ai")
    expect(internalUrl.search).toBe("")
    expect(internalUrl.hash).toBe("")
    const decodedTarget = decodeExternalTargetPath(internalUrl.pathname)
    expect(decodedTarget).toBe(externalTarget.replace("#overview", ""))
    expect(validateExternalDocumentationUrl(decodedTarget).search).toBe("?language=swift")
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
      error: { code: number; status: string; details: unknown[] }
    }
    expect(missingVersionBody.error.details[0]?.reason).toBe("VERSION_NOT_SUPPORTED")
    expect(malformedJsonBody.error.code).toBe(400)
    expect(malformedJsonBody.error.status).toBe("INVALID_ARGUMENT")
    expect(malformedJsonBody.error.details).toEqual([])
  })

  it("validates the complete SendMessage request before invoking a capability", async () => {
    const invoke = vi.fn(async () => "Unexpected")
    const valid = userMessage("Search for SwiftUI")
    const malformedRequests = [
      { ...valid, tenant: 42 },
      { ...valid, metadata: [] },
      { ...valid, configuration: { returnImmediately: "yes" } },
      { ...valid, message: { ...valid.message, metadata: [] } },
      { ...valid, message: { ...valid.message, parts: [{ text: "SwiftUI", extra: true }] } },
    ]

    for (const request of malformedRequests) {
      await expect(handleA2AMessage(request, invoke)).rejects.toMatchObject({
        statusCode: 400,
        status: "INVALID_ARGUMENT",
      })
    }
    expect(invoke).not.toHaveBeenCalled()
  })

  it("enforces the protobuf int32 range for SendMessage history length", async () => {
    await expect(
      handleA2AMessage(
        {
          ...userMessage("Search for SwiftUI"),
          configuration: { historyLength: "2147483647" },
        },
        async () => "Results",
      ),
    ).resolves.toBeTruthy()

    await expect(
      handleA2AMessage(
        {
          ...userMessage("Search for SwiftUI"),
          configuration: { historyLength: 2_147_483_648 },
        },
        async () => "Unexpected",
      ),
    ).rejects.toMatchObject({ statusCode: 400, status: "INVALID_ARGUMENT" })
  })

  it("rejects oversized request bodies before parsing them", async () => {
    const response = await app.request(
      "https://sosumi.ai/message:send",
      {
        method: "POST",
        headers: {
          "A2A-Version": A2A_PROTOCOL_VERSION,
          "Content-Type": A2A_MEDIA_TYPE,
        },
        body: JSON.stringify(userMessage("x".repeat(A2A_MAX_REQUEST_BYTES))),
      },
      { ASSETS: env.ASSETS, NODE_ENV: "development" },
    )

    expect(response.status).toBe(413)
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 413, status: "RESOURCE_EXHAUSTED" },
    })
  })

  it("serves the stateless task surface with A2A protocol responses", async () => {
    const headers = { "A2A-Version": A2A_PROTOCOL_VERSION }
    const bindings = { ASSETS: env.ASSETS, NODE_ENV: "development" }
    const [list, missing, cancel, stream, subscribe, push, extended] = await Promise.all([
      app.request("https://sosumi.ai/tasks", { headers }, bindings),
      app.request("https://sosumi.ai/tasks/missing", { headers }, bindings),
      app.request(
        "https://sosumi.ai/tasks/missing:cancel",
        { method: "POST", headers: { ...headers, "Content-Type": A2A_MEDIA_TYPE } },
        bindings,
      ),
      app.request(
        "https://sosumi.ai/message:stream",
        { method: "POST", headers: { ...headers, "Content-Type": A2A_MEDIA_TYPE } },
        bindings,
      ),
      app.request("https://sosumi.ai/tasks/missing:subscribe", { headers }, bindings),
      app.request(
        "https://sosumi.ai/tasks/missing/pushNotificationConfigs",
        { method: "POST", headers: { ...headers, "Content-Type": A2A_MEDIA_TYPE } },
        bindings,
      ),
      app.request("https://sosumi.ai/extendedAgentCard", { headers }, bindings),
    ])

    expect(await list.json()).toEqual({
      tasks: [],
      nextPageToken: "",
      pageSize: 50,
      totalSize: 0,
    })
    expect(missing.status).toBe(404)

    const reasons = await Promise.all(
      [missing, cancel, stream, subscribe, push, extended].map(async (response) => {
        expect(response.headers.get("Content-Type")).toContain(A2A_MEDIA_TYPE)
        const body = (await response.json()) as {
          error: { details: Array<{ reason: string }> }
        }
        return body.error.details[0]?.reason
      }),
    )
    expect(reasons).toEqual([
      "TASK_NOT_FOUND",
      "TASK_NOT_FOUND",
      "UNSUPPORTED_OPERATION",
      "UNSUPPORTED_OPERATION",
      "PUSH_NOTIFICATION_NOT_SUPPORTED",
      "UNSUPPORTED_OPERATION",
    ])
  })

  it("validates and reports the ListTasks page size", async () => {
    const headers = { "A2A-Version": A2A_PROTOCOL_VERSION }
    const bindings = { ASSETS: env.ASSETS, NODE_ENV: "development" }
    const [selected, validTimestamp, tooSmall, tooLarge, malformed, historyOverflow, invalidDate] =
      await Promise.all([
        app.request("https://sosumi.ai/tasks?pageSize=10", { headers }, bindings),
        app.request(
          "https://sosumi.ai/tasks?historyLength=2147483647&statusTimestampAfter=2025-01-01T01%3A00%3A00%2B01%3A00",
          { headers },
          bindings,
        ),
        app.request("https://sosumi.ai/tasks?pageSize=0", { headers }, bindings),
        app.request("https://sosumi.ai/tasks?pageSize=101", { headers }, bindings),
        app.request("https://sosumi.ai/tasks?pageSize=ten", { headers }, bindings),
        app.request("https://sosumi.ai/tasks?historyLength=2147483648", { headers }, bindings),
        app.request(
          "https://sosumi.ai/tasks?statusTimestampAfter=2025-02-30T00%3A00%3A00Z",
          { headers },
          bindings,
        ),
      ])

    await expect(selected.json()).resolves.toMatchObject({ pageSize: 10, totalSize: 0 })
    expect(validTimestamp.status).toBe(200)
    for (const response of [tooSmall, tooLarge, malformed, historyOverflow, invalidDate]) {
      expect(response.status).toBe(400)
      await expect(response.json()).resolves.toMatchObject({
        error: { code: 400, status: "INVALID_ARGUMENT" },
      })
    }
  })

  it("maps unavailable capability failures to HTTP 503", () => {
    expect(capabilityError(502, "upstream failed")).toMatchObject({
      statusCode: 503,
      status: "UNAVAILABLE",
    })
  })

  it("rejects capability output declared above the response limit", async () => {
    const response = new Response("small", {
      headers: { "Content-Length": String(A2A_MAX_RESPONSE_BYTES + 1) },
    })
    await expect(readA2ACapabilityText(response)).rejects.toMatchObject({
      statusCode: 503,
      status: "UNAVAILABLE",
    })
  })
})

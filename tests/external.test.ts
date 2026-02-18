import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { fetchExternalDocCJSON } from "../src/lib/external"
import { EXTERNAL_DOC_USER_AGENT } from "../src/lib/external/fetch"
import {
  assertExternalDocumentationAccess,
  decodeExternalTargetPath,
  ExternalAccessError,
  validateExternalDocumentationUrl,
} from "../src/lib/external/policy"
import { renderFromJSON } from "../src/lib/reference"

describe("External Swift-DocC support", () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  it("should reject non-https external URLs", () => {
    expect(() =>
      validateExternalDocumentationUrl(
        "http://apple.github.io/swift-argument-parser/documentation/argumentparser",
      ),
    ).toThrow(/Only https/)
  })

  it("should reject malformed percent-encoded external paths", () => {
    expect(() => decodeExternalTargetPath("/external/%E0%A4%A")).toThrow(/Invalid external URL/)
  })

  it("should reject non-/external/* paths when decoding targets", () => {
    expect(() => decodeExternalTargetPath("/documentation/swift")).toThrow(/Invalid external URL/)
  })

  it("should reject empty /external/ targets", () => {
    expect(() => decodeExternalTargetPath("/external/")).toThrow(/Invalid external URL/)
  })

  it("should reject control characters and whitespace in external URLs", () => {
    expect(() =>
      validateExternalDocumentationUrl(" https://apple.github.io/documentation/argumentparser"),
    ).toThrow(/Invalid external URL/)
    expect(() =>
      validateExternalDocumentationUrl("https://apple.github.io/documentation/argumentparser\n"),
    ).toThrow(/Invalid external URL/)
  })

  it("should reject fragment identifiers in external URLs", () => {
    expect(() =>
      validateExternalDocumentationUrl(
        "https://apple.github.io/swift-argument-parser/documentation/argumentparser#section",
      ),
    ).toThrow(/fragments are not supported/i)
  })

  it("should decode valid percent-encoded external targets", () => {
    const decoded = decodeExternalTargetPath(
      "/external/https%3A%2F%2Fapple.github.io%2Fswift-argument-parser%2Fdocumentation%2Fargumentparser%3Fid%3D1",
    )
    expect(decoded).toBe(
      "https://apple.github.io/swift-argument-parser/documentation/argumentparser?id=1",
    )
  })

  it("should reject encoded control characters in /external/* targets", () => {
    expect(() =>
      decodeExternalTargetPath(
        "/external/https%3A%2F%2Fapple.github.io%2Fswift-argument-parser%2Fdocumentation%2Fargumentparser%0A",
      ),
    ).toThrow(/Invalid external URL/)
  })

  it("should enforce host blocklist", async () => {
    await expect(
      assertExternalDocumentationAccess(
        new URL("https://apple.github.io/swift-argument-parser/documentation/argumentparser"),
        {
          EXTERNAL_DOC_HOST_BLOCKLIST: "example.com\napple.github.io",
        },
      ),
    ).rejects.toThrow(/blocked by configuration/)
  })

  it("should prefer blocklist over allowlist when both match", async () => {
    await expect(
      assertExternalDocumentationAccess(new URL("https://docs.example.com/documentation/example"), {
        EXTERNAL_DOC_HOST_ALLOWLIST: "example.com",
        EXTERNAL_DOC_HOST_BLOCKLIST: "docs.example.com",
      }),
    ).rejects.toThrow(/blocked by configuration/)
  })

  it("should match allowlist domain suffixes", async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValue(new Response("User-agent: *\nAllow: /", { status: 200 }))

    await expect(
      assertExternalDocumentationAccess(new URL("https://a.b.example.com/documentation/example"), {
        EXTERNAL_DOC_HOST_ALLOWLIST: ".example.com",
      }),
    ).resolves.toBeUndefined()
  })

  it("should enforce host allowlist when configured", async () => {
    await expect(
      assertExternalDocumentationAccess(
        new URL("https://apple.github.io/swift-argument-parser/documentation/argumentparser"),
        {
          EXTERNAL_DOC_HOST_ALLOWLIST: "developer.apple.com\nswift.org",
        },
      ),
    ).rejects.toThrow(/not allowlisted/)
  })

  it("should block local and private hosts unless explicitly allowlisted", async () => {
    const blockedHosts = [
      "localhost",
      "example.local",
      "127.0.0.1",
      "10.0.0.1",
      "192.168.1.1",
      "172.16.0.1",
      "169.254.1.1",
      "[::1]",
      "[fc00::1]",
      "[fd12::1]",
      "[fe80::1]",
    ]

    global.fetch = vi.fn()
    for (const host of blockedHosts) {
      await expect(
        assertExternalDocumentationAccess(new URL(`https://${host}/documentation/example`), {}),
      ).rejects.toThrow(/local or private host/)
    }

    // Host policy should reject before any robots.txt request is made.
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it("should allow an explicitly allowlisted private host", async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValue(new Response("User-agent: *\nAllow: /", { status: 200 }))

    await expect(
      assertExternalDocumentationAccess(new URL("https://127.0.0.1/documentation/example"), {
        EXTERNAL_DOC_HOST_ALLOWLIST: "127.0.0.1",
      }),
    ).resolves.toBeUndefined()
  })

  it("should deny when robots.txt disallows", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response("User-agent: *\nDisallow: /swift-argument-parser/documentation/", {
        status: 200,
        headers: { "Content-Type": "text/plain" },
      }),
    )

    await expect(
      assertExternalDocumentationAccess(
        new URL("https://apple.github.io/swift-argument-parser/documentation/argumentparser"),
        {},
      ),
    ).rejects.toThrow(/robots\.txt/)

    expect(global.fetch).toHaveBeenCalledWith(
      "https://apple.github.io/robots.txt",
      expect.objectContaining({
        headers: expect.objectContaining({
          "User-Agent": EXTERNAL_DOC_USER_AGENT,
        }),
      }),
    )
  })

  it("should treat empty robots disallow as allow-all", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response("User-agent: *\nDisallow:", {
        status: 200,
        headers: { "Content-Type": "text/plain" },
      }),
    )

    await expect(
      assertExternalDocumentationAccess(
        new URL("https://allow-empty.example.com/documentation/example"),
        {},
      ),
    ).resolves.toBeUndefined()
  })

  it("should deny when robots has Disallow: / even with empty Allow:", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response("User-agent: *\nAllow:\nDisallow: /", {
        status: 200,
        headers: { "Content-Type": "text/plain" },
      }),
    )

    await expect(
      assertExternalDocumentationAccess(
        new URL("https://deny-all.example.com/documentation/example"),
        {},
      ),
    ).rejects.toThrow(/robots\.txt/)
  })

  it("should prefer specific user-agent robots group over wildcard", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response(
        "User-agent: *\nDisallow: /\n\nUser-agent: sosumi-ai\nAllow: /documentation/\nDisallow: /",
        {
          status: 200,
          headers: { "Content-Type": "text/plain" },
        },
      ),
    )

    await expect(
      assertExternalDocumentationAccess(
        new URL("https://specific-ua.example.com/documentation/example"),
        {},
      ),
    ).resolves.toBeUndefined()
  })

  it("should cache robots.txt policy per origin to reduce repeated fetches", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response("User-agent: *\nAllow: /", {
        status: 200,
        headers: { "Content-Type": "text/plain" },
      }),
    )

    await assertExternalDocumentationAccess(
      new URL("https://docs.example.com/documentation/one"),
      {},
    )
    await assertExternalDocumentationAccess(
      new URL("https://docs.example.com/documentation/two"),
      {},
    )

    expect(global.fetch).toHaveBeenCalledTimes(1)
  })

  it("should fall back to root domain robots.txt when subdomain robots.txt is 403 or 404", async () => {
    // Real robots.txt from https://daily.co/robots.txt (subdomain reference-ios.daily.co returns 403, e.g. S3/CloudFront)
    const dailyCoRobotsTxt = `# *
User-agent: *
Allow: /

# Host
Host: https://www.daily.co

# Sitemaps
Sitemap: https://www.daily.co/sitemap.xml
Sitemap: https://www.daily.co/resources/sitemap.xml
Sitemap: https://www.daily.co/partners/sitemap.xml
Sitemap: https://www.daily.co/videosaurus/sitemap.xml
Sitemap: https://www.daily.co/blog/sitemap.xml
Sitemap: https://docs.daily.co/sitemap.xml
`

    global.fetch = vi.fn().mockImplementation((url: string | URL) => {
      const u = typeof url === "string" ? url : url.toString()
      if (u === "https://reference-ios.daily.co/robots.txt") {
        return Promise.resolve(
          new Response(null, {
            status: 403,
            headers: { "content-type": "application/xml" },
          }),
        )
      }
      if (u === "https://daily.co/robots.txt") {
        return Promise.resolve(
          new Response(dailyCoRobotsTxt, {
            status: 200,
            headers: { "Content-Type": "text/plain" },
          }),
        )
      }
      return Promise.reject(new Error(`Unexpected fetch: ${u}`))
    })

    await expect(
      assertExternalDocumentationAccess(
        new URL("https://reference-ios.daily.co/documentation/some/module"),
        {},
      ),
    ).resolves.toBeUndefined()

    expect(global.fetch).toHaveBeenNthCalledWith(
      1,
      "https://reference-ios.daily.co/robots.txt",
      expect.objectContaining({
        headers: expect.objectContaining({ "User-Agent": EXTERNAL_DOC_USER_AGENT }),
      }),
    )
    expect(global.fetch).toHaveBeenNthCalledWith(
      2,
      "https://daily.co/robots.txt",
      expect.objectContaining({
        headers: expect.objectContaining({ "User-Agent": EXTERNAL_DOC_USER_AGENT }),
      }),
    )
    expect(global.fetch).toHaveBeenCalledTimes(2)
  })

  it("should allow fetch when both subdomain and root domain robots.txt are 404", async () => {
    global.fetch = vi.fn().mockImplementation((url: string | URL) => {
      const u = typeof url === "string" ? url : url.toString()
      if (u === "https://docs.example.org/robots.txt" || u === "https://example.org/robots.txt") {
        return Promise.resolve(new Response(null, { status: 404 }))
      }
      return Promise.reject(new Error(`Unexpected fetch: ${u}`))
    })

    await expect(
      assertExternalDocumentationAccess(
        new URL("https://docs.example.org/documentation/some/module"),
        {},
      ),
    ).resolves.toBeUndefined()

    expect(global.fetch).toHaveBeenCalledWith(
      "https://docs.example.org/robots.txt",
      expect.any(Object),
    )
    expect(global.fetch).toHaveBeenCalledWith("https://example.org/robots.txt", expect.any(Object))
    expect(global.fetch).toHaveBeenCalledTimes(2)
  })

  it("should build and fetch external DocC JSON", async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response("User-agent: *\nAllow: /", { status: 200 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ metadata: { title: "Daily" } }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      )

    const data = await fetchExternalDocCJSON(
      new URL("https://json-basic.example.com/documentation/example"),
    )

    expect(data.metadata?.title).toBe("Daily")
    expect(global.fetch).toHaveBeenCalledWith(
      "https://json-basic.example.com/data/documentation/example.json",
      expect.objectContaining({
        headers: expect.objectContaining({
          Accept: "application/json",
        }),
      }),
    )
  })

  it("should build and fetch external DocC JSON for hosted base paths", async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response("User-agent: *\nAllow: /", { status: 200 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ metadata: { title: "ArgumentParser" } }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      )

    const data = await fetchExternalDocCJSON(
      new URL("https://docs-hosted.example.com/swift-argument-parser/documentation/argumentparser"),
    )

    expect(data.metadata?.title).toBe("ArgumentParser")
    expect(global.fetch).toHaveBeenCalledWith(
      "https://docs-hosted.example.com/swift-argument-parser/data/documentation/argumentparser.json",
      expect.objectContaining({
        headers: expect.objectContaining({
          Accept: "application/json",
        }),
      }),
    )
  })

  it("should honor restrictive X-Robots-Tag on external JSON responses", async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response("User-agent: *\nAllow: /", { status: 200 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ metadata: { title: "Daily" } }), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "X-Robots-Tag": "noai",
          },
        }),
      )

    await expect(
      fetchExternalDocCJSON(new URL("https://xrobots.example.com/documentation/argumentparser")),
    ).rejects.toThrow(ExternalAccessError)
  })

  it("should return external not found as ExternalAccessError with 404", async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response("User-agent: *\nAllow: /", { status: 200 }))
      .mockResolvedValueOnce(new Response("Not Found", { status: 404 }))

    await expect(
      fetchExternalDocCJSON(new URL("https://notfound.example.com/documentation/argumentparser")),
    ).rejects.toMatchObject({ name: "ExternalAccessError", status: 404 })
  })

  it("should rewrite relative /documentation links for external origins", async () => {
    const result = await renderFromJSON(
      {
        metadata: { title: "Daily" },
        topicSections: [
          {
            title: "Classes",
            identifiers: [
              "doc://org.swift.ArgumentParser/documentation/ArgumentParser/ArgumentParser",
            ],
          },
        ],
        references: {
          "doc://org.swift.ArgumentParser/documentation/ArgumentParser/ArgumentParser": {
            title: "ArgumentParser",
            url: "/documentation/argumentparser/argumentparser",
          },
        },
      },
      "https://apple.github.io/documentation/argumentparser",
      { externalOrigin: "https://apple.github.io" },
    )

    expect(result).toContain(
      "[ArgumentParser](/external/https://apple.github.io/documentation/argumentparser/argumentparser)",
    )
  })

  it("should build navigation for nested hosted base-path documentation URLs", async () => {
    const result = await renderFromJSON(
      {
        metadata: { title: "ArgumentParser" },
      },
      "https://apple.github.io/swift-argument-parser/documentation/argumentparser/commandconfiguration",
      { externalOrigin: "https://apple.github.io/swift-argument-parser" },
    )

    expect(result).toContain(
      "**Navigation:** [Argumentparser](/external/https://apple.github.io/swift-argument-parser/documentation/argumentparser)",
    )
  })
})

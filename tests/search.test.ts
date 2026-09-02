import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { searchAppleDeveloperDocs } from "../src/lib/search"

const SEARCH_URL = "https://devintserv.msc.sbz.apple.com/api/v1/query"

function jsonlResponse(lines: unknown[]): Response {
  const body = lines
    .map((line) => (typeof line === "string" ? line : JSON.stringify(line)))
    .join("\n")

  return new Response(body, {
    status: 200,
    headers: { "Content-Type": "application/jsonl" },
  })
}

// Split a "search" payload into diff events the way Apple's backend streams them:
// each event appends to a buffer after dropping `removeLast` characters from its end.
function searchDiffEvents(payload: unknown): unknown[] {
  const serialized = JSON.stringify(payload)
  const midpoint = Math.floor(serialized.length / 2)
  const speculative = "PARTIAL"

  return [
    { kind: "search", diff: { append: serialized.slice(0, midpoint), removeLast: 0 } },
    { kind: "search", diff: { append: speculative, removeLast: 0 } },
    {
      kind: "search",
      diff: { append: serialized.slice(midpoint), removeLast: speculative.length },
    },
  ]
}

describe("searchAppleDeveloperDocs", () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    global.fetch = originalFetch
  })

  it("parses the JSONL response from Apple's MSC query backend", async () => {
    const quickSearch = {
      kind: "quickSearch",
      response: {
        results: [
          {
            metadata: {
              title: "SchemaMigrationPlan",
              permalink: "https://developer.apple.com/documentation/swiftdata/schemamigrationplan",
              description:
                "An interface for describing the evolution of a schema and how to migrate between specific versions.",
              hierarchy: "SwiftData > SchemaMigrationPlan",
              kind: "symbol",
              metadataKind: "documentation",
            },
            origin: "documentation",
          },
          {
            metadata: {
              title: "Get Started - SwiftUI",
              sourceURL: "https://developer.apple.com/swiftui/get-started/",
              description: "SwiftUI provides everything you need to begin designing.",
              metadataKind: "webPage",
            },
            origin: "developerWeb",
          },
        ],
      },
    }

    const streamedSearch = {
      results: [
        {
          excerpt: "An interface for describing the evolution of a schema",
          value: {
            metadata: {
              title: "SchemaMigrationPlan",
              permalink: "https://developer.apple.com/documentation/swiftdata/schemamigrationplan",
              description:
                "An interface for describing the evolution of a schema and how to migrate between specific versions.",
              hierarchy: "SwiftData > SchemaMigrationPlan",
              kind: "symbol",
              metadataKind: "documentation",
            },
            origin: "documentation",
          },
        },
        {
          excerpt: "Learn how to use schema macros",
          value: {
            metadata: {
              titles: ["Model your schema with SwiftData"],
              permalinks: ["https://developer.apple.com/videos/play/wwdc2023/10195"],
              descriptions: ["Learn how to use schema macros and migration plans with SwiftData."],
              projectNames: ["WWDC23"],
              itemTypes: ["Video"],
              deliveryLanguageCodes: ["eng"],
              metadataKind: "developer",
            },
            origin: "developerWWDC",
          },
        },
        {
          excerpt: "",
          value: {
            metadata: {
              title: "Swift.org - The Swift Programming Language",
              sourceURL: "https://www.swift.org/documentation/",
              description: "Documentation for the Swift programming language.",
              metadataKind: "webPage",
            },
            origin: "swift",
          },
        },
      ],
    }

    global.fetch = vi
      .fn()
      .mockResolvedValue(
        jsonlResponse([
          quickSearch,
          { kind: "quickSearchFinished" },
          "",
          ...searchDiffEvents(streamedSearch),
          { kind: "searchFinished" },
        ]),
      )

    const result = await searchAppleDeveloperDocs("SchemaMigrationPlan")

    expect(global.fetch).toHaveBeenCalledTimes(1)
    const [requestUrl, requestInit] = vi.mocked(global.fetch).mock.calls[0] ?? []
    expect(requestUrl).toBe(SEARCH_URL)
    expect(requestInit).toEqual(
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
          Accept: "application/jsonl",
          Origin: "https://developer.apple.com",
          Referer: "https://developer.apple.com/search/",
          "User-Agent": expect.stringMatching(/AppleWebKit/),
        }),
      }),
    )
    expect(JSON.parse(String(requestInit?.body))).toEqual({
      text: "SchemaMigrationPlan",
      targetResultLocale: expect.any(String),
      includedResponses: ["quickSearch", "search"],
    })

    // The documentation result appears in both channels, and is reported once.
    expect(result).toEqual({
      query: "SchemaMigrationPlan",
      results: [
        {
          title: "SchemaMigrationPlan",
          url: "https://developer.apple.com/documentation/swiftdata/schemamigrationplan",
          description:
            "An interface for describing the evolution of a schema and how to migrate between specific versions.",
          breadcrumbs: ["SwiftData", "SchemaMigrationPlan"],
          tags: ["symbol"],
          type: "documentation",
        },
        {
          title: "Get Started - SwiftUI",
          url: "https://developer.apple.com/swiftui/get-started/",
          description: "SwiftUI provides everything you need to begin designing.",
          breadcrumbs: [],
          tags: [],
          type: "general",
        },
        {
          title: "Model your schema with SwiftData",
          url: "https://developer.apple.com/videos/play/wwdc2023/10195",
          description: "Learn how to use schema macros and migration plans with SwiftData.",
          breadcrumbs: ["WWDC23"],
          tags: ["Video", "eng"],
          type: "video",
        },
        {
          title: "Swift.org - The Swift Programming Language",
          url: "https://www.swift.org/documentation/",
          description: "Documentation for the Swift programming language.",
          breadcrumbs: [],
          tags: [],
          type: "general",
        },
      ],
    })
  })

  it("ignores results carried by response kinds it did not ask for", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      jsonlResponse([
        {
          kind: "ask",
          response: {
            results: [
              {
                metadata: {
                  title: "Generated answer",
                  permalink: "https://developer.apple.com/generated",
                  metadataKind: "documentation",
                },
                origin: "documentation",
              },
            ],
          },
        },
        {
          kind: "quickSearch",
          response: {
            results: [
              {
                metadata: {
                  title: "WKWebView",
                  permalink: "https://developer.apple.com/documentation/webkit/wkwebview",
                  description: "An object that displays interactive web content.",
                  hierarchy: "WebKit > WKWebView",
                  kind: "symbol",
                  metadataKind: "documentation",
                },
                origin: "documentation",
              },
            ],
          },
        },
      ]),
    )

    const result = await searchAppleDeveloperDocs("WKWebView")

    expect(result.results).toHaveLength(1)
    expect(result.results[0]?.title).toBe("WKWebView")
  })

  it("collapses 'en-*' locales to bare 'en' to match Apple's accepted target locales", async () => {
    vi.spyOn(Intl, "DateTimeFormat").mockImplementation(
      () =>
        ({
          resolvedOptions: () => ({ locale: "en-US-u-hc-h23" }),
        }) as Intl.DateTimeFormat,
    )

    global.fetch = vi
      .fn()
      .mockResolvedValue(jsonlResponse([{ kind: "quickSearch", response: { results: [] } }]))

    await searchAppleDeveloperDocs("SchemaMigrationPlan")

    const [, requestInit] = vi.mocked(global.fetch).mock.calls[0] ?? []
    expect(JSON.parse(String(requestInit?.body))).toEqual({
      text: "SchemaMigrationPlan",
      targetResultLocale: "en",
      includedResponses: ["quickSearch", "search"],
    })
  })

  it("preserves language-region subtags for non-English locales", async () => {
    vi.spyOn(Intl, "DateTimeFormat").mockImplementation(
      () =>
        ({
          resolvedOptions: () => ({ locale: "ja-JP" }),
        }) as Intl.DateTimeFormat,
    )

    global.fetch = vi
      .fn()
      .mockResolvedValue(jsonlResponse([{ kind: "quickSearch", response: { results: [] } }]))

    await searchAppleDeveloperDocs("Foundation")

    const [, requestInit] = vi.mocked(global.fetch).mock.calls[0] ?? []
    expect(JSON.parse(String(requestInit?.body))).toEqual({
      text: "Foundation",
      targetResultLocale: "ja-JP",
      includedResponses: ["quickSearch", "search"],
    })
  })

  it("maps Latin American Spanish to Apple's search locale token", async () => {
    vi.spyOn(Intl, "DateTimeFormat").mockImplementation(
      () =>
        ({
          resolvedOptions: () => ({ locale: "es-419" }),
        }) as Intl.DateTimeFormat,
    )

    global.fetch = vi
      .fn()
      .mockResolvedValue(jsonlResponse([{ kind: "quickSearch", response: { results: [] } }]))

    await searchAppleDeveloperDocs("Foundation")

    const [, requestInit] = vi.mocked(global.fetch).mock.calls[0] ?? []
    expect(JSON.parse(String(requestInit?.body))).toEqual({
      text: "Foundation",
      targetResultLocale: "es-lamr",
      includedResponses: ["quickSearch", "search"],
    })
  })

  it("returns an empty result set when Apple search returns no matches", async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValue(
        jsonlResponse([
          { kind: "quickSearch", response: { results: [] } },
          { kind: "quickSearchFinished" },
          { kind: "searchFinished" },
        ]),
      )

    const result = await searchAppleDeveloperDocs("no-such-symbol")

    expect(result).toEqual({
      query: "no-such-symbol",
      results: [],
    })
  })

  it("returns an empty result set when the response omits the results array", async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValue(
        jsonlResponse([{ kind: "quickSearch", response: { featuredResults: [] } }]),
      )

    const result = await searchAppleDeveloperDocs("ambiguous-shape")

    expect(result).toEqual({
      query: "ambiguous-shape",
      results: [],
    })
  })

  it("throws a clear error when Apple's backend returns a non-2xx status", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response("", {
        status: 500,
        headers: { "Content-Type": "text/plain" },
      }),
    )

    await expect(searchAppleDeveloperDocs("anything")).rejects.toThrow("Search request failed: 500")
  })

  it("throws a clear error when the moved endpoint reports the path as gone", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response("", {
        status: 404,
        headers: { "Content-Type": "text/plain" },
      }),
    )

    await expect(searchAppleDeveloperDocs("anything")).rejects.toThrow("Search request failed: 404")
  })

  it("throws a clear error when Apple's backend returns malformed JSONL", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response("not json", {
        status: 200,
        headers: { "Content-Type": "application/jsonl" },
      }),
    )

    await expect(searchAppleDeveloperDocs("anything")).rejects.toThrow(
      "Search response was not valid JSON",
    )
  })
})

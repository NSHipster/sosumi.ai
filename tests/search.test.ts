import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { searchAppleDeveloperDocs } from "../src/lib/search"

const SEARCH_URL = "https://devintserv.msc.sbz.apple.com/api/v1/search"

describe("searchAppleDeveloperDocs", () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    global.fetch = originalFetch
  })

  it("parses the JSON response from Apple's MSC search backend", async () => {
    const payload = {
      results: [
        {
          documentation: {
            metadata: {
              title: "SchemaMigrationPlan",
              permalink: "https://developer.apple.com/documentation/swiftdata/schemamigrationplan",
              description:
                "An interface for describing the evolution of a schema and how to migrate between specific versions.",
              hierarchy: "SwiftData > SchemaMigrationPlan",
              kind: "symbol",
            },
          },
        },
        {
          developer: {
            metadata: {
              titles: ["Model your schema with SwiftData"],
              permalinks: ["https://developer.apple.com/videos/play/wwdc2023/10195"],
              descriptions: ["Learn how to use schema macros and migration plans with SwiftData."],
              projectNames: ["WWDC23"],
              itemTypes: ["Video"],
              deliveryLanguageCodes: ["eng"],
            },
          },
        },
        {
          devsite: {
            metadata: {
              title: "Get Started - SwiftUI",
              sourceURL: "https://developer.apple.com/swiftui/get-started/",
              description: "SwiftUI provides everything you need to begin designing.",
            },
          },
        },
        {
          swiftdocs: {
            metadata: {
              title: "Swift.org - The Swift Programming Language",
              sourceURL: "https://www.swift.org/documentation/",
              description: "Documentation for the Swift programming language.",
            },
          },
        },
      ],
    }

    global.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(payload), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
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
          Accept: "application/json",
          Origin: "https://developer.apple.com",
          Referer: "https://developer.apple.com/search/",
          "User-Agent": expect.stringMatching(/AppleWebKit/),
        }),
      }),
    )
    expect(JSON.parse(String(requestInit?.body))).toEqual({
      text: "SchemaMigrationPlan",
      targetResultLocale: expect.any(String),
    })

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
          title: "Model your schema with SwiftData",
          url: "https://developer.apple.com/videos/play/wwdc2023/10195",
          description: "Learn how to use schema macros and migration plans with SwiftData.",
          breadcrumbs: ["WWDC23"],
          tags: ["Video", "eng"],
          type: "video",
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

  it("collapses 'en-*' locales to bare 'en' to match Apple's accepted target locales", async () => {
    vi.spyOn(Intl, "DateTimeFormat").mockImplementation(
      () =>
        ({
          resolvedOptions: () => ({ locale: "en-US-u-hc-h23" }),
        }) as Intl.DateTimeFormat,
    )

    global.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ results: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    )

    await searchAppleDeveloperDocs("SchemaMigrationPlan")

    const [, requestInit] = vi.mocked(global.fetch).mock.calls[0] ?? []
    expect(JSON.parse(String(requestInit?.body))).toEqual({
      text: "SchemaMigrationPlan",
      targetResultLocale: "en",
    })
  })

  it("preserves language-region subtags for non-English locales", async () => {
    vi.spyOn(Intl, "DateTimeFormat").mockImplementation(
      () =>
        ({
          resolvedOptions: () => ({ locale: "ja-JP" }),
        }) as Intl.DateTimeFormat,
    )

    global.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ results: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    )

    await searchAppleDeveloperDocs("Foundation")

    const [, requestInit] = vi.mocked(global.fetch).mock.calls[0] ?? []
    expect(JSON.parse(String(requestInit?.body))).toEqual({
      text: "Foundation",
      targetResultLocale: "ja-JP",
    })
  })

  it("maps Latin American Spanish to Apple's search locale token", async () => {
    vi.spyOn(Intl, "DateTimeFormat").mockImplementation(
      () =>
        ({
          resolvedOptions: () => ({ locale: "es-419" }),
        }) as Intl.DateTimeFormat,
    )

    global.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ results: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    )

    await searchAppleDeveloperDocs("Foundation")

    const [, requestInit] = vi.mocked(global.fetch).mock.calls[0] ?? []
    expect(JSON.parse(String(requestInit?.body))).toEqual({
      text: "Foundation",
      targetResultLocale: "es-lamr",
    })
  })

  it("returns an empty result set when Apple search returns no matches", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ results: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    )

    const result = await searchAppleDeveloperDocs("no-such-symbol")

    expect(result).toEqual({
      query: "no-such-symbol",
      results: [],
    })
  })

  it("returns an empty result set when the response omits the results array", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ featuredResults: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
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

  it("throws a clear error when Apple's backend returns malformed JSON", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response("not json", {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    )

    await expect(searchAppleDeveloperDocs("anything")).rejects.toThrow(
      "Search response was not valid JSON",
    )
  })
})

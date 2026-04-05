import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { searchAppleDeveloperDocs } from "../src/lib/search"

describe("searchAppleDeveloperDocs", () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    global.fetch = originalFetch
  })

  it("parses Apple Developer streamed search results", async () => {
    const payload = [
      "null",
      JSON.stringify({
        type: "results",
        data: [
          {
            documentation: {
              metadata: {
                title: "SchemaMigrationPlan",
                permalink:
                  "https://developer.apple.com/documentation/swiftdata/schemamigrationplan",
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
                descriptions: [
                  "Learn how to use schema macros and migration plans with SwiftData.",
                ],
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
        ],
      }),
      JSON.stringify({ type: "done", ok: true, query: "SchemaMigrationPlan" }),
    ].join("\n")

    global.fetch = vi.fn().mockResolvedValue(
      new Response(payload, {
        status: 200,
        headers: { "Content-Type": "application/x-ndjson" },
      }),
    )

    const result = await searchAppleDeveloperDocs("SchemaMigrationPlan")

    expect(global.fetch).toHaveBeenCalledTimes(1)
    const [requestUrl, requestInit] = vi.mocked(global.fetch).mock.calls[0] ?? []
    expect(requestUrl).toBe("https://developer.apple.com/search/services/search.php")
    expect(requestInit).toEqual(
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
          Accept: "application/json",
          "User-Agent": expect.stringMatching(/AppleWebKit/),
        }),
      }),
    )
    expect(JSON.parse(String(requestInit?.body))).toEqual({
      q: "SchemaMigrationPlan",
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
      ],
    })
  })

  it("uses language and region subtags when the resolved locale contains Unicode extensions", async () => {
    vi.spyOn(Intl, "DateTimeFormat").mockImplementation(
      () =>
        ({
          resolvedOptions: () => ({ locale: "en-US-u-hc-h23" }),
        }) as Intl.DateTimeFormat,
    )

    global.fetch = vi.fn().mockResolvedValue(
      new Response(
        [
          JSON.stringify({ type: "results", data: [] }),
          JSON.stringify({ type: "done", ok: true, query: "SchemaMigrationPlan" }),
        ].join("\n"),
        {
          status: 200,
          headers: { "Content-Type": "application/x-ndjson" },
        },
      ),
    )

    await searchAppleDeveloperDocs("SchemaMigrationPlan")

    const [, requestInit] = vi.mocked(global.fetch).mock.calls[0] ?? []
    expect(JSON.parse(String(requestInit?.body))).toEqual({
      q: "SchemaMigrationPlan",
      targetResultLocale: "en_US",
    })
  })

  it("returns an empty result set when Apple search returns no matches", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response(
        [
          JSON.stringify({ type: "results", data: [] }),
          JSON.stringify({ type: "done", ok: true, query: "no-such-symbol" }),
        ].join("\n"),
        {
          status: 200,
          headers: { "Content-Type": "application/x-ndjson" },
        },
      ),
    )

    const result = await searchAppleDeveloperDocs("no-such-symbol")

    expect(result).toEqual({
      query: "no-such-symbol",
      results: [],
    })
  })

  it("fails clearly if Apple changes the streamed response shape", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ type: "done", ok: true, query: "SwiftData" }), {
        status: 200,
        headers: { "Content-Type": "application/x-ndjson" },
      }),
    )

    await expect(searchAppleDeveloperDocs("SwiftData")).rejects.toThrow(
      "Search response did not include a results event",
    )
  })
})

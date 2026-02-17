import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { fetchExternalDocCJSON } from "../src/lib/external"
import { fetchJSONData, renderFromJSON } from "../src/lib/reference"
import arrayData from "./fixtures/reference/array.json"
import {
  fetchHIGPageData,
  fetchHIGTableOfContents,
  renderHIGFromJSON,
  renderHIGTableOfContents,
} from "../src/lib/hig"
import higTocData from "./fixtures/hig/toc.json"
import higGettingStartedData from "./fixtures/hig/getting-started.json"

describe("Integration Tests with Mocked Apple API", () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  it("should fetch and render Apple documentation with mocked API response", async () => {
    // Mock fetch directly
    global.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(arrayData), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    )

    // Test the full pipeline: fetchJSONData -> renderFromJSON
    const jsonData = await fetchJSONData("/documentation/swift/array")
    const markdown = await renderFromJSON(
      jsonData,
      "https://developer.apple.com/documentation/swift/array",
    )

    expect(markdown).toContain("# Array")
    expect(markdown).toContain("> An ordered, random-access collection.")
    expect(markdown).toContain("*Extracted by [sosumi.ai](https://sosumi.ai)")

    // Verify the correct Apple API was called
    expect(global.fetch).toHaveBeenCalledTimes(1)
    expect(global.fetch).toHaveBeenCalledWith(
      "https://developer.apple.com/tutorials/data/documentation/swift/array.json",
      expect.objectContaining({
        headers: expect.objectContaining({
          "User-Agent": expect.stringMatching(/Safari/),
          Accept: "application/json",
          "Cache-Control": "no-cache",
        }),
      }),
    )
  })

  it("should handle Apple API errors gracefully", async () => {
    // Mock a 404 response from Apple's API
    global.fetch = vi.fn().mockResolvedValue(new Response("Not Found", { status: 404 }))

    await expect(fetchJSONData("/documentation/swift/nonexistent")).rejects.toThrow()
    expect(global.fetch).toHaveBeenCalledTimes(1)
  })

  it("should handle network errors when fetching from Apple", async () => {
    // Mock a network error
    global.fetch = vi.fn().mockRejectedValue(new Error("Network error"))

    await expect(fetchJSONData("/documentation/swift/array")).rejects.toThrow("Network error")
    expect(global.fetch).toHaveBeenCalledTimes(1)
  })

  it("should handle framework index requests", async () => {
    const mockFrameworkData = {
      metadata: { title: "Swift" },
      references: {},
      primaryContentSections: [],
    }

    global.fetch = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify(mockFrameworkData), { status: 200 }))

    const jsonData = await fetchJSONData("/documentation/swift")
    const markdown = await renderFromJSON(
      jsonData,
      "https://developer.apple.com/documentation/swift",
    )

    expect(markdown).toContain("# Swift")

    // Should call the framework index endpoint
    expect(global.fetch).toHaveBeenCalledWith(
      "https://developer.apple.com/tutorials/data/index/swift",
      expect.any(Object),
    )
  })

  it("should use correct user agent and headers for Apple API requests", async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify(arrayData), { status: 200 }))

    await fetchJSONData("/documentation/swift/array")

    expect(global.fetch).toHaveBeenCalledTimes(1)
    const call = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(call[0]).toBe(
      "https://developer.apple.com/tutorials/data/documentation/swift/array.json",
    )
    expect(call[1].headers["User-Agent"]).toMatch(/AppleWebKit/)
    expect(call[1].headers.Accept).toBe("application/json")
    expect(call[1].headers["Cache-Control"]).toBe("no-cache")
  })

  it("should handle concurrent requests efficiently", async () => {
    // Mock successful response for all requests - create new Response each time
    global.fetch = vi.fn().mockImplementation(() =>
      Promise.resolve(
        new Response(JSON.stringify(arrayData), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    )

    // Make concurrent requests
    const promises = [
      fetchJSONData("/documentation/swift/array"),
      fetchJSONData("/documentation/swift/string"),
      fetchJSONData("/documentation/swift/dictionary"),
    ]

    const results = await Promise.all(promises)

    // All should succeed
    results.forEach((result) => {
      expect(result).toBeDefined()
      expect(result.metadata).toBeDefined()
    })

    // Should have made 3 fetch calls to Apple API
    expect(global.fetch).toHaveBeenCalledTimes(3)
  })

  // HIG tests consolidated from hig-integration.test.ts, reusing the same setup
  it("should fetch and render HIG table of contents with mocked API response", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(higTocData), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    )

    const tocData = await fetchHIGTableOfContents()
    const markdown = await renderHIGTableOfContents(tocData)

    expect(global.fetch).toHaveBeenCalledWith(
      "https://developer.apple.com/tutorials/data/index/design--human-interface-guidelines",
      expect.objectContaining({
        headers: expect.objectContaining({
          Accept: "application/json",
          "Cache-Control": "no-cache",
        }),
      }),
    )

    expect(markdown).toContain("# Human Interface Guidelines")
    expect(markdown).toContain("## Getting started")
    expect(markdown).toContain("### Foundations")
    expect(markdown).toContain("- [Color](/design/human-interface-guidelines/foundations/color)")
    expect(markdown).toContain(
      "*This is unofficial content. All Human Interface Guidelines belong to Apple Inc.*",
    )
  })

  it("should fetch and render HIG page with mocked API response", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(higGettingStartedData), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    )

    const pageData = await fetchHIGPageData("getting-started")
    const markdown = await renderHIGFromJSON(
      pageData,
      "https://developer.apple.com/design/human-interface-guidelines/getting-started",
    )

    expect(global.fetch).toHaveBeenCalledWith(
      "https://developer.apple.com/tutorials/data/design/human-interface-guidelines/getting-started.json",
      expect.objectContaining({
        headers: expect.objectContaining({
          Accept: "application/json",
          "Cache-Control": "no-cache",
        }),
      }),
    )

    expect(markdown).toContain("title: Getting started")
    expect(markdown).toContain("**Guide Collection**")
    expect(markdown).toContain("# Getting started")
    expect(markdown).toContain(
      "> Create an app or game that feels at home on every platform you support.",
    )
    expect(markdown).toContain(
      "- [Designing for iOS](/design/human-interface-guidelines/designing-for-ios)",
    )
    expect(markdown).toContain(
      "*This is unofficial content. All Human Interface Guidelines belong to Apple Inc.*",
    )
  })

  it("should handle nested HIG page paths correctly", async () => {
    const nestedPageData = {
      ...higGettingStartedData,
      metadata: {
        ...higGettingStartedData.metadata,
        title: "Color",
      },
      abstract: [
        {
          text: "Learn how to use color effectively in your designs.",
          type: "text",
        },
      ],
    }

    global.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(nestedPageData), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    )

    const pageData = await fetchHIGPageData("foundations/color")
    const markdown = await renderHIGFromJSON(
      pageData,
      "https://developer.apple.com/design/human-interface-guidelines/foundations/color",
    )

    expect(global.fetch).toHaveBeenCalledWith(
      "https://developer.apple.com/tutorials/data/design/human-interface-guidelines/foundations/color.json",
      expect.any(Object),
    )
    expect(markdown).toContain("title: Color")
    expect(markdown).toContain("> Learn how to use color effectively in your designs.")
  })

  it("should handle path normalization during fetch", async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify(higGettingStartedData), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(higGettingStartedData), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(higGettingStartedData), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      )

    await fetchHIGPageData("/getting-started/")
    await fetchHIGPageData("getting-started")
    await fetchHIGPageData("//getting-started//")

    expect(global.fetch).toHaveBeenCalledTimes(3)
    expect(global.fetch).toHaveBeenNthCalledWith(
      1,
      "https://developer.apple.com/tutorials/data/design/human-interface-guidelines/getting-started.json",
      expect.any(Object),
    )
    expect(global.fetch).toHaveBeenNthCalledWith(
      2,
      "https://developer.apple.com/tutorials/data/design/human-interface-guidelines/getting-started.json",
      expect.any(Object),
    )
    expect(global.fetch).toHaveBeenNthCalledWith(
      3,
      "https://developer.apple.com/tutorials/data/design/human-interface-guidelines/getting-started.json",
      expect.any(Object),
    )
  })

  it("should render table of contents with proper hierarchical structure", async () => {
    const complexTocData = {
      ...higTocData,
      interfaceLanguages: {
        swift: [
          {
            path: "/design/human-interface-guidelines",
            title: "Human Interface Guidelines",
            type: "module" as const,
            children: [
              {
                path: "/design/human-interface-guidelines/foundations",
                title: "Foundations",
                type: "symbol" as const,
                children: [
                  {
                    path: "/design/human-interface-guidelines/foundations/accessibility",
                    title: "Accessibility",
                    type: "article" as const,
                  },
                  {
                    path: "/design/human-interface-guidelines/foundations/color",
                    title: "Color",
                    type: "article" as const,
                  },
                ],
              },
              {
                path: "/design/human-interface-guidelines/patterns",
                title: "Patterns",
                type: "symbol" as const,
                children: [
                  {
                    path: "/design/human-interface-guidelines/patterns/loading",
                    title: "Loading",
                    type: "article" as const,
                  },
                ],
              },
            ],
          },
        ],
      },
    }

    global.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(complexTocData), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    )

    const tocData = await fetchHIGTableOfContents()
    const markdown = await renderHIGTableOfContents(tocData)

    expect(markdown).toContain("# Human Interface Guidelines")
    expect(markdown).toContain("## Foundations")
    expect(markdown).toContain(
      "- [Accessibility](/design/human-interface-guidelines/foundations/accessibility)",
    )
    expect(markdown).toContain("- [Color](/design/human-interface-guidelines/foundations/color)")
    expect(markdown).toContain("## Patterns")
    expect(markdown).toContain("- [Loading](/design/human-interface-guidelines/patterns/loading)")
  })

  it("should handle error responses appropriately", async () => {
    global.fetch = vi.fn().mockResolvedValue(new Response("Not Found", { status: 404 }))

    await expect(fetchHIGTableOfContents()).rejects.toThrow("HIG table of contents not found")
    await expect(fetchHIGPageData("nonexistent")).rejects.toThrow("HIG page not found")

    global.fetch = vi.fn().mockResolvedValue(new Response("Internal Server Error", { status: 500 }))

    await expect(fetchHIGTableOfContents()).rejects.toThrow(
      "Failed to fetch HIG ToC: 500 Internal Server Error",
    )
    await expect(fetchHIGPageData("test")).rejects.toThrow(
      "Failed to fetch HIG page: 500 Internal Server Error",
    )
  })

  it("should handle malformed JSON responses", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response("Invalid JSON", {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    )

    await expect(fetchHIGTableOfContents()).rejects.toThrow()
    await expect(fetchHIGPageData("test")).rejects.toThrow()
  })

  it("should preserve user agent rotation in requests", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(higTocData), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    )

    await fetchHIGTableOfContents()

    const call = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(call[1].headers["User-Agent"]).toBeDefined()
    expect(call[1].headers["User-Agent"]).toMatch(/Mozilla\/5\.0/)
  })

  it("should fetch and render external Swift-DocC JSON", async () => {
    global.fetch = vi
      .fn()
      // external JSON response
      .mockResolvedValueOnce(
        new Response(JSON.stringify(arrayData), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      )

    const jsonData = await fetchExternalDocCJSON(
      new URL("https://reference-ios.daily.co/documentation/daily"),
    )
    const text = await renderFromJSON(
      jsonData,
      "https://reference-ios.daily.co/documentation/daily",
      {
        externalOrigin: "https://reference-ios.daily.co",
      },
    )

    expect(text).toContain("# Array")
    expect(text).toContain(
      "*Extracted by [sosumi.ai](https://sosumi.ai) - Making Apple docs AI-readable.*",
    )
    expect(global.fetch).toHaveBeenCalledWith(
      "https://reference-ios.daily.co/data/documentation/daily.json",
      expect.any(Object),
    )
  })
})

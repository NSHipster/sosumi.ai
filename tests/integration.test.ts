import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { fetchExternalDocCJSON } from "../src/lib/external"
import { NotFoundError } from "../src/lib/fetch"
import {
  fetchHIGPageData,
  fetchHIGTableOfContents,
  renderHIGFromJSON,
  renderHIGTableOfContents,
} from "../src/lib/hig"
import { fetchDocumentationPage, fetchJSONData, renderFromJSON } from "../src/lib/reference"
import higGettingStartedData from "./fixtures/hig/getting-started.json"
import higTocData from "./fixtures/hig/toc.json"
import arrayData from "./fixtures/reference/array.json"

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
          "User-Agent": expect.stringMatching(/AppleWebKit/),
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
    // The second request looks for the symbol in the parent page
    expect(global.fetch).toHaveBeenCalledTimes(2)
  })

  describe("symbol paths without a signature or disambiguation suffix", () => {
    const parentData = {
      metadata: { title: "Observation" },
      references: {
        "doc://com.apple.documentation/documentation/Observation/withObservationTracking(_:onChange:)":
          {
            title: "withObservationTracking(_:onChange:)",
            url: "/documentation/observation/withobservationtracking(_:onchange:)",
          },
        "doc://com.apple.documentation/documentation/Observation/withObservationTracking(options:_:onChange:)":
          {
            title: "withObservationTracking(options:_:onChange:)",
            url: "/documentation/observation/withobservationtracking(options:_:onchange:)",
          },
        "doc://com.apple.documentation/documentation/Observation/ObservationTracking": {
          title: "ObservationTracking",
          url: "/documentation/observation/observationtracking",
        },
        "doc://com.apple.documentation/documentation/Observation/Observable-macro": {
          title: "Observable()",
          url: "/documentation/observation/observable-8ab1c",
        },
        "doc://com.apple.documentation/documentation/Observation/Observable/Child": {
          title: "Child",
          url: "/documentation/observation/observable/child-1a2b3",
        },
      },
    }

    function mockApple(pages: Record<string, unknown>) {
      global.fetch = vi.fn().mockImplementation((url: string) => {
        const page = pages[url]
        return Promise.resolve(
          page
            ? new Response(JSON.stringify(page), { status: 200 })
            : new Response("Not Found", { status: 404 }),
        )
      })
    }

    const base = "https://developer.apple.com/tutorials/data/documentation"

    it("should fetch the only page whose path adds a suffix to the name", async () => {
      const symbolData = { metadata: { title: "Observable()" } }
      mockApple({
        [`${base}/observation.json`]: parentData,
        [`${base}/observation/observable-8ab1c.json`]: symbolData,
      })

      const page = await fetchDocumentationPage("/documentation/observation/observable")

      expect(page.path).toBe("observation/observable-8ab1c")
      expect(page.data).toEqual(symbolData)
      expect(global.fetch).toHaveBeenNthCalledWith(
        2,
        `${base}/observation.json`,
        expect.any(Object),
      )
    })

    it("should list the candidates when more than one page matches", async () => {
      mockApple({ [`${base}/observation.json`]: parentData })

      const error = await fetchDocumentationPage("observation/withobservationtracking").catch(
        (e) => e,
      )

      expect(error).toBeInstanceOf(NotFoundError)
      expect(error.candidates).toEqual([
        {
          path: "observation/withobservationtracking(_:onchange:)",
          title: "withObservationTracking(_:onChange:)",
        },
        {
          path: "observation/withobservationtracking(options:_:onchange:)",
          title: "withObservationTracking(options:_:onChange:)",
        },
      ])
      expect(error.message).toContain(
        "- withObservationTracking(_:onChange:): /documentation/observation/withobservationtracking(_:onchange:)",
      )
    })

    it("should not match a different name with the same prefix", async () => {
      mockApple({ [`${base}/observation.json`]: parentData })

      const error = await fetchDocumentationPage("observation/observation").catch((e) => e)

      expect(error).toBeInstanceOf(NotFoundError)
      expect(error.candidates).toEqual([])
      expect(error.message).toBe(
        `Apple documentation page not found at ${base}/observation/observation.json`,
      )
    })

    it("should not resolve a signature that no page starts with", async () => {
      mockApple({ [`${base}/observation.json`]: parentData })

      const error = await fetchDocumentationPage(
        "observation/withobservationtracking(onchange:)",
      ).catch((e) => e)

      expect(error).toBeInstanceOf(NotFoundError)
      expect(error.candidates).toEqual([])
      expect(global.fetch).toHaveBeenCalledTimes(2)
    })

    describe("in a framework with Swift and Objective-C symbols", () => {
      const reference = (title: string, url: string) => ({ title, url })
      const frameworkData = {
        metadata: { title: "ExampleKit" },
        references: {
          "doc://test/Widget-swift": reference(
            "Widget",
            "/documentation/examplekit/widget-swift.struct",
          ),
          "doc://test/Widget-objc": reference("Widget", "/documentation/examplekit/widget-c.class"),
          "doc://test/Canvas": reference("Canvas", "/documentation/examplekit/canvas"),
        },
      }
      const widgetData = {
        metadata: { title: "Widget" },
        references: {
          "doc://test/Widget/size": reference(
            "size",
            "/documentation/examplekit/widget-swift.struct/size",
          ),
        },
      }
      const canvasData = {
        metadata: { title: "Canvas" },
        references: {
          "doc://test/Canvas/draw": reference(
            "draw(in:options:)",
            "/documentation/examplekit/canvas/draw(in:options:)",
          ),
          "doc://test/Canvas/fill-1": reference(
            "fill(_:)",
            "/documentation/examplekit/canvas/fill(_:)-1a2b3",
          ),
          "doc://test/Canvas/fill-2": reference(
            "fill(_:)",
            "/documentation/examplekit/canvas/fill(_:)-4c5d6",
          ),
        },
      }
      const pages = {
        [`${base}/examplekit.json`]: frameworkData,
        [`${base}/examplekit/widget-swift.struct.json`]: widgetData,
        [`${base}/examplekit/canvas.json`]: canvasData,
        [`${base}/examplekit/widget-swift.struct/size.json`]: { metadata: { title: "size" } },
        [`${base}/examplekit/canvas/draw(in:options:).json`]: {
          metadata: { title: "draw(in:options:)" },
        },
      }

      it("should fetch the Swift symbol instead of listing its Objective-C counterpart", async () => {
        mockApple(pages)

        const page = await fetchDocumentationPage("examplekit/widget")

        expect(page.path).toBe("examplekit/widget-swift.struct")
        expect(page.data).toEqual(widgetData)
      })

      it("should resolve a parent path that omits its disambiguation suffix", async () => {
        mockApple(pages)

        const page = await fetchDocumentationPage("/documentation/examplekit/widget/size")

        expect(page.path).toBe("examplekit/widget-swift.struct/size")
        expect(page.data).toEqual({ metadata: { title: "size" } })
        expect(global.fetch).toHaveBeenCalledTimes(5)
      })

      it("should not resolve parents beyond one level", async () => {
        mockApple(pages)

        await expect(
          fetchDocumentationPage("examplekit/widget/missing/size"),
        ).rejects.toBeInstanceOf(NotFoundError)
        // The page, its parent, and its grandparent
        expect(global.fetch).toHaveBeenCalledTimes(3)
      })

      it("should resolve a signature that omits trailing argument labels", async () => {
        mockApple(pages)

        const page = await fetchDocumentationPage("examplekit/canvas/draw(in:)")

        expect(page.path).toBe("examplekit/canvas/draw(in:options:)")
      })

      it("should list the overloads of a signature without its disambiguation suffix", async () => {
        mockApple(pages)

        const error = await fetchDocumentationPage("examplekit/canvas/fill(_:)").catch((e) => e)

        expect(error).toBeInstanceOf(NotFoundError)
        expect(error.candidates.map((c: { path: string }) => c.path)).toEqual([
          "examplekit/canvas/fill(_:)-1a2b3",
          "examplekit/canvas/fill(_:)-4c5d6",
        ])
      })
    })
  })

  describe("upstream failures while looking up the parent page", () => {
    const base = "https://developer.apple.com/tutorials/data/documentation"

    function mockApple(responses: Record<string, () => Promise<Response>>) {
      global.fetch = vi.fn().mockImplementation((url: string) => {
        const response = responses[url]
        return response ? response() : Promise.resolve(new Response("Not Found", { status: 404 }))
      })
    }

    it("should report a 5xx response for the parent page, not a missing page", async () => {
      vi.spyOn(console, "error").mockImplementation(() => {})
      mockApple({
        [`${base}/swift.json`]: async () =>
          new Response("Service Unavailable", { status: 503, statusText: "Service Unavailable" }),
      })

      const error = await fetchDocumentationPage("swift/array").catch((e) => e)

      expect(error).not.toBeInstanceOf(NotFoundError)
      expect(error.message).toBe("Failed to fetch JSON: 503 Service Unavailable")
    })

    it("should report a network failure for the parent page, not a missing page", async () => {
      mockApple({
        [`${base}/swift.json`]: () => Promise.reject(new TypeError("fetch failed")),
      })

      const error = await fetchDocumentationPage("swift/array").catch((e) => e)

      expect(error).toBeInstanceOf(TypeError)
      expect(error.message).toBe("fetch failed")
    })

    it("should report an invalid JSON response for the parent page, not a missing page", async () => {
      mockApple({
        [`${base}/swift.json`]: async () => new Response("<html>", { status: 200 }),
      })

      const error = await fetchDocumentationPage("swift/array").catch((e) => e)

      expect(error).toBeInstanceOf(SyntaxError)
    })

    it("should report a 5xx response while resolving the parent's path", async () => {
      vi.spyOn(console, "error").mockImplementation(() => {})
      // The page and its parent are missing, and the grandparent fails.
      mockApple({
        [`${base}/examplekit.json`]: async () =>
          new Response("Bad Gateway", { status: 502, statusText: "Bad Gateway" }),
      })

      const error = await fetchDocumentationPage("examplekit/widget/size").catch((e) => e)

      expect(error).not.toBeInstanceOf(NotFoundError)
      expect(error.message).toBe("Failed to fetch JSON: 502 Bad Gateway")
      expect(global.fetch).toHaveBeenCalledTimes(3)
    })
  })

  it("should handle network errors when fetching from Apple", async () => {
    // Mock a network error
    global.fetch = vi.fn().mockRejectedValue(new Error("Network error"))

    await expect(fetchJSONData("/documentation/swift/array")).rejects.toThrow("Network error")
    expect(global.fetch).toHaveBeenCalledTimes(1)
  })

  it("should fetch framework pages from the page JSON, not the navigator index", async () => {
    const mockFrameworkData = {
      metadata: { title: "Observation", roleHeading: "Framework" },
      references: {
        "doc://com.apple.documentation/documentation/Observation/Observable": {
          title: "Observable",
          url: "/documentation/observation/observable",
          abstract: [{ type: "text", text: "A type that emits notifications." }],
        },
      },
      primaryContentSections: [],
      topicSections: [
        {
          title: "Observable conformance",
          identifiers: ["doc://com.apple.documentation/documentation/Observation/Observable"],
        },
      ],
    }

    global.fetch = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify(mockFrameworkData), { status: 200 }))

    const jsonData = await fetchJSONData("/documentation/observation")
    const markdown = await renderFromJSON(
      jsonData,
      "https://developer.apple.com/documentation/observation",
    )

    expect(markdown).toContain("# Observation")
    expect(markdown).toContain("## Observable conformance")
    expect(markdown).toContain("[Observable](/documentation/observation/observable)")

    expect(global.fetch).toHaveBeenCalledTimes(1)
    expect(global.fetch).toHaveBeenCalledWith(
      "https://developer.apple.com/tutorials/data/documentation/observation.json",
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
      // robots.txt allows access
      .mockResolvedValueOnce(
        new Response("User-agent: *\nAllow: /", {
          status: 200,
          headers: { "Content-Type": "text/plain" },
        }),
      )
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

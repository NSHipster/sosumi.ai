/** biome-ignore-all lint/suspicious/noExplicitAny: pedantic type check */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { NotFoundError } from "../src/lib/fetch"
import {
  extractHIGPaths,
  fetchHIGPageData,
  fetchHIGTableOfContents,
  findHIGItemByPath,
  getHIGBreadcrumbs,
  type HIGPageJSON,
  type HIGTableOfContents,
  hasChildren,
  isHIGImageReference,
  isHIGTopicReference,
  renderHIGFromJSON,
  renderHIGTableOfContents,
} from "../src/lib/hig"
import higGettingStartedData from "./fixtures/hig/getting-started.json"
import higTocData from "./fixtures/hig/toc.json"

describe("HIG Module", () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  describe("Type Guards", () => {
    it("should correctly identify HIG image references", () => {
      const imageRef = {
        alt: "Test image",
        identifier: "test.svg",
        type: "icon" as const,
        variants: [],
      }

      const topicRef = {
        kind: "article" as const,
        role: "article" as const,
        title: "Test Topic",
        url: "/test",
        abstract: [],
        identifier: "test-id",
        type: "topic" as const,
      }

      expect(isHIGImageReference(imageRef)).toBe(true)
      expect(isHIGImageReference(topicRef)).toBe(false)
      expect(isHIGTopicReference(topicRef)).toBe(true)
      expect(isHIGTopicReference(imageRef)).toBe(false)
    })

    it("should correctly identify ToC items with children", () => {
      const itemWithChildren = {
        children: [{ path: "/test", title: "Test", type: "article" as const }],
        path: "/parent",
        title: "Parent",
        type: "symbol" as const,
      }

      const itemWithoutChildren = {
        path: "/single",
        title: "Single",
        type: "article" as const,
      }

      expect(hasChildren(itemWithChildren)).toBe(true)
      expect(hasChildren(itemWithoutChildren)).toBe(false)
    })
  })

  describe("Fetching Functions", () => {
    it("should fetch HIG table of contents successfully", async () => {
      global.fetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify(higTocData), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      )

      const result = await fetchHIGTableOfContents()

      expect(result).toEqual(higTocData)
      expect(global.fetch).toHaveBeenCalledWith(
        "https://developer.apple.com/tutorials/data/index/design--human-interface-guidelines",
        expect.objectContaining({
          headers: expect.objectContaining({
            Accept: "application/json",
            "Cache-Control": "no-cache",
          }),
        }),
      )
    })

    it("should fetch HIG page data successfully", async () => {
      global.fetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify(higGettingStartedData), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      )

      const result = await fetchHIGPageData("getting-started")

      expect(result).toEqual(higGettingStartedData)
      expect(global.fetch).toHaveBeenCalledWith(
        "https://developer.apple.com/tutorials/data/design/human-interface-guidelines/getting-started.json",
        expect.objectContaining({
          headers: expect.objectContaining({
            Accept: "application/json",
            "Cache-Control": "no-cache",
          }),
        }),
      )
    })

    it("should throw NotFoundError for 404 responses", async () => {
      global.fetch = vi.fn().mockResolvedValue(new Response("Not Found", { status: 404 }))

      await expect(fetchHIGTableOfContents()).rejects.toThrow(NotFoundError)
      await expect(fetchHIGPageData("nonexistent")).rejects.toThrow(NotFoundError)
    })

    it("should throw generic Error for other HTTP errors", async () => {
      global.fetch = vi
        .fn()
        .mockResolvedValue(new Response("Internal Server Error", { status: 500 }))

      await expect(fetchHIGTableOfContents()).rejects.toThrow(
        "Failed to fetch HIG ToC: 500 Internal Server Error",
      )
      await expect(fetchHIGPageData("test")).rejects.toThrow(
        "Failed to fetch HIG page: 500 Internal Server Error",
      )
    })

    it("should normalize path by removing leading/trailing slashes", async () => {
      global.fetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify(higGettingStartedData), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      )

      await fetchHIGPageData("/getting-started/")

      expect(global.fetch).toHaveBeenCalledWith(
        "https://developer.apple.com/tutorials/data/design/human-interface-guidelines/getting-started.json",
        expect.any(Object),
      )
    })
  })

  describe("Utility Functions", () => {
    const testToc = higTocData as HIGTableOfContents

    it("should extract all HIG paths from table of contents", () => {
      const paths = extractHIGPaths(testToc)

      expect(paths).toContain("getting-started")
      expect(paths).toContain("designing-for-ios")
      expect(paths).toContain("designing-for-macos")
      expect(paths).toContain("foundations")
      expect(paths).toContain("foundations/color")
      expect(paths).toContain("foundations/typography")
    })

    it("should find HIG item by path", () => {
      const item = findHIGItemByPath(testToc, "foundations/color")

      expect(item).toBeDefined()
      expect(item?.title).toBe("Color")
      expect(item?.type).toBe("article")
    })

    it("should return undefined for non-existent path", () => {
      const item = findHIGItemByPath(testToc, "nonexistent/path")

      expect(item).toBeUndefined()
    })

    it("should get breadcrumbs for nested HIG item", () => {
      const breadcrumbs = getHIGBreadcrumbs(testToc, "foundations/color")

      expect(breadcrumbs).toEqual(["Human Interface Guidelines", "Foundations", "Color"])
    })

    it("should return empty array for non-existent path breadcrumbs", () => {
      const breadcrumbs = getHIGBreadcrumbs(testToc, "nonexistent/path")

      expect(breadcrumbs).toEqual([])
    })

    it("should handle paths with leading/trailing slashes", () => {
      const item1 = findHIGItemByPath(testToc, "/foundations/color/")
      const item2 = findHIGItemByPath(testToc, "foundations/color")

      expect(item1?.title).toBe("Color")
      expect(item2?.title).toBe("Color")

      const breadcrumbs1 = getHIGBreadcrumbs(testToc, "/foundations/color/")
      const breadcrumbs2 = getHIGBreadcrumbs(testToc, "foundations/color")

      expect(breadcrumbs1).toEqual(breadcrumbs2)
    })
  })

  describe("Rendering Functions", () => {
    it("should render HIG table of contents to markdown", async () => {
      const result = await renderHIGTableOfContents(higTocData as HIGTableOfContents)

      expect(result).toContain("# Human Interface Guidelines")
      expect(result).toContain("## Getting started")
      expect(result).toContain("### Foundations")
      expect(result).toContain(
        "- [Designing for iOS](/design/human-interface-guidelines/designing-for-ios)",
      )
      expect(result).toContain(
        "- [Designing for macOS](/design/human-interface-guidelines/designing-for-macos)",
      )
      expect(result).toContain("- [Color](/design/human-interface-guidelines/foundations/color)")
      expect(result).toContain(
        "- [Typography](/design/human-interface-guidelines/foundations/typography)",
      )
    })

    it("should render HIG page with proper front matter", async () => {
      const result = await renderHIGFromJSON(
        higGettingStartedData as HIGPageJSON,
        "https://developer.apple.com/design/human-interface-guidelines/getting-started",
      )

      expect(result).toMatch(/^---\n/)
      expect(result).toContain("title: Getting started")
      expect(result).toContain(
        "description: Create an app or game that feels at home on every platform you support.",
      )
      expect(result).toContain(
        "source: https://developer.apple.com/design/human-interface-guidelines/getting-started",
      )
      expect(result).toMatch(/timestamp: \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/)
      expect(result).toMatch(/---\n\n/)
    })

    it("should render role heading correctly", async () => {
      const result = await renderHIGFromJSON(
        higGettingStartedData as HIGPageJSON,
        "https://developer.apple.com/design/human-interface-guidelines/getting-started",
      )

      expect(result).toContain("**Guide Collection**")
    })

    it("should render abstract as blockquote", async () => {
      const result = await renderHIGFromJSON(
        higGettingStartedData as HIGPageJSON,
        "https://developer.apple.com/design/human-interface-guidelines/getting-started",
      )

      expect(result).toContain(
        "> Create an app or game that feels at home on every platform you support.",
      )
    })

    it("should render link grids from primary content sections", async () => {
      const result = await renderHIGFromJSON(
        higGettingStartedData as HIGPageJSON,
        "https://developer.apple.com/design/human-interface-guidelines/getting-started",
      )

      expect(result).toContain(
        "- [Designing for iOS](/design/human-interface-guidelines/designing-for-ios) - People depend on their iPhone to help them stay connected, play games, view media, accomplish tasks, and track personal data in any location and while on the go.",
      )
      expect(result).toContain(
        "- [Designing for macOS](/design/human-interface-guidelines/designing-for-macos) - People rely on the power, spaciousness, and flexibility of a Mac as they perform in-depth productivity tasks, view media or content, and play games, often using several apps at once.",
      )
    })

    it("should include proper footer", async () => {
      const tocResult = await renderHIGTableOfContents(higTocData as HIGTableOfContents)
      const pageResult = await renderHIGFromJSON(
        higGettingStartedData as HIGPageJSON,
        "https://developer.apple.com/design/human-interface-guidelines/getting-started",
      )

      expect(tocResult).toContain(
        "*Extracted by [sosumi.ai](https://sosumi.ai) - Making Apple docs AI-readable.*",
      )
      expect(tocResult).toContain(
        "*This is unofficial content. All Human Interface Guidelines belong to Apple Inc.*",
      )

      expect(pageResult).toContain(
        "*Extracted by [sosumi.ai](https://sosumi.ai) - Making Apple docs AI-readable.*",
      )
      expect(pageResult).toContain(
        "*This is unofficial content. All Human Interface Guidelines belong to Apple Inc.*",
      )
    })

    it("should handle content with headings and paragraphs", async () => {
      const testData = {
        ...higGettingStartedData,
        primaryContentSections: [
          {
            kind: "content" as const,
            content: [
              {
                type: "heading",
                level: 2,
                text: "Overview",
              },
              {
                type: "paragraph",
                inlineContent: [
                  {
                    type: "text",
                    text: "This is a test paragraph with ",
                  },
                  {
                    type: "emphasis",
                    inlineContent: [
                      {
                        type: "text",
                        text: "emphasized text",
                      },
                    ],
                  },
                  {
                    type: "text",
                    text: ".",
                  },
                ],
              },
            ],
          },
        ],
      } as HIGPageJSON

      const result = await renderHIGFromJSON(
        testData,
        "https://developer.apple.com/design/human-interface-guidelines/test",
      )

      expect(result).toContain("## Overview")
      expect(result).toContain("This is a test paragraph with *emphasized text*.")
    })

    it("should handle code listings", async () => {
      const testData = {
        ...higGettingStartedData,
        primaryContentSections: [
          {
            kind: "content" as const,
            content: [
              {
                type: "codeListing",
                code: 'print("Hello, world!")',
                syntax: "swift",
              },
            ],
          },
        ],
      } as HIGPageJSON

      const result = await renderHIGFromJSON(
        testData,
        "https://developer.apple.com/design/human-interface-guidelines/test",
      )

      expect(result).toContain('```swift\nprint("Hello, world!")\n```')
    })

    it("should handle unordered and ordered lists", async () => {
      const testData = {
        ...higGettingStartedData,
        primaryContentSections: [
          {
            kind: "content" as const,
            content: [
              {
                type: "unorderedList",
                items: [
                  {
                    content: [
                      {
                        type: "paragraph",
                        inlineContent: [{ type: "text", text: "First item" }],
                      },
                    ],
                  },
                  {
                    content: [
                      {
                        type: "paragraph",
                        inlineContent: [{ type: "text", text: "Second item" }],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      } as HIGPageJSON

      const result = await renderHIGFromJSON(
        testData,
        "https://developer.apple.com/design/human-interface-guidelines/test",
      )

      expect(result).toContain("- First item")
      expect(result).toContain("- Second item")
    })
  })

  describe("Edge Cases", () => {
    it("should handle empty or minimal data gracefully", async () => {
      const minimalTocData = {
        includedArchiveIdentifiers: [],
        interfaceLanguages: {
          swift: [],
        },
        references: {},
        schemaVersion: { major: 0, minor: 3, patch: 0 },
      } as HIGTableOfContents

      const result = await renderHIGTableOfContents(minimalTocData)

      expect(result).toContain("# Human Interface Guidelines")
      expect(result).toContain(
        "*This is unofficial content. All Human Interface Guidelines belong to Apple Inc.*",
      )
    })

    it("should handle missing abstract gracefully", async () => {
      const testData = {
        ...higGettingStartedData,
        abstract: [],
      } as HIGPageJSON

      const result = await renderHIGFromJSON(
        testData,
        "https://developer.apple.com/design/human-interface-guidelines/test",
      )

      expect(result).not.toContain(">")
    })

    it("should handle missing title gracefully", async () => {
      const testData = {
        ...higGettingStartedData,
        metadata: {
          ...higGettingStartedData.metadata,
          title: undefined as any,
        },
      } as HIGPageJSON

      const result = await renderHIGFromJSON(
        testData,
        "https://developer.apple.com/design/human-interface-guidelines/test",
      )

      expect(result).not.toContain("# undefined")
      expect(result).toContain("---")
    })
  })
})

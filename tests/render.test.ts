/** biome-ignore-all lint/suspicious/noExplicitAny: pedantic type check */
import { describe, expect, it } from "vitest"
import { renderFromJSON } from "../src/lib/reference"
import {
  circularReferenceData,
  deeplyNestedData,
  recursiveListData,
} from "./mocks/infinite-loop-data"

describe("Render Function", () => {
  // Set a reasonable timeout for these tests
  const TIMEOUT_MS = 5000

  describe("Front Matter Generation", () => {
    it("should generate proper YAML front matter with title from metadata", async () => {
      const data = {
        metadata: {
          title: "SwiftUI View | Apple Developer Documentation",
        },
      }

      const result = await renderFromJSON(data as any, "https://test.com")

      expect(result).toMatch(
        /^---\ntitle: SwiftUI View\nsource: https:\/\/test\.com\ntimestamp: \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\n---\n\n/,
      )
    })

    it("should use interfaceLanguages title as fallback", async () => {
      const data = {
        interfaceLanguages: {
          swift: [{ title: "Interface Title" }],
        },
      }

      const result = await renderFromJSON(data as any, "https://test.com")

      expect(result).toContain("title: Interface Title")
    })

    it("should include description from abstract", async () => {
      const data = {
        metadata: { title: "Test Title" },
        abstract: [
          { type: "text", text: "This is the abstract description." },
          { type: "text", text: " Additional text." },
        ],
      }

      const result = await renderFromJSON(data as any, "https://test.com")

      expect(result).toContain("description: This is the abstract description. Additional text.")
    })

    it("should handle missing title gracefully", async () => {
      const data = {}

      const result = await renderFromJSON(data as any, "https://test.com")

      expect(result).toMatch(
        /^---\nsource: https:\/\/test\.com\ntimestamp: \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\n---\n\n/,
      )
      expect(result).not.toContain("title:")
    })
  })

  describe("Breadcrumb Navigation", () => {
    it("should generate breadcrumbs for documentation URLs", async () => {
      const testCases = [
        {
          url: "https://developer.apple.com/documentation/swiftui/view",
          expected: "**Navigation:** [Swiftui](/documentation/swiftui)\n\n",
        },
        {
          url: "https://developer.apple.com/documentation/swift/array/append",
          expected:
            "**Navigation:** [Swift](/documentation/swift) › [array](/documentation/swift/array)\n\n",
        },
        {
          url: "https://developer.apple.com/documentation/foundation/nsstring/init",
          expected:
            "**Navigation:** [Foundation](/documentation/foundation) › [nsstring](/documentation/foundation/nsstring)\n\n",
        },
      ]

      for (const testCase of testCases) {
        const result = await renderFromJSON({} as any, testCase.url)
        expect(result).toContain(testCase.expected)
      }
    })

    it("should not generate breadcrumbs for short paths", async () => {
      const shortUrls = [
        "https://developer.apple.com/documentation",
        "https://developer.apple.com/documentation/swiftui",
        "https://example.com/short",
      ]

      for (const url of shortUrls) {
        const result = await renderFromJSON({} as any, url)
        expect(result).not.toContain("**Navigation:**")
      }
    })

    it("should capitalize framework names properly", async () => {
      const result = await renderFromJSON(
        {} as any,
        "https://developer.apple.com/documentation/swiftui/view",
      )
      expect(result).toContain("[Swiftui](/documentation/swiftui)") // First letter capitalized
    })
  })

  describe("Declaration Rendering", () => {
    it("should render Swift declarations with proper formatting", async () => {
      const data = {
        metadata: { title: "Declaration Test" },
        primaryContentSections: [
          {
            kind: "declarations",
            declarations: [
              {
                tokens: [
                  { kind: "keyword", text: "func" },
                  { kind: "text", text: " " },
                  { kind: "identifier", text: "myFunction" },
                  { kind: "text", text: "(" },
                  { kind: "externalParam", text: "param" },
                  { kind: "text", text: ": " },
                  { kind: "typeIdentifier", text: "String" },
                  { kind: "text", text: ")" },
                ],
              },
            ],
          },
        ],
      }

      const result = await renderFromJSON(data as any, "https://test.com")

      expect(result).toContain("```swift\nfunc myFunction(param: String)\n```")
    })

    it("should handle multiple declarations", async () => {
      const data = {
        metadata: { title: "Multiple Declarations" },
        primaryContentSections: [
          {
            kind: "declarations",
            declarations: [
              {
                tokens: [
                  { kind: "keyword", text: "var" },
                  { kind: "text", text: " " },
                  { kind: "identifier", text: "property1" },
                  { kind: "text", text: ": String" },
                ],
              },
              {
                tokens: [
                  { kind: "keyword", text: "var" },
                  { kind: "text", text: " " },
                  { kind: "identifier", text: "property2" },
                  { kind: "text", text: ": Int" },
                ],
              },
            ],
          },
        ],
      }

      const result = await renderFromJSON(data as any, "https://test.com")

      expect(result).toContain("```swift\nvar property1: String\n```")
      expect(result).toContain("```swift\nvar property2: Int\n```")
    })

    it("should handle empty or malformed token arrays", async () => {
      const data = {
        metadata: { title: "Malformed Declarations" },
        primaryContentSections: [
          {
            kind: "declarations",
            declarations: [
              { tokens: [] },
              { tokens: [{ text: null }, { kind: "text" }, null] },
              { tokens: null },
            ],
          },
        ],
      }

      const result = await renderFromJSON(data as any, "https://test.com")

      expect(result).toBeDefined()
      expect(result).toContain("# Malformed Declarations")
    })
  })

  describe("Aside/Callout Mapping", () => {
    it("should map aside styles to proper GitHub callouts", async () => {
      const asideStyles = [
        { style: "warning", expected: "[!WARNING]" },
        { style: "important", expected: "[!IMPORTANT]" },
        { style: "caution", expected: "[!CAUTION]" },
        { style: "tip", expected: "[!TIP]" },
        { style: "deprecated", expected: "[!WARNING]" },
        { style: "note", expected: "[!NOTE]" },
        { style: "unknown", expected: "[!NOTE]" },
      ]

      for (const test of asideStyles) {
        const data = {
          metadata: { title: `${test.style} Test` },
          primaryContentSections: [
            {
              kind: "content",
              content: [
                {
                  type: "aside",
                  style: test.style,
                  content: [
                    {
                      type: "paragraph",
                      inlineContent: [{ type: "text", text: `This is a ${test.style} aside.` }],
                    },
                  ],
                },
              ],
            },
          ],
        }

        const result = await renderFromJSON(data as any, "https://test.com")
        expect(result).toContain(`> ${test.expected}`)
        expect(result).toContain(`> This is a ${test.style} aside.`)
      }
    })

    it("should handle aside without style (default to note)", async () => {
      const data = {
        metadata: { title: "Default Aside" },
        primaryContentSections: [
          {
            kind: "content",
            content: [
              {
                type: "aside",
                content: [
                  {
                    type: "paragraph",
                    inlineContent: [{ type: "text", text: "Default aside content." }],
                  },
                ],
              },
            ],
          },
        ],
      }

      const result = await renderFromJSON(data as any, "https://test.com")
      expect(result).toContain("> [!NOTE]")
      expect(result).toContain("> Default aside content.")
    })
  })

  describe("Table rendering", () => {
    it("should render tables with header row and body rows", async () => {
      const data = {
        metadata: { title: "Import Options" },
        primaryContentSections: [
          {
            kind: "content",
            content: [
              {
                type: "table",
                header: "row",
                rows: [
                  [
                    [{ type: "paragraph", inlineContent: [{ type: "text", text: "Attributes" }] }],
                    [{ type: "paragraph", inlineContent: [{ type: "text", text: "Description" }] }],
                  ],
                  [
                    [
                      {
                        type: "paragraph",
                        inlineContent: [{ type: "codeVoice", code: "key" }],
                      },
                    ],
                    [
                      {
                        type: "paragraph",
                        inlineContent: [{ type: "text", text: "The value for the import option." }],
                      },
                    ],
                  ],
                ],
              },
            ],
          },
        ],
      }

      const result = await renderFromJSON(data as any, "https://test.com")
      expect(result).toContain("| Attributes | Description |")
      expect(result).toContain("| --- | --- |")
      expect(result).toContain("| `key` | The value for the import option. |")
    })
  })

  describe("Inline image rendering", () => {
    it("should render inline image with alt and URL from reference", async () => {
      const data = {
        metadata: { title: "Image Test" },
        primaryContentSections: [
          {
            kind: "content",
            content: [
              {
                type: "paragraph",
                inlineContent: [
                  { type: "text", text: "See figure: " },
                  { type: "image", identifier: "media-123" },
                ],
              },
            ],
          },
        ],
        references: {
          "media-123": {
            type: "image",
            identifier: "media-123",
            alt: "Screenshot showing the timeline.",
            variants: [
              {
                traits: ["2x", "light"],
                url: "https://docs-assets.developer.apple.com/published/media-123%402x.png",
              },
            ],
          } as any,
        },
      }

      const result = await renderFromJSON(data as any, "https://test.com")
      expect(result).toContain(
        "![Screenshot showing the timeline.](https://docs-assets.developer.apple.com/published/media-123%402x.png)",
      )
    })

    it("should render image with empty alt when alt is missing", async () => {
      const data = {
        metadata: { title: "Image Test" },
        primaryContentSections: [
          {
            kind: "content",
            content: [
              {
                type: "paragraph",
                inlineContent: [{ type: "image", identifier: "media-no-alt" }],
              },
            ],
          },
        ],
        references: {
          "media-no-alt": {
            type: "image",
            identifier: "media-no-alt",
            variants: [{ url: "https://example.com/diagram.png" }],
          } as any,
        },
      }

      const result = await renderFromJSON(data as any, "https://test.com")
      expect(result).toContain("![](https://example.com/diagram.png)")
    })

    it("should output nothing when image reference is missing", async () => {
      const data = {
        metadata: { title: "Image Test" },
        primaryContentSections: [
          {
            kind: "content",
            content: [
              {
                type: "paragraph",
                inlineContent: [
                  { type: "text", text: "Before " },
                  { type: "image", identifier: "media-missing" },
                  { type: "text", text: " after." },
                ],
              },
            ],
          },
        ],
        references: {},
      }

      const result = await renderFromJSON(data as any, "https://test.com")
      expect(result).toContain("Before  after.")
      expect(result).not.toMatch(/!\[.*\]\(.*\)/)
    })

    it("should output nothing when image reference has no variants URL", async () => {
      const data = {
        metadata: { title: "Image Test" },
        primaryContentSections: [
          {
            kind: "content",
            content: [
              {
                type: "paragraph",
                inlineContent: [{ type: "image", identifier: "media-no-url" }],
              },
            ],
          },
        ],
        references: {
          "media-no-url": {
            type: "image",
            identifier: "media-no-url",
            alt: "Missing URL",
            variants: [],
          } as any,
        },
      }

      const result = await renderFromJSON(data as any, "https://test.com")
      expect(result).not.toMatch(/!\[.*\]\(https?:\/\//)
    })
  })

  describe("URL Conversion", () => {
    it("should convert SwiftUI doc identifiers to proper URLs", async () => {
      const data = {
        metadata: { title: "URL Conversion Test" },
        primaryContentSections: [
          {
            kind: "content",
            content: [
              {
                type: "paragraph",
                inlineContent: [
                  {
                    type: "reference",
                    identifier: "doc://com.apple.SwiftUI/documentation/SwiftUI/View",
                    title: "View",
                  },
                ],
              },
            ],
          },
        ],
      }

      const result = await renderFromJSON(data as any, "https://test.com")
      expect(result).toContain("[View](/documentation/SwiftUI/View)")
    })

    it("should handle other Apple framework identifiers", async () => {
      const identifiers = [
        {
          id: "doc://com.apple.Foundation/documentation/Foundation/NSString",
          expected: "/documentation/Foundation/NSString",
        },
        {
          id: "doc://com.apple.Swift/documentation/Swift/Array",
          expected: "/documentation/Swift/Array",
        },
        {
          id: "doc://com.apple.UIKit/documentation/UIKit/UIView",
          expected: "/documentation/UIKit/UIView",
        },
      ]

      for (const test of identifiers) {
        const data = {
          metadata: { title: "Identifier Test" },
          primaryContentSections: [
            {
              kind: "content",
              content: [
                {
                  type: "paragraph",
                  inlineContent: [
                    {
                      type: "reference",
                      identifier: test.id,
                      title: "Test Reference",
                    },
                  ],
                },
              ],
            },
          ],
        }

        const result = await renderFromJSON(data as any, "https://test.com")
        expect(result).toContain(`[Test Reference](${test.expected})`)
      }
    })

    it("should use reference URL when available", async () => {
      const data = {
        metadata: { title: "Reference URL Test" },
        primaryContentSections: [
          {
            kind: "content",
            content: [
              {
                type: "paragraph",
                inlineContent: [
                  {
                    type: "reference",
                    identifier: "doc://test/ref",
                    title: "Test Reference",
                  },
                ],
              },
            ],
          },
        ],
        references: {
          "doc://test/ref": {
            title: "Reference Title",
            url: "https://custom.url/path",
          },
        },
      }

      const result = await renderFromJSON(data as any, "https://test.com")
      expect(result).toContain("[Test Reference](https://custom.url/path)")
    })

    it("should fallback to identifier when no reference URL available", async () => {
      const data = {
        metadata: { title: "Fallback Test" },
        primaryContentSections: [
          {
            kind: "content",
            content: [
              {
                type: "paragraph",
                inlineContent: [
                  {
                    type: "reference",
                    identifier: "unknown://identifier/format",
                    title: "Unknown Reference",
                  },
                ],
              },
            ],
          },
        ],
      }

      const result = await renderFromJSON(data as any, "https://test.com")
      expect(result).toContain("[Unknown Reference](unknown://identifier/format)")
    })
  })

  describe("Title Extraction from Identifiers", () => {
    it("should extract readable titles from method signatures", async () => {
      const methodIdentifiers = [
        {
          id: "doc://test/init(exactly:)-63925",
          expectedTitle: "init(exactly:)",
        },
        {
          id: "doc://test/append(_:)-1234",
          expectedTitle: "append(_:)",
        },
        {
          id: "doc://test/forEach(perform:)-abcd",
          expectedTitle: "forEach(perform:)",
        },
      ]

      for (const test of methodIdentifiers) {
        const data = {
          metadata: { title: "Title Extraction Test" },
          topicSections: [
            {
              title: "Methods",
              identifiers: [test.id],
            },
          ],
        }

        const result = await renderFromJSON(data as any, "https://test.com")
        expect(result).toContain(`[${test.expectedTitle}]`)
      }
    })

    it("should convert camelCase identifiers to readable format", async () => {
      const camelCaseIdentifiers = [
        {
          id: "doc://test/somePropertyName",
          expectedTitle: "some Property Name",
        },
        {
          id: "doc://test/anotherMethodName",
          expectedTitle: "another Method Name",
        },
        {
          id: "doc://test/XMLHttpRequest",
          expectedTitle: "XMLHttp Request",
        },
      ]

      for (const test of camelCaseIdentifiers) {
        const data = {
          metadata: { title: "CamelCase Test" },
          topicSections: [
            {
              title: "Properties",
              identifiers: [test.id],
            },
          ],
        }

        const result = await renderFromJSON(data as any, "https://test.com")
        expect(result).toContain(`[${test.expectedTitle}]`)
      }
    })

    it("should preserve method signatures with parentheses", async () => {
      const methodSignatures = [
        "init()",
        "init(from:)",
        "append(_:)",
        "forEach(perform:)",
        "reduce(_:_:)",
      ]

      for (const signature of methodSignatures) {
        const data = {
          metadata: { title: "Method Signature Test" },
          topicSections: [
            {
              title: "Methods",
              identifiers: [`doc://test/${signature}`],
            },
          ],
        }

        const result = await renderFromJSON(data as any, "https://test.com")
        expect(result).toContain(`[${signature}]`)
      }
    })

    it("should handle disambiguation suffixes correctly", async () => {
      const disambiguationIdentifiers = [
        {
          id: "doc://test/body-8kl5o",
          expectedTitle: "body",
        },
        {
          id: "doc://test/someProperty-abc123",
          expectedTitle: "some Property",
        },
        {
          id: "doc://test/myMethod-xyz789",
          expectedTitle: "my Method",
        },
        {
          id: "doc://test/init(exactly:)-63925",
          expectedTitle: "init(exactly:)",
        },
      ]

      for (const test of disambiguationIdentifiers) {
        const data = {
          metadata: { title: "Disambiguation Test" },
          topicSections: [
            {
              title: "Properties",
              identifiers: [test.id],
            },
          ],
        }

        const result = await renderFromJSON(data as any, "https://test.com")
        expect(result).toContain(`[${test.expectedTitle}]`)
      }
    })
  })

  describe("Platform Information Rendering", () => {
    it("should render platform availability information", async () => {
      const data = {
        metadata: {
          title: "Platform Test",
          platforms: [
            { name: "iOS", introducedAt: "14.0" },
            { name: "macOS", introducedAt: "11.0", beta: true },
            { name: "watchOS", introducedAt: "7.0" },
          ],
        },
      }

      const result = await renderFromJSON(data as any, "https://test.com")

      expect(result).toContain("**Available on:** iOS 14.0+, macOS 11.0+ Beta, watchOS 7.0+")
    })

    it("should handle single platform", async () => {
      const data = {
        metadata: {
          title: "Single Platform Test",
          platforms: [{ name: "iOS", introducedAt: "15.0" }],
        },
      }

      const result = await renderFromJSON(data as any, "https://test.com")

      expect(result).toContain("**Available on:** iOS 15.0+")
    })

    it("should handle platforms without beta flag", async () => {
      const data = {
        metadata: {
          title: "Platform Without Flag Test",
          platforms: [{ name: "iOS", introducedAt: "13.0", beta: false }],
        },
      }

      const result = await renderFromJSON(data as any, "https://test.com")

      expect(result).toContain("**Available on:** iOS 13.0+")
      expect(result).not.toContain(" Beta")
    })
  })

  describe("renderFromJSON", () => {
    it(
      "should handle circular references without infinite loop",
      async () => {
        const startTime = Date.now()

        const result = await renderFromJSON(circularReferenceData as any, "https://test.com")

        const elapsedTime = Date.now() - startTime

        // Should complete within reasonable time
        expect(elapsedTime).toBeLessThan(TIMEOUT_MS)
        expect(result).toContain("Test Circular Reference")
        expect(result).toContain("Reference 1")
        expect(result).toContain("Reference 2")
      },
      TIMEOUT_MS,
    )

    it(
      "should handle deeply nested inline content without stack overflow",
      async () => {
        const startTime = Date.now()

        const result = await renderFromJSON(deeplyNestedData as any, "https://test.com")

        const elapsedTime = Date.now() - startTime

        expect(elapsedTime).toBeLessThan(TIMEOUT_MS)
        expect(result).toContain("Test Deep Nesting")
        expect(result).toContain("Very deeply nested text")
        // Should have proper markdown formatting
        expect(result).toContain("***")
      },
      TIMEOUT_MS,
    )

    it(
      "should handle recursive list structures",
      async () => {
        const startTime = Date.now()

        const result = await renderFromJSON(recursiveListData as any, "https://test.com")

        const elapsedTime = Date.now() - startTime

        expect(elapsedTime).toBeLessThan(TIMEOUT_MS)
        expect(result).toContain("Test Recursive Lists")
        expect(result).toContain("Item 1 with")
        expect(result).toContain("Recursive Reference")
      },
      TIMEOUT_MS,
    )
  })

  describe("Performance tests", () => {
    it("should complete complex rendering within reasonable time", async () => {
      // Create a more complex document structure
      const complexData = {
        metadata: {
          title: "Complex Document",
          roleHeading: "Framework",
        },
        primaryContentSections: [
          {
            kind: "content",
            content: Array.from({ length: 50 }, (_, i) => ({
              type: "paragraph",
              inlineContent: [
                {
                  type: "text",
                  text: `Paragraph ${i} with `,
                },
                {
                  type: "reference",
                  identifier: `doc://test/ref${i}`,
                  title: `Reference ${i}`,
                },
                {
                  type: "emphasis",
                  inlineContent: [
                    {
                      type: "strong",
                      inlineContent: [
                        {
                          type: "text",
                          text: "nested content",
                        },
                      ],
                    },
                  ],
                },
              ],
            })),
          },
        ],
        references: Object.fromEntries(
          Array.from({ length: 50 }, (_, i) => [
            `doc://test/ref${i}`,
            {
              title: `Reference ${i}`,
              url: `/test/ref${i}`,
            },
          ]),
        ),
      }

      const startTime = Date.now()

      const result = await renderFromJSON(complexData as any, "https://test.com")

      const elapsedTime = Date.now() - startTime

      // Should complete within 2 seconds even for complex documents
      expect(elapsedTime).toBeLessThan(2000)
      expect(result).toContain("Complex Document")
      expect(result.split("Paragraph").length).toBeGreaterThan(45) // Most paragraphs should be rendered
    })
  })

  describe("Edge cases that could cause infinite loops", () => {
    it("should handle self-referencing emphasis/strong tags", async () => {
      const problematicData = {
        metadata: { title: "Self Reference Test" },
        primaryContentSections: [
          {
            kind: "content",
            content: [
              {
                type: "paragraph",
                inlineContent: [
                  {
                    type: "emphasis",
                    inlineContent: [
                      {
                        type: "strong",
                        inlineContent: [
                          {
                            type: "emphasis", // Nested emphasis could cause issues
                            inlineContent: [
                              {
                                type: "text",
                                text: "deeply nested",
                              },
                            ],
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
        references: {},
      }

      const startTime = Date.now()
      const result = await renderFromJSON(problematicData as any, "https://test.com")
      const elapsedTime = Date.now() - startTime

      expect(elapsedTime).toBeLessThan(1000)
      expect(result).toContain("deeply nested")
      expect(result).toContain("***") // Should have proper markdown formatting
    })

    it("should handle references that point to non-existent entries", async () => {
      const missingRefData = {
        metadata: { title: "Missing Reference Test" },
        primaryContentSections: [
          {
            kind: "content",
            content: [
              {
                type: "paragraph",
                inlineContent: [
                  {
                    type: "reference",
                    identifier: "doc://test/nonexistent",
                    title: "Missing Reference",
                  },
                ],
              },
            ],
          },
        ],
        references: {}, // Empty references - the reference doesn't exist
      }

      const startTime = Date.now()
      const result = await renderFromJSON(missingRefData as any, "https://test.com")
      const elapsedTime = Date.now() - startTime

      expect(elapsedTime).toBeLessThan(1000)
      expect(result).toContain("Missing Reference")
    })
  })

  describe("Recursion Protection and Depth Limiting", () => {
    it("should prevent infinite loops with extremely deep content nesting", async () => {
      // Create extremely deep nesting that would cause stack overflow without protection
      const createExtremelyDeepContent = (depth: number): any => {
        if (depth <= 0) {
          return {
            type: "paragraph",
            inlineContent: [
              {
                type: "text",
                text: "Bottom of the rabbit hole",
              },
            ],
          }
        }

        return {
          type: "aside",
          style: "note",
          content: [createExtremelyDeepContent(depth - 1)],
        }
      }

      const extremeData = {
        metadata: { title: "Extreme Depth Test" },
        primaryContentSections: [
          {
            kind: "content",
            content: [createExtremelyDeepContent(100)], // 100 levels deep
          },
        ],
        references: {},
      }

      const startTime = Date.now()
      const result = await renderFromJSON(extremeData as any, "https://test.com")
      const elapsedTime = Date.now() - startTime

      // Should complete quickly due to depth limiting
      expect(elapsedTime).toBeLessThan(1000)
      expect(result).toContain("Extreme Depth Test")
      // Should contain the depth limiting message
      expect(result).toContain("[Content too deeply nested]")
    })

    it("should prevent infinite loops with extremely deep inline content nesting", async () => {
      // Create extremely deep inline content nesting
      const createExtremelyDeepInline = (depth: number): any => {
        if (depth <= 0) {
          return {
            type: "text",
            text: "Deep inline text",
          }
        }

        return {
          type: depth % 2 === 0 ? "emphasis" : "strong",
          inlineContent: [createExtremelyDeepInline(depth - 1)],
        }
      }

      const extremeInlineData = {
        metadata: { title: "Extreme Inline Depth Test" },
        primaryContentSections: [
          {
            kind: "content",
            content: [
              {
                type: "paragraph",
                inlineContent: [createExtremelyDeepInline(50)], // 50 levels deep
              },
            ],
          },
        ],
        references: {},
      }

      const startTime = Date.now()
      const result = await renderFromJSON(extremeInlineData as any, "https://test.com")
      const elapsedTime = Date.now() - startTime

      // Should complete quickly due to depth limiting
      expect(elapsedTime).toBeLessThan(1000)
      expect(result).toContain("Extreme Inline Depth Test")
      // Should contain the depth limiting message
      expect(result).toContain("[Inline content too deeply nested]")
    })

    it("should handle mixed deep nesting scenarios", async () => {
      // Create a scenario with both deep content and deep inline nesting
      const mixedDeepData = {
        metadata: { title: "Mixed Deep Nesting Test" },
        primaryContentSections: [
          {
            kind: "content",
            content: Array.from({ length: 30 }, (_, i) => ({
              type: "unorderedList",
              items: [
                {
                  content: [
                    {
                      type: "paragraph",
                      inlineContent: Array.from({ length: 15 }, (_, j) => ({
                        type: j % 2 === 0 ? "emphasis" : "strong",
                        inlineContent: [
                          {
                            type: "text",
                            text: `Level ${i}-${j}`,
                          },
                        ],
                      })),
                    },
                  ],
                },
              ],
            })),
          },
        ],
        references: {},
      }

      const startTime = Date.now()
      const result = await renderFromJSON(mixedDeepData as any, "https://test.com")
      const elapsedTime = Date.now() - startTime

      // Should complete within reasonable time
      expect(elapsedTime).toBeLessThan(3000)
      expect(result).toContain("Mixed Deep Nesting Test")
      // Should render at least some content before hitting limits
      expect(result.split("Level").length).toBeGreaterThan(10)
    })

    it("should handle circular-like structures gracefully", async () => {
      // Create a structure that could potentially cause infinite loops
      const circularLikeData = {
        metadata: { title: "Circular-like Structure Test" },
        primaryContentSections: [
          {
            kind: "content",
            content: [
              {
                type: "aside",
                style: "note",
                content: [
                  {
                    type: "unorderedList",
                    items: [
                      {
                        content: [
                          {
                            type: "aside",
                            style: "warning",
                            content: [
                              {
                                type: "paragraph",
                                inlineContent: [
                                  {
                                    type: "emphasis",
                                    inlineContent: [
                                      {
                                        type: "strong",
                                        inlineContent: [
                                          {
                                            type: "emphasis",
                                            inlineContent: [
                                              {
                                                type: "text",
                                                text: "Deeply nested content that could cause issues",
                                              },
                                            ],
                                          },
                                        ],
                                      },
                                    ],
                                  },
                                ],
                              },
                            ],
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
        references: {},
      }

      const startTime = Date.now()
      const result = await renderFromJSON(circularLikeData as any, "https://test.com")
      const elapsedTime = Date.now() - startTime

      expect(elapsedTime).toBeLessThan(2000)
      expect(result).toContain("Circular-like Structure Test")
      expect(result).toContain("Deeply nested content")
    })
  })

  describe("Extreme Nesting Stress Tests", () => {
    it("should handle very deep nesting without stack overflow", async () => {
      // Create data with very deep nesting that could cause stack overflow
      const createDeepNesting = (depth: number): any => {
        if (depth <= 0) {
          return {
            type: "text",
            text: "Deep text",
          }
        }

        return {
          type: depth % 2 === 0 ? "emphasis" : "strong",
          inlineContent: [createDeepNesting(depth - 1)],
        }
      }

      const extremeData = {
        metadata: { title: "Extreme Nesting Test" },
        primaryContentSections: [
          {
            kind: "content",
            content: [
              {
                type: "paragraph",
                inlineContent: [createDeepNesting(100)], // 100 levels deep
              },
            ],
          },
        ],
        references: {},
      }

      const startTime = Date.now()
      const result = await renderFromJSON(extremeData as any, "https://test.com")
      const elapsedTime = Date.now() - startTime

      expect(elapsedTime).toBeLessThan(2000) // Should complete within 2 seconds
      // Should contain the depth limiting message instead of the deep text
      expect(result).toContain("[Inline content too deeply nested]")
    })
  })

  describe("Malformed Content and Edge Cases", () => {
    it("should handle malformed inlineContent that could cause infinite loops", async () => {
      // Simulate malformed data that might come from Apple's API
      const malformedData = {
        metadata: { title: "Malformed Content Test" },
        primaryContentSections: [
          {
            kind: "content",
            content: [
              {
                type: "paragraph",
                inlineContent: [
                  {
                    type: "emphasis",
                    inlineContent: [
                      {
                        type: "strong",
                        inlineContent: [
                          {
                            type: "emphasis",
                            inlineContent: [
                              {
                                type: "emphasis", // Multiple nested emphasis
                                inlineContent: [
                                  {
                                    type: "text",
                                    text: "nested text",
                                  },
                                ],
                              },
                            ],
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
        references: {},
      }

      const startTime = Date.now()
      const result = await renderFromJSON(malformedData as any, "https://test.com")
      const elapsedTime = Date.now() - startTime

      expect(elapsedTime).toBeLessThan(5000)
      expect(result).toContain("nested text")
    })

    it("should handle references that might reference themselves", async () => {
      // Test circular reference scenario that might occur in real Apple docs
      const circularRefData = {
        metadata: { title: "Circular Reference Test" },
        primaryContentSections: [
          {
            kind: "content",
            content: [
              {
                type: "paragraph",
                inlineContent: [
                  {
                    type: "reference",
                    identifier: "doc://com.apple.SwiftUI/documentation/swiftui/view",
                    title: "View",
                  },
                ],
              },
            ],
          },
        ],
        references: {
          "doc://com.apple.SwiftUI/documentation/swiftui/view": {
            title: "View",
            url: "/documentation/swiftui/view",
            abstract: [
              {
                type: "text",
                text: "A type that represents part of your app's user interface and provides modifiers that you use to configure views. See ",
              },
              {
                type: "reference",
                identifier: "doc://com.apple.SwiftUI/documentation/swiftui/view", // Self-reference!
                title: "View",
              },
            ],
          },
        },
      }

      const startTime = Date.now()
      const result = await renderFromJSON(circularRefData as any, "https://test.com")
      const elapsedTime = Date.now() - startTime

      expect(elapsedTime).toBeLessThan(5000)
      expect(result).toContain("View")
    })

    it("should handle deeply nested list structures with references", async () => {
      // Simulate complex nested lists that might appear in Apple documentation
      const createNestedList = (depth: number): any => {
        if (depth <= 0) {
          return {
            content: [
              {
                type: "paragraph",
                inlineContent: [
                  {
                    type: "reference",
                    identifier: `doc://test/ref${depth}`,
                    title: `Reference ${depth}`,
                  },
                ],
              },
            ],
          }
        }

        return {
          content: [
            {
              type: "paragraph",
              inlineContent: [
                {
                  type: "text",
                  text: `Level ${depth} with `,
                },
                {
                  type: "emphasis",
                  inlineContent: [
                    {
                      type: "reference",
                      identifier: `doc://test/ref${depth}`,
                      title: `Reference ${depth}`,
                    },
                  ],
                },
              ],
            },
            {
              type: "unorderedList",
              items: [createNestedList(depth - 1)],
            },
          ],
        }
      }

      const nestedListData = {
        metadata: { title: "Nested List Test" },
        primaryContentSections: [
          {
            kind: "content",
            content: [
              {
                type: "unorderedList",
                items: [createNestedList(20)], // 20 levels deep
              },
            ],
          },
        ],
        references: Object.fromEntries(
          Array.from({ length: 21 }, (_, i) => [
            `doc://test/ref${i}`,
            {
              title: `Reference ${i}`,
              url: `/test/ref${i}`,
            },
          ]),
        ),
      }

      const startTime = Date.now()
      const result = await renderFromJSON(nestedListData as any, "https://test.com")
      const elapsedTime = Date.now() - startTime

      expect(elapsedTime).toBeLessThan(5000)
      expect(result).toContain("Nested List Test")
      expect(result.split("Level").length).toBeGreaterThan(10)
    })

    it("should handle aside content with complex nested structures", async () => {
      // Test aside (callout) content that might have complex nesting
      const asideData = {
        metadata: { title: "Aside Content Test" },
        primaryContentSections: [
          {
            kind: "content",
            content: [
              {
                type: "aside",
                style: "note",
                content: [
                  {
                    type: "paragraph",
                    inlineContent: [
                      {
                        type: "emphasis",
                        inlineContent: [
                          {
                            type: "strong",
                            inlineContent: [
                              {
                                type: "reference",
                                identifier: "doc://test/nested-ref",
                                title: "Nested Reference",
                              },
                              {
                                type: "text",
                                text: " with more ",
                              },
                              {
                                type: "emphasis",
                                inlineContent: [
                                  {
                                    type: "text",
                                    text: "nested emphasis",
                                  },
                                ],
                              },
                            ],
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
        references: {
          "doc://test/nested-ref": {
            title: "Nested Reference",
            url: "/test/nested-ref",
          },
        },
      }

      const startTime = Date.now()
      const result = await renderFromJSON(asideData as any, "https://test.com")
      const elapsedTime = Date.now() - startTime

      expect(elapsedTime).toBeLessThan(3000)
      expect(result).toContain("Aside Content Test")
      expect(result).toContain("> [!NOTE]")
      expect(result).toContain("Nested Reference")
      expect(result).toContain("nested emphasis")
    })
  })
})

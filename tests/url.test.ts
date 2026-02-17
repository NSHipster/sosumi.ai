import { describe, expect, it } from "vitest"
import { buildExternalDocCJsonUrl } from "../src/lib/external"
import { generateAppleDocUrl, isValidAppleDocUrl, normalizeDocumentationPath } from "../src/lib/url"

describe("URL Helper Functions", () => {
  describe("basic path normalization", () => {
    it("should normalize simple paths", () => {
      expect(normalizeDocumentationPath("swift/array")).toBe("swift/array")
      expect(normalizeDocumentationPath("swiftui/view")).toBe("swiftui/view")
      expect(normalizeDocumentationPath("foundation/url")).toBe("foundation/url")
    })

    it("should remove leading slashes", () => {
      expect(normalizeDocumentationPath("/swift/array")).toBe("swift/array")
      expect(normalizeDocumentationPath("//swiftui/view")).toBe("/swiftui/view")
      expect(normalizeDocumentationPath("///foundation/url")).toBe("//foundation/url")
    })

    it("should trim whitespace", () => {
      expect(normalizeDocumentationPath("  swift/array  ")).toBe("swift/array")
      expect(normalizeDocumentationPath("\tswiftui/view\n")).toBe("swiftui/view")
      expect(normalizeDocumentationPath("  \n  foundation/url  \t  ")).toBe("foundation/url")
    })
  })

  describe("documentation prefix handling", () => {
    it("should remove documentation/ prefix", () => {
      expect(normalizeDocumentationPath("documentation/swift/array")).toBe("swift/array")
      expect(normalizeDocumentationPath("documentation/swiftui/view")).toBe("swiftui/view")
      expect(normalizeDocumentationPath("documentation/foundation/url")).toBe("foundation/url")
    })

    it("should remove documentation prefix (without trailing slash)", () => {
      expect(normalizeDocumentationPath("documentationswift/array")).toBe("swift/array")
      expect(normalizeDocumentationPath("documentationswiftui/view")).toBe("swiftui/view")
      expect(normalizeDocumentationPath("documentationfoundation/url")).toBe("foundation/url")
    })

    it("should handle mixed cases", () => {
      expect(normalizeDocumentationPath("/documentation/swift/array")).toBe("swift/array")
      expect(normalizeDocumentationPath("  documentation/swiftui/view  ")).toBe("swiftui/view")
      expect(normalizeDocumentationPath("\tdocumentationfoundation/url\n")).toBe("foundation/url")
    })
  })

  describe("edge cases", () => {
    it("should handle empty strings", () => {
      expect(normalizeDocumentationPath("")).toBe("")
      expect(normalizeDocumentationPath("   ")).toBe("")
      expect(normalizeDocumentationPath("\t\n")).toBe("")
    })

    it("should handle single components", () => {
      expect(normalizeDocumentationPath("swift")).toBe("swift")
      expect(normalizeDocumentationPath("/swift")).toBe("swift")
      expect(normalizeDocumentationPath("documentation/swift")).toBe("swift")
      expect(normalizeDocumentationPath("/documentation/swift")).toBe("swift")
    })

    it("should handle paths with multiple slashes", () => {
      expect(normalizeDocumentationPath("swift//array")).toBe("swift//array")
      expect(normalizeDocumentationPath("swift///array")).toBe("swift///array")
      expect(normalizeDocumentationPath("/swift//array")).toBe("swift//array")
    })

    it("should handle paths ending with slashes", () => {
      expect(normalizeDocumentationPath("swift/array/")).toBe("swift/array/")
      expect(normalizeDocumentationPath("/swift/array/")).toBe("swift/array/")
      expect(normalizeDocumentationPath("documentation/swift/array/")).toBe("swift/array/")
    })
  })

  describe("real-world examples", () => {
    it("should handle typical Apple documentation paths", () => {
      const testCases = [
        // Simple paths
        { input: "swift/array", expected: "swift/array" },
        { input: "swiftui/view", expected: "swiftui/view" },
        { input: "foundation/nsstring", expected: "foundation/nsstring" },

        // With leading slash
        { input: "/swift/array", expected: "swift/array" },
        { input: "/swiftui/view", expected: "swiftui/view" },

        // With documentation prefix
        { input: "documentation/swift/array", expected: "swift/array" },
        { input: "documentation/swiftui/view", expected: "swiftui/view" },

        // With both leading slash and documentation prefix
        { input: "/documentation/swift/array", expected: "swift/array" },
        { input: "/documentation/swiftui/view", expected: "swiftui/view" },

        // With whitespace
        { input: "  swift/array  ", expected: "swift/array" },
        { input: "\tdocumentation/swiftui/view\n", expected: "swiftui/view" },

        // Complex paths
        { input: "/documentation/swift/array/append", expected: "swift/array/append" },
        { input: "documentation/foundation/nsstring/init", expected: "foundation/nsstring/init" },
        { input: "  /documentation/swiftui/view/onappear  ", expected: "swiftui/view/onappear" },
      ]

      for (const { input, expected } of testCases) {
        expect(normalizeDocumentationPath(input)).toBe(expected)
      }
    })
  })

  describe("preserves valid paths", () => {
    it("should not modify already normalized paths", () => {
      const validPaths = [
        "swift/array",
        "swiftui/view",
        "foundation/url",
        "swift/array/append",
        "swiftui/view/onappear",
        "foundation/nsstring/init",
      ]

      for (const path of validPaths) {
        expect(normalizeDocumentationPath(path)).toBe(path)
      }
    })
  })

  describe("generateAppleDocUrl", () => {
    it("should generate correct Apple Developer URLs", () => {
      expect(generateAppleDocUrl("swift/array")).toBe(
        "https://developer.apple.com/documentation/swift/array",
      )
      expect(generateAppleDocUrl("swiftui/view")).toBe(
        "https://developer.apple.com/documentation/swiftui/view",
      )
      expect(generateAppleDocUrl("foundation/url")).toBe(
        "https://developer.apple.com/documentation/foundation/url",
      )
    })

    it("should handle empty paths", () => {
      expect(generateAppleDocUrl("")).toBe("https://developer.apple.com/documentation/")
    })
  })

  describe("isValidAppleDocUrl", () => {
    it("should validate correct Apple Developer URLs", () => {
      expect(isValidAppleDocUrl("https://developer.apple.com/documentation/swift/array")).toBe(true)
      expect(isValidAppleDocUrl("https://developer.apple.com/documentation/swiftui/view")).toBe(
        true,
      )
      expect(isValidAppleDocUrl("https://developer.apple.com/documentation/foundation/url")).toBe(
        true,
      )
    })

    it("should reject invalid URLs", () => {
      expect(isValidAppleDocUrl("https://developer.apple.com/swift/array")).toBe(false)
      expect(isValidAppleDocUrl("https://example.com/documentation/swift")).toBe(false)
      expect(isValidAppleDocUrl("http://developer.apple.com/documentation/swift")).toBe(false)
      expect(isValidAppleDocUrl("not-a-url")).toBe(false)
    })
  })

  describe("normalizeAndGenerateUrl workflow", () => {
    it("should normalize path and generate valid URL", () => {
      const normalizedPath = normalizeDocumentationPath("/documentation/swift/array")
      const url = generateAppleDocUrl(normalizedPath)
      expect(normalizedPath).toBe("swift/array")
      expect(url).toBe("https://developer.apple.com/documentation/swift/array")
    })

    it("should handle various input formats", () => {
      const testCases = [
        {
          input: "swift/array",
          expectedPath: "swift/array",
          expectedUrl: "https://developer.apple.com/documentation/swift/array",
        },
        {
          input: "/swift/array",
          expectedPath: "swift/array",
          expectedUrl: "https://developer.apple.com/documentation/swift/array",
        },
        {
          input: "documentation/swift/array",
          expectedPath: "swift/array",
          expectedUrl: "https://developer.apple.com/documentation/swift/array",
        },
        {
          input: "/documentation/swift/array",
          expectedPath: "swift/array",
          expectedUrl: "https://developer.apple.com/documentation/swift/array",
        },
        {
          input: "  swift/array  ",
          expectedPath: "swift/array",
          expectedUrl: "https://developer.apple.com/documentation/swift/array",
        },
      ]

      for (const { input, expectedPath, expectedUrl } of testCases) {
        const normalizedPath = normalizeDocumentationPath(input)
        const url = generateAppleDocUrl(normalizedPath)
        expect(normalizedPath).toBe(expectedPath)
        expect(url).toBe(expectedUrl)
      }
    })

    it("should handle all valid path formats", () => {
      // All normalized paths should generate valid URLs
      const normalizedPath = normalizeDocumentationPath("invalid/path/with/special/chars!@#")
      const url = generateAppleDocUrl(normalizedPath)
      expect(normalizedPath).toBe("invalid/path/with/special/chars!@#")
      expect(url).toBe(
        "https://developer.apple.com/documentation/invalid/path/with/special/chars!@#",
      )
    })
  })

  describe("external DocC URL generation", () => {
    it("should convert external documentation URLs to data JSON URLs", () => {
      const jsonUrl = buildExternalDocCJsonUrl(
        new URL("https://reference-ios.daily.co/documentation/daily"),
      )
      expect(jsonUrl.toString()).toBe(
        "https://reference-ios.daily.co/data/documentation/daily.json",
      )
    })

    it("should convert external documentation URLs hosted under a base path", () => {
      const jsonUrl = buildExternalDocCJsonUrl(
        new URL("https://apple.github.io/swift-argument-parser/documentation/argumentparser"),
      )
      expect(jsonUrl.toString()).toBe(
        "https://apple.github.io/swift-argument-parser/data/documentation/argumentparser.json",
      )
    })

    it("should reject non-DocC paths", () => {
      expect(() => buildExternalDocCJsonUrl(new URL("https://example.com/docs/daily"))).toThrow(
        /Swift-DocC documentation path/,
      )
    })
  })
})

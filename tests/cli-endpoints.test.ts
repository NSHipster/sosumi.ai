import { describe, expect, it } from "vitest"
import { parseCliArgs, resolveFetchEndpoint, resolveSearchEndpoint } from "../src/lib/cli-endpoints"

describe("CLI endpoint mapping", () => {
  describe("resolveFetchEndpoint", () => {
    it("maps Apple documentation URLs", () => {
      expect(resolveFetchEndpoint("https://developer.apple.com/documentation/swift/array")).toBe(
        "/documentation/swift/array",
      )
    })

    it("maps HIG URLs", () => {
      expect(
        resolveFetchEndpoint(
          "https://developer.apple.com/design/human-interface-guidelines/foundations/color",
        ),
      ).toBe("/design/human-interface-guidelines/foundations/color")
    })

    it("maps Apple video URLs", () => {
      expect(resolveFetchEndpoint("https://developer.apple.com/videos/play/wwdc2021/10133/")).toBe(
        "/videos/play/wwdc2021/10133",
      )
    })

    it("maps non-Apple https URLs to external route", () => {
      expect(
        resolveFetchEndpoint(
          "https://apple.github.io/swift-argument-parser/documentation/argumentparser",
        ),
      ).toBe("/external/https://apple.github.io/swift-argument-parser/documentation/argumentparser")
    })

    it("maps bare documentation paths", () => {
      expect(resolveFetchEndpoint("swift/array")).toBe("/documentation/swift/array")
      expect(resolveFetchEndpoint("/documentation/swift/array")).toBe("/documentation/swift/array")
    })

    it("throws for unsupported developer.apple.com pages", () => {
      expect(() =>
        resolveFetchEndpoint("https://developer.apple.com/xcode/"),
      ).toThrowErrorMatchingInlineSnapshot(
        `[Error: Unsupported developer.apple.com URL path: /xcode/]`,
      )
    })
  })

  describe("resolveSearchEndpoint", () => {
    it("encodes query text", () => {
      expect(resolveSearchEndpoint("SwiftData macro")).toBe("/search?q=SwiftData%20macro")
    })

    it("throws for empty query", () => {
      expect(() => resolveSearchEndpoint("   ")).toThrowErrorMatchingInlineSnapshot(
        `[Error: Search query cannot be empty]`,
      )
    })
  })

  describe("parseCliArgs", () => {
    it("parses fetch command and json flag", () => {
      expect(parseCliArgs(["fetch", "swift/array", "--json"])).toEqual({
        help: false,
        flags: {
          json: true,
        },
        positionals: ["fetch", "swift/array"],
      })
    })

    it("returns help mode", () => {
      expect(parseCliArgs(["--help"]).help).toBe(true)
    })

    it("rejects deprecated --base-url option", () => {
      expect(() =>
        parseCliArgs(["search", "swift", "--base-url", "http://localhost:8787"]),
      ).toThrow("--base-url is no longer supported. CLI runs using local src logic.")
    })

    it("throws for unknown options", () => {
      expect(() => parseCliArgs(["fetch", "swift", "--wat"])).toThrow("Unknown option: --wat")
    })
  })
})

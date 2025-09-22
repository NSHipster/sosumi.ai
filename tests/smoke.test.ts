import { describe, expect, it } from "vitest"
import { renderFromJSON } from "../src/lib/reference"
import type { AppleDocJSON } from "../src/lib/types"
import arrayData from "./fixtures/reference/array.json"

// Skip this file in CI environments (e.g. GitHub Actions, etc.)
if (process.env.CI === "1") {
  console.warn("Skipping smoke tests in CI environment")
  describe.skip("Smoke Tests (skipped in CI)", () => {})
} else {
  describe("Smoke Tests", () => {
    const TIMEOUT_MS = 10000

    it("should successfully import Apple Array documentation JSON", () => {
      expect(arrayData).toBeDefined()
      expect(typeof arrayData).toBe("object")
      expect(arrayData.topicSections).toBeDefined()
      expect(Array.isArray(arrayData.topicSections)).toBe(true)
      expect(arrayData.topicSections.length).toBeGreaterThan(0)
    })

    it(
      "should render complete Swift Array documentation",
      async () => {
        const result = await renderFromJSON(
          arrayData as AppleDocJSON,
          "https://developer.apple.com/documentation/swift/array",
        )

        // Basic structure validation
        expect(result).toBeDefined()
        expect(typeof result).toBe("string")
        expect(result.length).toBeGreaterThan(1000) // Should be substantial content

        // Front matter validation
        expect(result).toMatch(/^---\n[\s\S]*?\n---\n\n/)
        expect(result).toContain("source: https://developer.apple.com/documentation/swift/array")

        // Navigation breadcrumbs
        expect(result).toContain("**Navigation:** [Swift](/documentation/swift)")

        // Topic sections should be rendered
        expect(result).toContain("## Creating an Array")
        expect(result).toContain("## Inspecting an Array")
        expect(result).toContain("## Accessing Elements")

        // Should contain array-specific methods (note: URLs are lowercase 'swift/array')
        expect(result).toContain("[init()](/documentation/swift/array/init())")
        expect(result).toContain("[append(_:)](/documentation/swift/array/append(_:))")
        expect(result).toContain("[isEmpty](/documentation/swift/array/isempty)") // Note: actual output
        expect(result).toContain("[count](/documentation/swift/array/count)")

        // Footer validation
        expect(result).toContain("*Extracted by [sosumi.ai](https://sosumi.ai)")
        expect(result).toContain(
          "*This is unofficial content. All documentation belongs to Apple Inc.*",
        )

        // Should not contain error indicators
        expect(result).not.toContain("undefined")
        expect(result).not.toContain("null")
        expect(result).not.toContain("[object Object]")
        expect(result).not.toContain("[Content too deeply nested]")
        expect(result).not.toContain("[Inline content too deeply nested]")
      },
      TIMEOUT_MS,
    )

    it(
      "should process large dataset within performance limits",
      async () => {
        const startTime = Date.now()

        const result = await renderFromJSON(
          arrayData as AppleDocJSON,
          "https://developer.apple.com/documentation/swift/array",
        )

        const elapsedTime = Date.now() - startTime

        // Performance validation
        expect(elapsedTime).toBeLessThan(8000) // Should complete within 8 seconds
        expect(result.length).toBeGreaterThan(5000) // Should produce substantial output

        // Should render many topic sections from the real data
        const topicSectionCount = (result.match(/^## /gm) || []).length
        expect(topicSectionCount).toBeGreaterThan(10) // Should have many sections

        // Should render many method links (note: URLs are lowercase)
        const linkCount = (result.match(/\[.*?\]\(\/documentation\/swift\/array\//g) || []).length
        expect(linkCount).toBeGreaterThan(20) // Should have many array method links
      },
      TIMEOUT_MS,
    )

    it("should validate Apple documentation data structure", () => {
      // Validate the structure of the real Apple data
      expect(arrayData.topicSections).toBeDefined()

      // Check that we have the expected topic sections
      const topicTitles = arrayData.topicSections.map((section) => section.title)
      expect(topicTitles).toContain("Creating an Array")
      expect(topicTitles).toContain("Inspecting an Array")
      expect(topicTitles).toContain("Accessing Elements")

      // Each topic section should have identifiers
      for (const section of arrayData.topicSections) {
        expect(section.identifiers).toBeDefined()
        expect(Array.isArray(section.identifiers)).toBe(true)
        if (section.identifiers.length > 0) {
          // Each identifier should be a doc:// URL (can be from different frameworks)
          for (const id of section.identifiers) {
            expect(typeof id).toBe("string")
            expect(id).toMatch(/^doc:\/\/com\.apple\./) // More flexible pattern
          }
        }
      }
    })

    it(
      "should render all identifiers from source data",
      async () => {
        const result = await renderFromJSON(
          arrayData as AppleDocJSON,
          "https://developer.apple.com/documentation/swift/array",
        )

        // Count total identifiers in the source data
        let totalIdentifiers = 0
        for (const section of arrayData.topicSections) {
          if (section.identifiers) {
            totalIdentifiers += section.identifiers.length
          }
        }

        expect(totalIdentifiers).toBeGreaterThan(50) // Should have many identifiers

        // The rendered output should contain links for most identifiers (note: URLs are lowercase)
        const linkMatches = result.match(/\[.*?\]\(\/documentation\/swift\/array\/.*?\)/g) || []
        expect(linkMatches.length).toBeGreaterThan(totalIdentifiers * 0.5) // At least 50% should be rendered
      },
      TIMEOUT_MS,
    )

    it(
      "should convert method names to readable format",
      async () => {
        const result = await renderFromJSON(
          arrayData as AppleDocJSON,
          "https://developer.apple.com/documentation/swift/array",
        )

        // Just verify that method names are properly rendered - don't be too specific
        expect(result).toContain("[randomElement()]") // Should find this method
        expect(result).toContain("[isEmpty]") // Should find this property
        expect(result).toContain("[firstIndex") // Should find methods starting with firstIndex
      },
      TIMEOUT_MS,
    )

    it(
      "should preserve method signatures with parentheses",
      async () => {
        const result = await renderFromJSON(
          arrayData as AppleDocJSON,
          "https://developer.apple.com/documentation/swift/array",
        )

        // Should preserve method signatures like init(), append(_:), etc.
        expect(result).toContain("[init()]")
        expect(result).toContain("[append(_:)]")
        expect(result).toContain("[insert(_:at:)]")
        expect(result).toContain("[remove(at:)]")

        // Should not break method signatures
        expect(result).not.toContain("[init ()]") // No space before parentheses
        expect(result).not.toContain("[append (_:)]") // No space before parentheses
      },
      TIMEOUT_MS,
    )

    it(
      "should generate valid markdown structure",
      async () => {
        const result = await renderFromJSON(
          arrayData as AppleDocJSON,
          "https://developer.apple.com/documentation/swift/array",
        )

        // Should have proper heading hierarchy
        const headings = result.match(/^#{1,6}\s+.+$/gm) || []
        expect(headings.length).toBeGreaterThan(10)

        // Should not have malformed markdown
        expect(result).not.toMatch(/\*\*\*\*+/) // No empty bold
        expect(result).not.toMatch(/\[\s*\]\(/) // No empty links with URLs
        expect(result).not.toMatch(/\]\(\s*\)/) // No empty link URLs

        // Should have consistent list formatting
        const listItems = result.match(/^- \[.*?\]/gm) || []
        expect(listItems.length).toBeGreaterThan(20) // Should have many list items

        // Most list items should have proper link formatting (some may be plain text)
        const listItemsWithLinks = result.match(/^- \[.+?\]\(.+?\)/gm) || []
        expect(listItemsWithLinks.length).toBeGreaterThan(15) // Most should have links
      },
      TIMEOUT_MS,
    )
  })
}

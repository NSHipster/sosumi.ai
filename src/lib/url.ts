// Constants for Apple Developer documentation URLs
const APPLE_DOC_BASE_URL = "https://developer.apple.com/documentation/"

/**
 * Normalizes documentation paths by removing leading slashes, whitespace, and documentation prefixes.
 *
 * This function handles various input formats:
 * - `/swift/array` → `swift/array`
 * - `documentation/swift/array` → `swift/array`
 * - `  swift/array  ` → `swift/array`
 * - `/documentation/swift/array` → `swift/array`
 *
 * @param path - The documentation path to normalize
 * @returns The normalized path without leading slashes or documentation prefixes
 */
export function normalizeDocumentationPath(path: string): string {
  if (!path || typeof path !== "string") {
    return ""
  }

  return (
    path
      .trim()
      // Remove leading slashes and documentation prefixes
      .replace(/^\/?(?:documentation\/?)?/, "")
  )
}

/**
 * Generates a complete Apple Developer documentation URL from a normalized path.
 *
 * @param normalizedPath - The normalized documentation path (e.g., "swift/array")
 * @returns The complete Apple Developer documentation URL
 */
export function generateAppleDocUrl(normalizedPath: string): string {
  if (!normalizedPath || typeof normalizedPath !== "string") {
    return APPLE_DOC_BASE_URL
  }

  return `${APPLE_DOC_BASE_URL}${normalizedPath}`
}

/**
 * Validates if a URL is a proper Apple Developer documentation URL.
 *
 * @param url - The URL to validate
 * @returns True if the URL is a valid Apple Developer documentation URL
 */
export function isValidAppleDocUrl(url: string): boolean {
  if (!url || typeof url !== "string") {
    return false
  }

  return url.startsWith(APPLE_DOC_BASE_URL)
}

/**
 * Derives a human-readable title from the last component of a documentation
 * path or `doc://` identifier.
 *
 * @param identifier - The identifier or path (e.g., `doc://com.apple.SwiftUI/documentation/SwiftUI/View/body-8kl5o`)
 * @returns The title, with any disambiguation suffix removed (e.g., `body`)
 */
export function extractTitleFromIdentifier(identifier: string): string {
  const parts = identifier.split("/")
  const lastPart = parts[parts.length - 1]

  // Handle disambiguation suffixes (e.g., "body-8kl5o" -> "body", "init(exactly:)-63925" -> "init(exactly:)")
  const disambiguationMatch = lastPart.match(/^(.+?)(?:-\w+)?$/)
  if (disambiguationMatch) {
    const baseName = disambiguationMatch[1]

    // If it looks like a method signature (contains parentheses), preserve it
    if (baseName.includes("(") && baseName.includes(")")) {
      return baseName
    }

    // For simple identifiers, convert camelCase to readable format
    return baseName
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .replace(/\s+/g, " ")
      .trim()
  }

  // Fallback: convert camelCase to readable format
  return lastPart
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim()
}

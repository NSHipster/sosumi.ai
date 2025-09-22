/**
 * Human Interface Guidelines (HIG) fetching functionality
 */

import { getRandomUserAgent, NotFoundError } from "../fetch"
import type { HIGPageJSON, HIGTableOfContents } from "./types"

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Base URL for HIG JSON API
 */
const HIG_BASE_URL = "https://developer.apple.com/tutorials/data"

// ============================================================================
// FETCHING FUNCTIONS
// ============================================================================

/**
 * Fetch the complete HIG table of contents
 */
export async function fetchHIGTableOfContents(): Promise<HIGTableOfContents> {
  const tocUrl = `${HIG_BASE_URL}/index/design--human-interface-guidelines`

  const userAgent = getRandomUserAgent()

  const response = await fetch(tocUrl, {
    headers: {
      "User-Agent": userAgent,
      Accept: "application/json",
      "Cache-Control": "no-cache",
    },
  })

  if (!response.ok) {
    console.error(`Failed to fetch HIG ToC: ${response.status} ${response.statusText}`)
    if (response.status === 404) {
      throw new NotFoundError(`HIG table of contents not found at ${tocUrl}`)
    }
    throw new Error(`Failed to fetch HIG ToC: ${response.status} ${response.statusText}`)
  }

  const data = (await response.json()) as HIGTableOfContents
  return data
}

/**
 * Fetch HIG page content by path
 *
 * @param path - The HIG path (e.g., "getting-started", "foundations/color")
 * @returns HIG page JSON data
 */
export async function fetchHIGPageData(path: string): Promise<HIGPageJSON> {
  // Normalize the path - remove leading/trailing slashes
  const normalizedPath = path.replace(/^\/+|\/+$/g, "")

  // Construct the full JSON URL
  const jsonUrl = `${HIG_BASE_URL}/design/human-interface-guidelines/${normalizedPath}.json`

  const userAgent = getRandomUserAgent()

  const response = await fetch(jsonUrl, {
    headers: {
      "User-Agent": userAgent,
      Accept: "application/json",
      "Cache-Control": "no-cache",
    },
  })

  if (!response.ok) {
    console.error(`Failed to fetch HIG page: ${response.status} ${response.statusText}`)
    if (response.status === 404) {
      throw new NotFoundError(`HIG page not found at ${jsonUrl}`)
    }
    throw new Error(`Failed to fetch HIG page: ${response.status} ${response.statusText}`)
  }

  const data = (await response.json()) as HIGPageJSON
  return data
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Extract all available HIG paths from the table of contents
 *
 * @param toc - The HIG table of contents
 * @returns Array of all available paths
 */
export function extractHIGPaths(toc: HIGTableOfContents): string[] {
  const paths: string[] = []

  function extractFromItems(items: typeof toc.interfaceLanguages.swift) {
    for (const item of items) {
      if (item.path) {
        // Remove the leading "/design/human-interface-guidelines/" prefix
        const normalizedPath = item.path.replace(/^\/design\/human-interface-guidelines\//, "")
        if (normalizedPath) {
          paths.push(normalizedPath)
        }
      }

      if (item.children) {
        extractFromItems(item.children)
      }
    }
  }

  extractFromItems(toc.interfaceLanguages.swift)
  return paths
}

/**
 * Find a specific HIG item in the table of contents by path
 *
 * @param toc - The HIG table of contents
 * @param targetPath - The path to search for
 * @returns The HIG item if found, undefined otherwise
 */
export function findHIGItemByPath(
  toc: HIGTableOfContents,
  targetPath: string,
): (typeof toc.interfaceLanguages.swift)[0] | undefined {
  const normalizedTarget = targetPath.replace(/^\/+|\/+$/g, "")

  function searchInItems(
    items: typeof toc.interfaceLanguages.swift,
  ): (typeof items)[0] | undefined {
    for (const item of items) {
      const normalizedItemPath = item.path
        .replace(/^\/design\/human-interface-guidelines\//, "")
        .replace(/^\/+|\/+$/g, "")

      if (normalizedItemPath === normalizedTarget) {
        return item
      }

      if (item.children) {
        const found = searchInItems(item.children)
        if (found) return found
      }
    }
    return undefined
  }

  return searchInItems(toc.interfaceLanguages.swift)
}

/**
 * Get breadcrumb path for a HIG item
 *
 * @param toc - The HIG table of contents
 * @param targetPath - The path to get breadcrumbs for
 * @returns Array of titles representing the breadcrumb path
 */
export function getHIGBreadcrumbs(toc: HIGTableOfContents, targetPath: string): string[] {
  const normalizedTarget = targetPath.replace(/^\/+|\/+$/g, "")

  function findBreadcrumbs(
    items: typeof toc.interfaceLanguages.swift,
    currentPath: string[] = [],
  ): string[] | null {
    for (const item of items) {
      const normalizedItemPath = item.path
        .replace(/^\/design\/human-interface-guidelines\//, "")
        .replace(/^\/+|\/+$/g, "")
      const newPath = [...currentPath, item.title]

      if (normalizedItemPath === normalizedTarget) {
        return newPath
      }

      if (item.children) {
        const found = findBreadcrumbs(item.children, newPath)
        if (found) return found
      }
    }
    return null
  }

  return findBreadcrumbs(toc.interfaceLanguages.swift) || []
}

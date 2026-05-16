/**
 * Apple Developer Reference documentation fetching functionality
 */

import { getRandomUserAgent, NotFoundError } from "../fetch"
import { normalizeDocumentationPath } from "../url"
import type { AppleDocJSON } from "./types"

/**
 * Fetch Apple Developer reference documentation JSON data for a given path
 */
export async function fetchJSONData(path: string): Promise<AppleDocJSON> {
  // Normalize the path using the shared function
  const normalizedPath = normalizeDocumentationPath(path)

  // Add back the documentation/ prefix for the JSON API
  const jsonPath = `documentation/${normalizedPath}`

  // Split path into parts
  const parts = jsonPath.split("/")

  let jsonUrl: string
  if (parts.length === 2) {
    // Top-level framework index (e.g., /documentation/swiftui)
    const framework = parts[1]
    jsonUrl = `https://developer.apple.com/tutorials/data/index/${framework}`
  } else {
    // Individual page (e.g., /documentation/swiftui/view)
    jsonUrl = `https://developer.apple.com/tutorials/data/${jsonPath}.json`
  }

  // Generate a random Safari user agent with uniform selection
  const userAgent = getRandomUserAgent()

  const response = await fetch(jsonUrl, {
    headers: {
      "User-Agent": userAgent,
      Accept: "application/json",
      "Cache-Control": "no-cache",
    },
  })

  if (!response.ok) {
    console.error(`Failed to fetch JSON: ${response.status} ${response.statusText}`)
    if (response.status === 404) {
      throw new NotFoundError(`Apple documentation page not found at ${jsonUrl}`)
    }
    throw new Error(`Failed to fetch JSON: ${response.status} ${response.statusText}`)
  }

  const data = (await response.json()) as AppleDocJSON
  return data
}

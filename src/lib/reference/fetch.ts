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

  // Framework roots use the same page JSON as other pages.
  // Apple's navigator index (`tutorials/data/index/<framework>`) lists every
  // symbol in the documentation bundle, which renders to megabytes of Markdown,
  // and for a module such as Observation it returns the whole Swift bundle.
  const jsonUrl = `https://developer.apple.com/tutorials/data/documentation/${normalizedPath}.json`

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

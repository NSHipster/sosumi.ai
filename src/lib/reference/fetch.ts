/**
 * Apple Developer Reference documentation fetching functionality
 */

import { getRandomUserAgent, NotFoundError } from "../fetch"
import { normalizeDocumentationPath } from "../url"
import type { AppleDocJSON } from "./types"

/**
 * A documentation page and the path that Apple serves it at
 */
export interface DocumentationPage {
  /** The normalized path of the page, without the `documentation/` prefix */
  path: string
  data: AppleDocJSON
}

/**
 * Fetch Apple Developer reference documentation JSON data for a given path
 */
export async function fetchJSONData(path: string): Promise<AppleDocJSON> {
  return (await fetchDocumentationPage(path)).data
}

/**
 * Fetch an Apple Developer reference documentation page.
 *
 * Apple's paths for functions, methods, and overloaded symbols include
 * the signature or a disambiguation suffix,
 * such as `withobservationtracking(_:onchange:)` or `body-8kl5o`.
 * When a path without one is not found,
 * this looks for the symbol among the references of the parent page.
 * If exactly one page matches, it fetches that page and returns its path.
 * If more than one matches, the `NotFoundError` lists them.
 */
export async function fetchDocumentationPage(path: string): Promise<DocumentationPage> {
  const normalizedPath = normalizeDocumentationPath(path)

  try {
    return { path: normalizedPath, data: await fetchPageJSON(normalizedPath) }
  } catch (error) {
    if (!(error instanceof NotFoundError)) {
      throw error
    }

    const candidates = await findSymbolCandidates(normalizedPath)
    if (candidates.length === 1) {
      const [candidate] = candidates
      return { path: candidate.path, data: await fetchPageJSON(candidate.path) }
    }
    if (candidates.length > 1) {
      const list = candidates.map((c) => `- ${c.title}: /documentation/${c.path}`).join("\n")
      throw new NotFoundError(
        `${error.message}\nThe path matches more than one symbol. Fetch one of these paths:\n${list}`,
        candidates,
      )
    }
    throw error
  }
}

async function fetchPageJSON(normalizedPath: string): Promise<AppleDocJSON> {
  // Framework roots use the same page JSON as other pages.
  // Apple's navigator index (`tutorials/data/index/<framework>`) lists every
  // symbol in the documentation bundle, which renders to megabytes of Markdown,
  // and for a module such as Observation it returns the whole Swift bundle.
  return fetchAppleJSON(pageJSONUrl(normalizedPath))
}

function pageJSONUrl(normalizedPath: string): string {
  return `https://developer.apple.com/tutorials/data/documentation/${normalizedPath}.json`
}

async function fetchAppleJSON(jsonUrl: string): Promise<AppleDocJSON> {
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

/**
 * Find pages under the parent of `normalizedPath` whose last path component
 * is the requested name followed by a signature or a disambiguation suffix.
 */
async function findSymbolCandidates(
  normalizedPath: string,
): Promise<Array<{ path: string; title: string }>> {
  const lowercasedPath = normalizedPath.toLowerCase().replace(/\/+$/, "")
  const separator = lowercasedPath.lastIndexOf("/")
  if (separator <= 0) {
    return []
  }

  const parentPath = lowercasedPath.slice(0, separator)
  const name = lowercasedPath.slice(separator + 1)
  if (!name || /[()]/.test(name)) {
    return []
  }

  let parent: AppleDocJSON
  try {
    // Use the page JSON even for a framework, because the index has no references.
    parent = await fetchAppleJSON(pageJSONUrl(parentPath))
  } catch {
    return []
  }

  const prefix = `/documentation/${parentPath}/`
  const candidates = new Map<string, string>()
  for (const reference of Object.values(parent.references ?? {})) {
    const url = typeof reference.url === "string" ? reference.url.toLowerCase() : undefined
    if (!url?.startsWith(prefix)) {
      continue
    }

    const component = url.slice(prefix.length)
    if (component.includes("/")) {
      continue
    }

    if (component.startsWith(`${name}(`) || component.startsWith(`${name}-`)) {
      candidates.set(url.slice("/documentation/".length), reference.title ?? component)
    }
  }

  return [...candidates].map(([path, title]) => ({ path, title }))
}

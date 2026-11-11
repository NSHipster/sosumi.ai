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
 * When a path is not found,
 * this looks for the symbol among the references of the parent page.
 * A path can omit the suffix, or omit trailing argument labels
 * from a signature, as `messages(of:for:)` does for `messages(of:for:buffersize:)-623kg`.
 * When the parent page is not found either,
 * this resolves the parent's path the same way and looks again,
 * so that `uttype/markdown` finds `uttype-swift.struct/markdown`.
 *
 * If exactly one page matches, it fetches that page and returns its path.
 * If the matches are a Swift symbol and its Objective-C counterparts,
 * such as `-swift.struct` and `-c.class`, it fetches the Swift symbol.
 * Otherwise, if more than one matches, the `NotFoundError` lists them.
 */
export async function fetchDocumentationPage(path: string): Promise<DocumentationPage> {
  return resolveDocumentationPage(normalizeDocumentationPath(path), 0)
}

/**
 * The number of parent paths that resolution can correct,
 * which limits the number of requests for a path that does not exist.
 */
const MAX_PARENT_RESOLUTION_DEPTH = 1

async function resolveDocumentationPage(
  normalizedPath: string,
  depth: number,
): Promise<DocumentationPage> {
  try {
    return { path: normalizedPath, data: await fetchPageJSON(normalizedPath) }
  } catch (error) {
    if (!(error instanceof NotFoundError)) {
      throw error
    }
    return resolveMissingPage(normalizedPath, depth, error)
  }
}

/**
 * Resolve a path that Apple does not serve a page at,
 * or throw `error`, with any candidates, when no single page matches.
 */
async function resolveMissingPage(
  normalizedPath: string,
  depth: number,
  error: NotFoundError,
): Promise<DocumentationPage> {
  const candidates = await findSymbolCandidates(normalizedPath, depth)
  const candidate = selectCandidate(candidates)
  if (candidate) {
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

/**
 * Select the page to fetch from the candidates for a path:
 * the only candidate, or the Swift symbol when the other candidates
 * are its Objective-C counterparts.
 */
function selectCandidate(
  candidates: Array<{ path: string; title: string }>,
): { path: string; title: string } | undefined {
  if (candidates.length === 1) {
    return candidates[0]
  }

  const swift = candidates.filter((c) => /-swift\.[a-z.]+$/.test(c.path))
  const objectiveC = candidates.filter((c) => /-c\.[a-z.]+$/.test(c.path))
  if (swift.length === 1 && swift.length + objectiveC.length === candidates.length) {
    return swift[0]
  }

  return undefined
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
 * is the requested name followed by a signature or a disambiguation suffix,
 * or is a signature that starts with the requested signature.
 * When the parent page is not found, this resolves the parent's path first,
 * and then also matches a component that equals the requested name.
 */
async function findSymbolCandidates(
  normalizedPath: string,
  depth: number,
): Promise<Array<{ path: string; title: string }>> {
  const lowercasedPath = normalizedPath.toLowerCase().replace(/\/+$/, "")
  const separator = lowercasedPath.lastIndexOf("/")
  if (separator <= 0) {
    return []
  }

  let parentPath = lowercasedPath.slice(0, separator)
  const name = lowercasedPath.slice(separator + 1)
  if (!name) {
    return []
  }

  let parent: AppleDocJSON
  let parentWasResolved = false
  try {
    // Use the page JSON even for a framework, because the index has no references.
    parent = await fetchAppleJSON(pageJSONUrl(parentPath))
  } catch (error) {
    if (!(error instanceof NotFoundError) || depth >= MAX_PARENT_RESOLUTION_DEPTH) {
      return []
    }
    try {
      const resolvedParent = await resolveMissingPage(parentPath, depth + 1, error)
      parent = resolvedParent.data
      parentPath = resolvedParent.path.toLowerCase()
      parentWasResolved = true
    } catch {
      return []
    }
  }

  // A signature such as `messages(of:for:)` also matches signatures
  // that add argument labels, such as `messages(of:for:buffersize:)`.
  const signaturePrefix = name.endsWith(":)") ? name.slice(0, -1) : undefined

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

    const matches =
      (parentWasResolved && component === name) ||
      component.startsWith(`${name}-`) ||
      (!name.includes("(") && component.startsWith(`${name}(`)) ||
      (signaturePrefix !== undefined && component.startsWith(signaturePrefix))
    if (matches) {
      candidates.set(url.slice("/documentation/".length), reference.title ?? component)
    }
  }

  return [...candidates].map(([path, title]) => ({ path, title }))
}

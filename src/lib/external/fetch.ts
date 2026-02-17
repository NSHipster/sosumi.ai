import { NotFoundError } from "../fetch"
import type { AppleDocJSON } from "../types"
import { EXTERNAL_DOC_USER_AGENT, ExternalAccessError } from "./policy"

const RESTRICTIVE_X_ROBOTS_TAGS = ["none", "noindex", "noai", "noimageai"] as const

export function extractExternalDocumentationBasePath(sourceUrl: URL): string {
  const normalizedPath = sourceUrl.pathname.replace(/\/+$/, "")
  const match = normalizedPath.match(/^(.*?)(\/documentation(?:\/.*)?)$/)
  if (!match) {
    throw new ExternalAccessError(
      "External URL must point to a Swift-DocC documentation path.",
      400,
    )
  }

  return match[1]
}

export function buildExternalDocCJsonUrl(sourceUrl: URL): URL {
  const hostBasePath = extractExternalDocumentationBasePath(sourceUrl)
  const documentationPath = sourceUrl.pathname.replace(/\/+$/, "").slice(hostBasePath.length)
  const jsonPath = documentationPath.endsWith(".json")
    ? documentationPath
    : `${documentationPath}.json`
  return new URL(`${hostBasePath}/data${jsonPath}`, sourceUrl.origin)
}

export async function fetchExternalDocCJSON(sourceUrl: URL): Promise<AppleDocJSON> {
  const jsonUrl = buildExternalDocCJsonUrl(sourceUrl)
  const response = await fetch(jsonUrl.toString(), {
    headers: {
      "User-Agent": EXTERNAL_DOC_USER_AGENT,
      Accept: "application/json",
    },
  })

  const xRobotsTag = response.headers.get("x-robots-tag")
  if (containsRestrictiveXRobotsTag(xRobotsTag)) {
    throw new ExternalAccessError(
      "External host denied AI/doc access via X-Robots-Tag response header.",
      403,
    )
  }

  if (!response.ok) {
    if (response.status === 404) {
      throw new NotFoundError(`External documentation page not found at ${jsonUrl.toString()}`)
    }

    throw new Error(`Failed to fetch external DocC JSON: ${response.status} ${response.statusText}`)
  }

  return (await response.json()) as AppleDocJSON
}

function containsRestrictiveXRobotsTag(headerValue: string | null): boolean {
  if (!headerValue) {
    return false
  }

  const tokenSet = new Set(
    headerValue
      .toLowerCase()
      .split(",")
      .map((token) => token.trim())
      .filter(Boolean),
  )

  for (const token of RESTRICTIVE_X_ROBOTS_TAGS) {
    if (tokenSet.has(token)) {
      return true
    }
  }
  return false
}

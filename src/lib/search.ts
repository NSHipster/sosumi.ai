import { getRandomUserAgent } from "./fetch"

export interface SearchResult {
  title: string
  url: string
  description: string
  breadcrumbs: string[]
  tags: string[]
  type: string // 'documentation' | 'general' etc.
}

export interface SearchResponse {
  query: string
  results: SearchResult[]
}

// Apple's current search backend, discovered from
// https://developer.apple.com/search/scripts/search.js (May 2026)
//
// Historical context:
//   - The legacy /search/ HTML scraper broke when Apple switched to a JS-rendered SPA
//   - PR #54 upstream (NSHipster/sosumi.ai) targeted /search/services/search.php with
//     NDJSON-style streamed events; that endpoint is now also gone (404)
//   - The current backend is a plain JSON POST API on Apple's MSC infrastructure
const APPLE_SEARCH_SERVICE_URL = "https://devintserv.msc.sbz.apple.com/api/v1/search"
const DEFAULT_TARGET_RESULT_LOCALE = "en"
const TARGET_RESULT_LOCALE_BY_BASE_NAME = new Map([
  ["en", "en"],
  ["zh-CN", "zh-CN"],
  ["ja-JP", "ja-JP"],
  ["ko-KR", "ko-KR"],
  ["fr-FR", "fr-FR"],
  ["de-DE", "de-DE"],
  ["pt-BR", "pt-BR"],
  ["es-LA", "es-lamr"],
  ["es-419", "es-lamr"],
  ["it-IT", "it-IT"],
])

type JsonRecord = Record<string, unknown>

export async function searchAppleDeveloperDocs(query: string): Promise<SearchResponse> {
  const results = await searchAppleDeveloperDocsViaService(query)
  return { query, results }
}

async function searchAppleDeveloperDocsViaService(query: string): Promise<SearchResult[]> {
  const response = await fetch(APPLE_SEARCH_SERVICE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      // The MSC backend requires a browser-style Origin/Referer pair to accept the request.
      Origin: "https://developer.apple.com",
      Referer: "https://developer.apple.com/search/",
      "User-Agent": getRandomUserAgent(),
    },
    body: JSON.stringify({
      text: query,
      targetResultLocale: resolveTargetResultLocale(),
    }),
  })

  if (!response.ok) {
    throw new Error(`Search request failed: ${response.status}`)
  }

  const data = await readSearchResponseJson(response)
  const rawResults = Array.isArray(data.results) ? (data.results as unknown[]) : []
  return extractSearchResults(rawResults)
}

async function readSearchResponseJson(response: Response): Promise<JsonRecord> {
  try {
    const data = await response.json()
    return isJsonRecord(data) ? data : {}
  } catch {
    throw new Error("Search response was not valid JSON")
  }
}

function extractSearchResults(items: unknown[]): SearchResult[] {
  return items.flatMap((item) => {
    const result = normalizeSearchResult(item)
    return result ? [result] : []
  })
}

function normalizeSearchResult(item: unknown): SearchResult | null {
  if (!isJsonRecord(item)) {
    return null
  }

  const documentation = extractMetadataRecord(item.documentation)
  if (documentation) {
    const title = stringValue(documentation.title)
    const url = stringValue(documentation.permalink)
    if (!title || !url) {
      return null
    }

    return {
      title,
      url,
      description: stringValue(documentation.description) ?? "",
      breadcrumbs: splitHierarchy(stringValue(documentation.hierarchy)),
      tags: compactStrings([stringValue(documentation.kind)]),
      type: "documentation",
    }
  }

  const developer = extractMetadataRecord(item.developer)
  if (developer) {
    const title = firstString(developer.titles)
    const url = firstString(developer.permalinks)
    if (!title || !url) {
      return null
    }

    return {
      title,
      url,
      description: firstString(developer.descriptions) ?? "",
      breadcrumbs: compactStrings([firstString(developer.projectNames)]),
      tags: compactStrings([
        firstString(developer.itemTypes),
        firstString(developer.deliveryLanguageCodes),
      ]),
      type: (firstString(developer.itemTypes) ?? "developer").toLowerCase(),
    }
  }

  const devsite = extractMetadataRecord(item.devsite)
  if (devsite) {
    const title = stringValue(devsite.title)
    const url = stringValue(devsite.sourceURL)
    if (!title || !url) {
      return null
    }

    return {
      title,
      url,
      description: stringValue(devsite.description) ?? "",
      breadcrumbs: [],
      tags: [],
      type: "general",
    }
  }

  const swiftdocs = extractMetadataRecord(item.swiftdocs)
  if (swiftdocs) {
    const title = stringValue(swiftdocs.title)
    const url = stringValue(swiftdocs.sourceURL)
    if (!title || !url) {
      return null
    }

    return {
      title,
      url,
      description: stringValue(swiftdocs.description) ?? "",
      breadcrumbs: [],
      tags: [],
      type: "general",
    }
  }

  return null
}

function extractMetadataRecord(container: unknown): JsonRecord | null {
  if (!isJsonRecord(container)) {
    return null
  }

  const metadata = container.metadata
  return isJsonRecord(metadata) ? metadata : null
}

function isJsonRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null
}

function firstString(value: unknown): string | null {
  if (!Array.isArray(value)) {
    return null
  }

  const first = value.find((item) => typeof item === "string" && item.length > 0)
  return typeof first === "string" ? first : null
}

function splitHierarchy(hierarchy: string | null): string[] {
  if (!hierarchy) {
    return []
  }

  return hierarchy
    .split(" > ")
    .map((segment) => segment.trim())
    .filter(Boolean)
}

function compactStrings(values: Array<string | null>): string[] {
  return values.filter((value): value is string => Boolean(value))
}

// Apple's MSC backend uses BCP-47 language tags ("en", "ja-JP", "zh-CN", etc.)
// instead of POSIX locale codes ("en_US").
// Mirror the mapping from
// https://developer.apple.com/search/scripts/helpers.js
function resolveTargetResultLocale(): string {
  const locale = Intl.DateTimeFormat().resolvedOptions().locale
  if (!locale) {
    return DEFAULT_TARGET_RESULT_LOCALE
  }

  try {
    const normalized = new Intl.Locale(locale)
    const lang = normalized.language
    const region = normalized.region
    const languageRegion = region ? `${lang}-${region}` : lang

    return (
      TARGET_RESULT_LOCALE_BY_BASE_NAME.get(normalized.baseName) ??
      TARGET_RESULT_LOCALE_BY_BASE_NAME.get(languageRegion) ??
      TARGET_RESULT_LOCALE_BY_BASE_NAME.get(lang) ??
      DEFAULT_TARGET_RESULT_LOCALE
    )
  } catch {
    return DEFAULT_TARGET_RESULT_LOCALE
  }
}

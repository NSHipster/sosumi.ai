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
// https://developer.apple.com/search/scripts/search.js (September 2026)
//
// Historical context:
//   - The legacy /search/ HTML scraper broke when Apple switched to a JS-rendered SPA
//   - PR #54 upstream (NSHipster/sosumi.ai) targeted /search/services/search.php with
//     NDJSON-style streamed events; that endpoint is now also gone (404)
//   - /api/v1/search replaced it, and now 404s in turn
//   - The current backend is /api/v1/query, which answers only in JSONL:
//     one event per line, each tagged with a `kind`
const APPLE_SEARCH_SERVICE_URL = "https://devintserv.msc.sbz.apple.com/api/v1/query"

// The backend rejects a request that does not name the response channels it wants.
// `quickSearch` carries the top typeahead matches in a single event;
// `search` streams the full ranked list.
// The third channel Apple's own page requests, `ask`, is a generated answer,
// which is not what this service reports.
const INCLUDED_RESPONSES = ["quickSearch", "search"]

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
      Accept: "application/jsonl",
      // The MSC backend requires a browser-style Origin/Referer pair to accept the request.
      Origin: "https://developer.apple.com",
      Referer: "https://developer.apple.com/search/",
      "User-Agent": getRandomUserAgent(),
    },
    body: JSON.stringify({
      text: query,
      targetResultLocale: resolveTargetResultLocale(),
      includedResponses: INCLUDED_RESPONSES,
    }),
  })

  if (!response.ok) {
    throw new Error(`Search request failed: ${response.status}`)
  }

  return extractSearchResults(await readSearchResponseItems(response))
}

// The response body is JSONL: one JSON object per line.
// A `quickSearch` event carries its results inline,
// while `search` events stream the full list as diffs against a JSON text buffer,
// so those results can only be read once every line has been applied.
// Events of any other kind — `quickSearchFinished`, `searchFinished`, `ask` —
// are not part of the result set and are skipped.
async function readSearchResponseItems(response: Response): Promise<unknown[]> {
  const items: unknown[] = []
  let streamedSearch = ""

  for (const line of (await response.text()).split("\n")) {
    const trimmed = line.trim()
    if (!trimmed) {
      continue
    }

    const event = parseJson(trimmed)
    if (!isJsonRecord(event)) {
      continue
    }

    if (event.kind === "quickSearch") {
      items.push(...resultsOf(event.response))
    } else if (event.kind === "search") {
      streamedSearch = applySearchDiff(streamedSearch, event.diff)
    }
  }

  if (streamedSearch) {
    items.push(...resultsOf(parseJson(streamedSearch)))
  }

  return items
}

// Each `search` event appends to the buffer,
// after dropping `removeLast` characters from the end of what came before.
function applySearchDiff(buffer: string, diff: unknown): string {
  if (!isJsonRecord(diff)) {
    return buffer
  }

  const removeLast = typeof diff.removeLast === "number" ? diff.removeLast : 0
  const append = typeof diff.append === "string" ? diff.append : ""

  return buffer.slice(0, Math.max(0, buffer.length - removeLast)) + append
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    throw new Error("Search response was not valid JSON")
  }
}

function resultsOf(container: unknown): unknown[] {
  if (!isJsonRecord(container)) {
    return []
  }

  return Array.isArray(container.results) ? container.results : []
}

// The same page can be reported by more than one channel,
// so keep the first mention of each URL and drop the rest.
function extractSearchResults(items: unknown[]): SearchResult[] {
  const seen = new Set<string>()

  return items.flatMap((item) => {
    const result = normalizeSearchResult(item)
    if (!result || seen.has(result.url)) {
      return []
    }

    seen.add(result.url)
    return [result]
  })
}

// A result is `{ metadata, origin }`, and its `metadata.metadataKind` says how to read it:
//   - "documentation" for reference pages, with singular fields
//   - "developer" for WWDC sessions and other media, with parallel arrays
//   - "webPage" for marketing and swift.org pages, keyed by `sourceURL`
function normalizeSearchResult(item: unknown): SearchResult | null {
  const record = unwrapResultValue(item)
  if (!record || !isJsonRecord(record.metadata)) {
    return null
  }

  const metadata = record.metadata

  if (metadata.metadataKind === "documentation") {
    const title = stringValue(metadata.title)
    const url = stringValue(metadata.permalink)
    if (!title || !url) {
      return null
    }

    return {
      title,
      url,
      description: stringValue(metadata.description) ?? "",
      breadcrumbs: splitHierarchy(stringValue(metadata.hierarchy)),
      tags: compactStrings([stringValue(metadata.kind)]),
      type: "documentation",
    }
  }

  if (metadata.metadataKind === "developer") {
    const title = firstString(metadata.titles)
    const url = firstString(metadata.permalinks)
    if (!title || !url) {
      return null
    }

    return {
      title,
      url,
      description: firstString(metadata.descriptions) ?? "",
      breadcrumbs: compactStrings([firstString(metadata.projectNames)]),
      tags: compactStrings([
        firstString(metadata.itemTypes),
        firstString(metadata.deliveryLanguageCodes),
      ]),
      type: (firstString(metadata.itemTypes) ?? "developer").toLowerCase(),
    }
  }

  if (metadata.metadataKind === "webPage") {
    const title = stringValue(metadata.title)
    const url = stringValue(metadata.sourceURL)
    if (!title || !url) {
      return null
    }

    return {
      title,
      url,
      description: stringValue(metadata.description) ?? "",
      breadcrumbs: [],
      tags: [],
      type: "general",
    }
  }

  return null
}

// Streamed `search` results wrap their payload in `value` alongside a match excerpt,
// while `quickSearch` results carry it directly.
function unwrapResultValue(item: unknown): JsonRecord | null {
  if (!isJsonRecord(item)) {
    return null
  }

  return isJsonRecord(item.value) ? item.value : item
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

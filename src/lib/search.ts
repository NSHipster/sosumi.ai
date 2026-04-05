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

const APPLE_SEARCH_SERVICE_URL = "https://developer.apple.com/search/services/search.php"
const DEFAULT_TARGET_RESULT_LOCALE = "en_US"

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
      "User-Agent": getRandomUserAgent(),
    },
    body: JSON.stringify({
      q: query,
      targetResultLocale: resolveTargetResultLocale(),
    }),
  })

  if (!response.ok) {
    throw new Error(`Search request failed: ${response.status}`)
  }

  const events = await parseSearchEvents(response)

  const resultsEvent = events.find((event) => stringValue(event.type) === "results")
  if (!resultsEvent) {
    throw new Error("Search response did not include a results event")
  }

  return extractSearchResults(resultsEvent.data)
}

async function parseSearchEvents(response: Response): Promise<JsonRecord[]> {
  if (!response.body) {
    throw new Error("Search response did not include a readable body")
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  const events: JsonRecord[] = []
  let buffer = ""

  while (true) {
    const { done, value } = await reader.read()
    if (done) {
      break
    }

    buffer += decoder.decode(value, { stream: true })

    const lines = buffer.split("\n")
    buffer = lines.pop() ?? ""
    for (const rawLine of lines) {
      const event = parseEventLine(rawLine)
      if (event) {
        events.push(event)
      }
    }
  }

  buffer += decoder.decode()
  const finalEvent = parseEventLine(buffer)
  if (finalEvent) {
    events.push(finalEvent)
  }

  return events
}

function parseEventLine(rawLine: string): JsonRecord | null {
  const line = rawLine.trim()
  if (!line) {
    return null
  }

  try {
    const parsed = JSON.parse(line)
    return isJsonRecord(parsed) ? parsed : null
  } catch {
    return null
  }
}

function extractSearchResults(data: unknown): SearchResult[] {
  if (!Array.isArray(data)) {
    return []
  }

  return data.flatMap((item) => {
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

function resolveTargetResultLocale(): string {
  const locale = Intl.DateTimeFormat().resolvedOptions().locale
  if (!locale) {
    return DEFAULT_TARGET_RESULT_LOCALE
  }

  try {
    const normalized = new Intl.Locale(locale)
    if (!normalized.language || !normalized.region) {
      return DEFAULT_TARGET_RESULT_LOCALE
    }

    return `${normalized.language}_${normalized.region}`
  } catch {
    return DEFAULT_TARGET_RESULT_LOCALE
  }
}

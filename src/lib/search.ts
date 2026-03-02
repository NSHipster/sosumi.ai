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

class SearchResultParser {
  private results: SearchResult[] = []
  private currentResult: Partial<SearchResult> = {}
  private currentBreadcrumbs: string[] = []
  private currentTags: string[] = []
  private isInResultTitle = false
  private isInResultDescription = false
  private isInBreadcrumb = false
  private isInTag = false

  getResults(): SearchResult[] {
    return this.results
  }

  private resetCurrentResult() {
    this.currentResult = {}
    this.currentBreadcrumbs = []
    this.currentTags = []
    this.isInResultTitle = false
    this.isInResultDescription = false
    this.isInBreadcrumb = false
    this.isInTag = false
  }

  private finalizeCurrentResult() {
    if (this.currentResult.title && this.currentResult.url) {
      this.results.push({
        title: this.currentResult.title,
        url: this.currentResult.url,
        description: this.currentResult.description || "",
        breadcrumbs: [...this.currentBreadcrumbs],
        tags: [...this.currentTags],
        type: this.currentResult.type || "unknown",
      })
    }
    this.resetCurrentResult()
  }

  element(element: Element) {
    // Start of a search result
    if (element.tagName === "li" && element.getAttribute("class")?.includes("search-result")) {
      this.finalizeCurrentResult() // Finalize previous result if any

      // Extract result type from class
      const className = element.getAttribute("class") || ""
      if (className.includes("documentation")) {
        this.currentResult.type = "documentation"
      } else if (className.includes("general")) {
        this.currentResult.type = "general"
      } else {
        this.currentResult.type = "other"
      }
    }

    // Result title link
    if (
      element.tagName === "a" &&
      element.getAttribute("class")?.includes("click-analytics-result")
    ) {
      const href = element.getAttribute("href")
      if (href) {
        this.currentResult.url = href.startsWith("/") ? `https://developer.apple.com${href}` : href
      }
      this.isInResultTitle = true
    }

    // Result description
    if (element.tagName === "p" && element.getAttribute("class")?.includes("result-description")) {
      this.isInResultDescription = true
    }

    // Breadcrumb items
    if (
      element.tagName === "li" &&
      element.getAttribute("class")?.includes("breadcrumb-list-item")
    ) {
      this.isInBreadcrumb = true
    }

    // Tag spans
    if (
      element.tagName === "span" &&
      element.parentElement?.getAttribute("class")?.includes("result-tag")
    ) {
      this.isInTag = true
    }

    // Tag list items (for languages like "Swift", "Objective-C")
    if (
      element.tagName === "li" &&
      element.getAttribute("class")?.includes("result-tag language")
    ) {
      this.isInTag = true
    }
  }

  text(text: Text) {
    const content = text.text.trim()
    if (!content) return

    if (this.isInResultTitle && this.currentResult.url) {
      this.currentResult.title = content
      this.isInResultTitle = false
    } else if (this.isInResultDescription) {
      this.currentResult.description = content
      this.isInResultDescription = false
    } else if (this.isInBreadcrumb) {
      this.currentBreadcrumbs.push(content)
      this.isInBreadcrumb = false
    } else if (this.isInTag) {
      this.currentTags.push(content)
      this.isInTag = false
    }
  }

  end() {
    this.finalizeCurrentResult() // Finalize the last result
  }
}

export async function searchAppleDeveloperDocs(query: string): Promise<SearchResponse> {
  const searchUrl = `https://developer.apple.com/search/?q=${encodeURIComponent(query)}`
  const response = await fetch(searchUrl, {
    headers: {
      "User-Agent": getRandomUserAgent(),
    },
  })

  if (!response.ok) {
    throw new Error(`Search request failed: ${response.status}`)
  }

  const html = await response.text()
  let results: SearchResult[] = []
  if (typeof HTMLRewriter !== "undefined") {
    const parser = new SearchResultParser()
    const rewriter = new HTMLRewriter()
      .on("li.search-result", parser)
      .on("li.search-result a.click-analytics-result", parser)
      .on("li.search-result p.result-description", parser)
      .on("li.search-result li.breadcrumb-list-item", parser)
      .on("li.search-result li.result-tag", parser)
      .on("li.search-result li.result-tag span", parser)

    // We need to consume the transformed response to trigger parsing callbacks.
    await rewriter.transform(new Response(html)).text()
    parser.end()
    results = parser.getResults()
  } else {
    results = await parseSearchResultsWithCheerio(html)
  }

  return {
    query,
    results,
  }
}

async function parseSearchResultsWithCheerio(html: string): Promise<SearchResult[]> {
  const { load } = await import("cheerio")
  const $ = load(html)
  const results: SearchResult[] = []

  $("li.search-result").each((_, element) => {
    const item = $(element)
    const link = item.find("a.click-analytics-result").first()
    const rawHref = link.attr("href")
    const title = link.text().trim()

    if (!rawHref || !title) {
      return
    }

    const description = item.find("p.result-description").first().text().trim()
    const breadcrumbs = item
      .find("li.breadcrumb-list-item")
      .toArray()
      .map((breadcrumb) => $(breadcrumb).text().trim())
      .filter(Boolean)

    const tags = item
      .find("li.result-tag span, li.result-tag.language")
      .toArray()
      .map((tag) => $(tag).text().trim())
      .filter(Boolean)

    const className = item.attr("class") ?? ""
    const type = className.includes("documentation")
      ? "documentation"
      : className.includes("general")
        ? "general"
        : "other"

    results.push({
      title,
      url: rawHref.startsWith("/") ? `https://developer.apple.com${rawHref}` : rawHref,
      description,
      breadcrumbs,
      tags,
      type,
    })
  })

  return results
}

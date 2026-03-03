import { StreamableHTTPTransport } from "@hono/mcp"
import { Hono } from "hono"
import { cache } from "hono/cache"
import { cors } from "hono/cors"
import { HTTPException } from "hono/http-exception"
import { trimTrailingSlash } from "hono/trailing-slash"
import {
  decodeExternalTargetPath,
  ExternalAccessError,
  extractExternalDocumentationBasePath,
  fetchExternalDocCJSON,
  validateExternalDocumentationUrl,
} from "./lib/external"
import { NotFoundError } from "./lib/fetch"
import {
  fetchHIGPageData,
  fetchHIGTableOfContents,
  renderHIGFromJSON,
  renderHIGTableOfContents,
} from "./lib/hig"
import { createMcpServer } from "./lib/mcp"
import { fetchJSONData, renderFromJSON } from "./lib/reference"
import { searchAppleDeveloperDocs } from "./lib/search"
import { generateAppleDocUrl, isValidAppleDocUrl, normalizeDocumentationPath } from "./lib/url"
import { fetchVideoTranscriptMarkdown, TranscriptNotFoundError } from "./lib/video"

interface Env {
  ASSETS: Fetcher
  NODE_ENV: string
  EXTERNAL_DOC_HOST_ALLOWLIST?: string
  EXTERNAL_DOC_HOST_BLOCKLIST?: string
}

const app = new Hono<{ Bindings: Env }>()

app.use("*", async (c, next) => {
  await next()

  // Security headers
  c.header("X-Content-Type-Options", "nosniff")
  c.header("X-Frame-Options", "DENY")
  c.header("X-XSS-Protection", "1; mode=block")
  c.header("Referrer-Policy", "strict-origin-when-cross-origin")
  c.header("Permissions-Policy", "camera=(), microphone=(), geolocation=()")

  // Performance headers
  c.header("Vary", "Accept")

  // Development-specific headers
  if (c.env.NODE_ENV === "development") {
    c.header("Cache-Control", "no-store")
  }
})

app.use("*", cors())

app.use(trimTrailingSlash())

app.use("*", async (c, next) => {
  if (c.env.NODE_ENV !== "development") {
    cache({
      cacheName: "sosumi-cache",
      cacheControl: "max-age=86400", // 24 hours
    })
  }
  await next()
})

app.all("/mcp", async (c) => {
  const mcpServer = createMcpServer({
    EXTERNAL_DOC_HOST_ALLOWLIST: c.env.EXTERNAL_DOC_HOST_ALLOWLIST,
    EXTERNAL_DOC_HOST_BLOCKLIST: c.env.EXTERNAL_DOC_HOST_BLOCKLIST,
  })
  const transport = new StreamableHTTPTransport()
  await mcpServer.connect(transport)
  return transport.handleRequest(c)
})

app.get("/", async (c) => {
  if (c.req.header("Accept")?.includes("text/markdown")) {
    const llmsUrl = new URL("/llms.txt", c.req.url)
    const llmsResponse = await c.env.ASSETS.fetch(new Request(llmsUrl.toString()))

    if (!llmsResponse.ok) {
      throw new HTTPException(500, {
        message: "Failed to load llms.txt",
      })
    }

    const markdown = await llmsResponse.text()
    return c.text(markdown, 200, {
      "Content-Type": "text/markdown; charset=utf-8",
      "Cache-Control": "public, max-age=300, s-maxage=600",
    })
  }

  return c.env.ASSETS.fetch(c.req.raw)
})

app.get("/bot", (c) => c.redirect("/#bot", 302))

app.get("/search", async (c) => {
  const query = c.req.query("q")?.trim() ?? ""
  if (!query) {
    throw new HTTPException(400, {
      message: "Missing search query. Provide ?q=...",
    })
  }

  const searchResponse = await searchAppleDeveloperDocs(query)
  if (c.req.header("Accept")?.includes("application/json")) {
    return c.json(searchResponse, 200, {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=300, s-maxage=600",
    })
  }

  if (searchResponse.results.length === 0) {
    return c.text(`No results found for "${query}"`, 200, {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=300, s-maxage=600",
    })
  }

  const summary =
    `Found ${searchResponse.results.length} result(s) for "${query}":\n\n` +
    searchResponse.results
      .map(
        (result, index) =>
          `${index + 1}. ${result.title}\n   ${result.url}\n   ${result.description || "No description"}`,
      )
      .join("\n\n")

  return c.text(summary, 200, {
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "public, max-age=300, s-maxage=600",
  })
})

app.get("/documentation/*", async (c) => {
  const path = c.req.path

  // Normalize path and generate Apple Developer URL
  const normalizedPath = normalizeDocumentationPath(path.replace("/documentation/", ""))
  const appleUrl = generateAppleDocUrl(normalizedPath)

  // Validate the URL is a proper Apple documentation URL
  if (!isValidAppleDocUrl(appleUrl)) {
    const errorResponse = new Response(
      `# Invalid Apple Documentation URL

The URL \`${appleUrl}\` is not a valid Apple Developer documentation page.

## Supported URL Patterns

This service only works with Apple Developer documentation URLs:

- \`https://developer.apple.com/documentation/*\`

## Examples

- [Swift Documentation](https://sosumi.ai/documentation/swift)
- [SwiftUI Documentation](https://sosumi.ai/documentation/swiftui)
- [UIKit Documentation](https://sosumi.ai/documentation/uikit)

---
*[sosumi.ai](https://sosumi.ai) - Making Apple docs AI-readable*`,
      {
        status: 400,
        headers: { "Content-Type": "text/markdown; charset=utf-8" },
      },
    )
    throw new HTTPException(400, { res: errorResponse })
  }

  const jsonData = await fetchJSONData(path)
  const markdown = await renderFromJSON(jsonData, appleUrl)

  // Validate that we got meaningful content
  if (!markdown || markdown.trim().length < 100) {
    throw new HTTPException(502, {
      message:
        "The Apple documentation page loaded but contained insufficient content. This may be a temporary issue with the page.",
    })
  }

  const headers = {
    "Content-Type": "text/markdown; charset=utf-8",
    "Content-Location": appleUrl,
    "Cache-Control": "public, max-age=3600, s-maxage=86400",
    ETag: `"${Buffer.from(markdown).toString("base64").slice(0, 16)}"`,
  }

  if (c.req.header("Accept")?.includes("application/json")) {
    return c.json(
      {
        url: appleUrl,
        content: markdown,
      },
      200,
      { ...headers, "Content-Type": "application/json; charset=utf-8" },
    )
  }

  return c.text(markdown, 200, {
    ...headers,
    "Content-Type": "text/markdown; charset=utf-8",
  })
})

app.get("/external/*", async (c) => {
  const path = c.req.path
  const rawTarget = decodeExternalTargetPath(path)
  const targetUrl = validateExternalDocumentationUrl(rawTarget)

  const jsonData = await fetchExternalDocCJSON(targetUrl, c.env)
  const externalBasePath = extractExternalDocumentationBasePath(targetUrl)
  const markdown = await renderFromJSON(jsonData, targetUrl.toString(), {
    externalOrigin: `${targetUrl.origin}${externalBasePath}`,
  })

  if (!markdown || markdown.trim().length < 100) {
    throw new HTTPException(502, {
      message:
        "The external documentation page loaded but contained insufficient content. This may be a temporary issue with the page.",
    })
  }

  const headers = {
    "Content-Type": "text/markdown; charset=utf-8",
    "Content-Location": targetUrl.toString(),
    "Cache-Control": "public, max-age=3600, s-maxage=86400",
    ETag: `"${Buffer.from(markdown).toString("base64").slice(0, 16)}"`,
  }

  if (c.req.header("Accept")?.includes("application/json")) {
    return c.json(
      {
        url: targetUrl.toString(),
        content: markdown,
      },
      200,
      { ...headers, "Content-Type": "application/json; charset=utf-8" },
    )
  }

  return c.text(markdown, 200, {
    ...headers,
    "Content-Type": "text/markdown; charset=utf-8",
  })
})

app.get("/design/human-interface-guidelines", async (c) => {
  // Handle the table of contents for HIG
  const tocData = await fetchHIGTableOfContents()
  const markdown = await renderHIGTableOfContents(tocData)

  // Validate that we got meaningful content
  if (!markdown || markdown.trim().length < 100) {
    throw new HTTPException(502, {
      message:
        "The HIG table of contents loaded but contained insufficient content. This may be a temporary issue.",
    })
  }

  const sourceUrl = "https://developer.apple.com/design/human-interface-guidelines/"
  const headers = {
    "Content-Type": "text/markdown; charset=utf-8",
    "Content-Location": sourceUrl,
    "Cache-Control": "public, max-age=3600, s-maxage=86400",
    ETag: `"${Buffer.from(markdown).toString("base64").slice(0, 16)}"`,
  }

  if (c.req.header("Accept")?.includes("application/json")) {
    return c.json(
      {
        url: sourceUrl,
        content: markdown,
      },
      200,
      { ...headers, "Content-Type": "application/json; charset=utf-8" },
    )
  }

  return c.text(markdown, 200, headers)
})

app.get("/design/human-interface-guidelines/:path{.+}", async (c) => {
  const higPath = c.req.param("path")
  if (!higPath) {
    // This should be caught by the route above, but just in case
    throw new HTTPException(400, {
      message: "Invalid HIG path",
    })
  }

  const jsonData = await fetchHIGPageData(higPath)
  const sourceUrl = `https://developer.apple.com/design/human-interface-guidelines/${higPath}`
  const markdown = await renderHIGFromJSON(jsonData, sourceUrl)

  // Validate that we got meaningful content
  if (!markdown || markdown.trim().length < 100) {
    throw new HTTPException(502, {
      message:
        "The HIG page loaded but contained insufficient content. This may be a temporary issue with the page.",
    })
  }

  const headers = {
    "Content-Type": "text/markdown; charset=utf-8",
    "Content-Location": sourceUrl,
    "Cache-Control": "public, max-age=3600, s-maxage=86400",
    ETag: `"${Buffer.from(markdown).toString("base64").slice(0, 16)}"`,
  }

  if (c.req.header("Accept")?.includes("application/json")) {
    return c.json(
      {
        url: sourceUrl,
        content: markdown,
      },
      200,
      { ...headers, "Content-Type": "application/json; charset=utf-8" },
    )
  }

  return c.text(markdown, 200, headers)
})

app.get("/videos/play/:collection/:id", async (c) => {
  const collection = c.req.param("collection")
  const id = c.req.param("id")

  if (!/^[a-z0-9-]+$/i.test(collection) || !/^\d+$/.test(id)) {
    throw new HTTPException(400, {
      message:
        "Invalid video path. Supported format: /videos/play/COLLECTION/VIDEO_ID (for example, /videos/play/wwdc2021/10133).",
    })
  }

  const sourceUrl = `https://developer.apple.com/videos/play/${collection}/${id}/`

  let markdown: string
  try {
    markdown = await fetchVideoTranscriptMarkdown(sourceUrl, collection, id)
  } catch (error) {
    if (error instanceof TranscriptNotFoundError) {
      throw new HTTPException(404, {
        message: "Transcript not found. Some Apple Developer videos may not include a transcript.",
      })
    }
    throw error
  }

  if (!markdown || markdown.trim().length < 100) {
    throw new HTTPException(502, {
      message:
        "The video transcript loaded but contained insufficient content. This may be a temporary issue with the page.",
    })
  }

  const headers = {
    "Content-Type": "text/markdown; charset=utf-8",
    "Content-Location": sourceUrl,
    "Cache-Control": "public, max-age=3600, s-maxage=86400",
    ETag: `"${Buffer.from(markdown).toString("base64").slice(0, 16)}"`,
  }

  if (c.req.header("Accept")?.includes("application/json")) {
    return c.json(
      {
        url: sourceUrl,
        content: markdown,
      },
      200,
      { ...headers, "Content-Type": "application/json; charset=utf-8" },
    )
  }

  return c.text(markdown, 200, headers)
})

// Catch-all route for any other requests - returns 404
app.all("*", (c) => {
  return c.text(
    `# Not Found

The requested resource was not found on this server.

This service only works with Apple Developer documentation URLs:
- \`https://sosumi.ai/documentation/*\`

---
*[sosumi.ai](https://sosumi.ai) - Making Apple docs AI-readable*`,
    404,
    { "Content-Type": "text/markdown; charset=utf-8" },
  )
})

app.onError((err, c) => {
  console.error("Error occurred:", err)

  if (err instanceof HTTPException) {
    // Get the custom response
    return err.getResponse()
  }

  if (err instanceof NotFoundError) {
    const accept = c.req.header("Accept")
    if (accept?.includes("application/json")) {
      return c.json(
        {
          error: "Documentation not found",
          message: "The requested Apple Developer documentation page does not exist.",
        },
        404,
      )
    }

    return c.text(
      `# Not Found

The requested Apple Developer documentation page does not exist.

## What you can try:

1. **Check the URL** - Make sure the path is correct
2. **Browse from a parent page** - Try starting from a higher-level documentation page
3. **Search Apple Developer Documentation** - Use Apple's official search

## Examples of valid URLs:

- [Swift Documentation](https://sosumi.ai/documentation/swift)
- [SwiftUI Documentation](https://sosumi.ai/documentation/swiftui)
- [UIKit Documentation](https://sosumi.ai/documentation/uikit)

---
*[sosumi.ai](https://sosumi.ai) - Making Apple docs AI-readable*`,
      404,
      { "Content-Type": "text/markdown; charset=utf-8" },
    )
  }

  if (err instanceof ExternalAccessError) {
    const accept = c.req.header("Accept")
    if (accept?.includes("application/json")) {
      return c.json(
        {
          error: "External documentation access denied",
          message: err.message,
        },
        { status: err.status as 400 | 403 | 404 },
      )
    }

    return c.text(
      `# External Documentation Access Denied

${err.message}

## Opt-out controls supported

- \`robots.txt\` disallow for \`sosumi-ai\` (or \`*\`)
- \`X-Robots-Tag\` response directives such as \`noai\`, \`noimageai\`, \`noindex\`
- Local operator host controls: \`EXTERNAL_DOC_HOST_ALLOWLIST\`, \`EXTERNAL_DOC_HOST_BLOCKLIST\`

---
*[sosumi.ai](https://sosumi.ai) - Making docs AI-readable*`,
      err.status as 400 | 403 | 404,
      { "Content-Type": "text/markdown; charset=utf-8" },
    )
  }

  // Handle unexpected errors
  const accept = c.req.header("Accept")
  if (accept?.includes("application/json")) {
    return c.json(
      {
        error: "Service temporarily unavailable",
        message:
          "We encountered an unexpected issue while processing your request. Please try again in a few moments.",
      },
      500,
    )
  }

  return c.text(
    `# Service Temporarily Unavailable

We encountered an unexpected issue while processing your request.

## What you can try:

1. **Wait a moment and try again** - This is often a temporary issue
2. **Check the URL** - Make sure you're using a valid Apple Developer documentation URL
3. **Try a different page** - Some pages may have temporary issues

## Examples of valid URLs:

- [Swift Documentation](https://sosumi.ai/documentation/swift)
- [SwiftUI Documentation](https://sosumi.ai/documentation/swiftui)
- [UIKit Documentation](https://sosumi.ai/documentation/uikit)

If this issue persists, please report it to <info@sosumi.ai>.

---
*[sosumi.ai](https://sosumi.ai) - Making Apple docs AI-readable*`,
    500,
    { "Content-Type": "text/markdown; charset=utf-8" },
  )
})

export default app

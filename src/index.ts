import { StreamableHTTPTransport } from "@hono/mcp"
import { Hono } from "hono"
import { cache } from "hono/cache"
import { cors } from "hono/cors"
import { HTTPException } from "hono/http-exception"

import { fetchJSONData, NotFoundError } from "./lib/fetch"
import { createMcpServer } from "./lib/mcp"
import { renderFromJSON } from "./lib/render"
import { generateAppleDocUrl, isValidAppleDocUrl, normalizeDocumentationPath } from "./lib/url"

interface Env {
  ASSETS: Fetcher
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
})

app.use("*", cors())

app.use(
  "/documentation/*",
  cache({
    cacheName: "sosumi-cache",
    cacheControl: "max-age=86400", // 24 hours
  }),
)

const mcpServer = createMcpServer()
app.all("/mcp", async (c) => {
  const transport = new StreamableHTTPTransport()
  await mcpServer.connect(transport)
  return transport.handleRequest(c)
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
    "Last-Modified": new Date().toUTCString(),
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

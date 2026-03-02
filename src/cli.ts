import { parseCliArgs, resolveFetchEndpoint } from "./lib/cli-endpoints"
import { fetchExternalDocumentationMarkdown } from "./lib/external"
import { NotFoundError } from "./lib/fetch"
import {
  extractHIGPaths,
  fetchHIGPageData,
  fetchHIGTableOfContents,
  renderHIGFromJSON,
  renderHIGTableOfContents,
} from "./lib/hig"
import { fetchJSONData, renderFromJSON } from "./lib/reference"
import { searchAppleDeveloperDocs } from "./lib/search"
import { generateAppleDocUrl, normalizeDocumentationPath } from "./lib/url"
import { fetchVideoTranscriptMarkdown } from "./lib/video"

function printUsage() {
  console.error(`Usage:
  sosumi fetch <url-or-path> [--json]
  sosumi search <query> [--json]
  sosumi serve [wrangler-dev-args...]

Examples:
  npx @nshipster/sosumi fetch https://developer.apple.com/documentation/swift/array
  npx @nshipster/sosumi fetch /videos/play/wwdc2021/10133
  npx @nshipster/sosumi search "SwiftData"
  npx @nshipster/sosumi serve --port 8787
`)
}

function printTextOutput(text: string) {
  process.stdout.write(text)
}

function printJsonOutput(value: unknown) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`)
}

async function runFetch(input: string, json: boolean) {
  const endpoint = resolveFetchEndpoint(input)

  if (endpoint.startsWith("/documentation/")) {
    const documentationPath = endpoint.replace(/^\/documentation\//, "")
    const normalizedPath = normalizeDocumentationPath(documentationPath)
    const appleUrl = generateAppleDocUrl(normalizedPath)
    const jsonData = await fetchJSONData(normalizedPath)
    const markdown = await renderFromJSON(jsonData, appleUrl)
    if (json) {
      printJsonOutput({ url: appleUrl, content: markdown })
    } else {
      printTextOutput(markdown)
    }
    return
  }

  if (endpoint === "/design/human-interface-guidelines") {
    const markdown = await renderHIGTableOfContents(await fetchHIGTableOfContents())
    const sourceUrl = "https://developer.apple.com/design/human-interface-guidelines/"
    if (json) {
      printJsonOutput({ url: sourceUrl, content: markdown })
    } else {
      printTextOutput(markdown)
    }
    return
  }

  if (endpoint.startsWith("/design/human-interface-guidelines/")) {
    const higPath = endpoint.replace(/^\/design\/human-interface-guidelines\//, "")
    const { sourceUrl, markdown } = await fetchHigMarkdown(higPath)
    if (json) {
      printJsonOutput({ url: sourceUrl, content: markdown })
    } else {
      printTextOutput(markdown)
    }
    return
  }

  if (endpoint.startsWith("/videos/play/")) {
    const match = endpoint.match(/^\/videos\/play\/([a-z0-9-]+)\/(\d+)$/i)
    if (!match) {
      throw new Error("Invalid video path. Expected /videos/play/COLLECTION/VIDEO_ID")
    }
    const collection = match[1]
    const videoId = match[2]
    const sourceUrl = `https://developer.apple.com/videos/play/${collection}/${videoId}/`
    const markdown = await fetchVideoTranscriptMarkdown(sourceUrl, collection, videoId)
    if (json) {
      printJsonOutput({ url: sourceUrl, content: markdown })
    } else {
      printTextOutput(markdown)
    }
    return
  }

  if (endpoint.startsWith("/external/")) {
    const externalUrl = endpoint.replace(/^\/external\//, "")
    const markdown = await fetchExternalDocumentationMarkdown(externalUrl, {
      EXTERNAL_DOC_HOST_ALLOWLIST: process.env.EXTERNAL_DOC_HOST_ALLOWLIST,
      EXTERNAL_DOC_HOST_BLOCKLIST: process.env.EXTERNAL_DOC_HOST_BLOCKLIST,
    })
    if (json) {
      printJsonOutput({ url: externalUrl, content: markdown })
    } else {
      printTextOutput(markdown)
    }
    return
  }

  throw new Error(`Unsupported fetch endpoint: ${endpoint}`)
}

async function fetchHigMarkdown(higPath: string): Promise<{ sourceUrl: string; markdown: string }> {
  const sourceUrlFor = (path: string) =>
    `https://developer.apple.com/design/human-interface-guidelines/${path}`

  const resolvedPath = await resolveHigPathForFetch(higPath)

  try {
    const sourceUrl = sourceUrlFor(resolvedPath)
    const markdown = await renderHIGFromJSON(await fetchHIGPageData(resolvedPath), sourceUrl)
    return { sourceUrl, markdown }
  } catch (error) {
    if (error instanceof NotFoundError && resolvedPath !== higPath) {
      const sourceUrl = sourceUrlFor(higPath)
      const markdown = await renderHIGFromJSON(await fetchHIGPageData(higPath), sourceUrl)
      return { sourceUrl, markdown }
    }
    throw error
  }
}

async function resolveHigPathForFetch(higPath: string): Promise<string> {
  if (!higPath.includes("/")) {
    return higPath
  }

  // HIG moved many topics from grouped paths (e.g. foundations/color -> color).
  // Resolve legacy grouped paths by leaf slug from the live ToC when unique.
  const leaf = higPath.split("/").filter(Boolean).pop()
  if (!leaf) {
    return higPath
  }

  const paths = extractHIGPaths(await fetchHIGTableOfContents())
  const matches = paths.filter((path) => path === leaf || path.endsWith(`/${leaf}`))
  return matches.length === 1 ? matches[0] : higPath
}

async function runSearch(query: string, json: boolean) {
  const searchResponse = await searchAppleDeveloperDocs(query)
  if (json) {
    printJsonOutput(searchResponse)
    return
  }

  if (searchResponse.results.length === 0) {
    console.error(`No results found for "${query}"`)
    process.exitCode = 2
    return
  }

  const resultText =
    `Found ${searchResponse.results.length} result(s) for "${query}":\n\n` +
    searchResponse.results
      .map(
        (result, index) =>
          `${index + 1}. ${result.title}\n   ${result.url}\n   ${result.description || "No description"}`,
      )
      .join("\n\n")
  printTextOutput(resultText)
}

export async function main(argv: string[] = process.argv.slice(2)) {
  const { help, flags, positionals } = parseCliArgs(argv)
  if (help) {
    printUsage()
    return
  }

  if (positionals.length < 2) {
    printUsage()
    process.exitCode = 1
    return
  }

  const [command, ...rest] = positionals
  const payload = rest.join(" ")

  if (command === "fetch") {
    await runFetch(payload, flags.json)
    return
  }

  if (command === "search") {
    await runSearch(payload, flags.json)
    return
  }

  // "serve" is still handled by bin wrapper to keep wrangler process behavior.
  if (command === "serve") {
    return
  }

  throw new Error(`Unknown command: ${command}`)
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error(`sosumi: ${message}`)
  process.exit(1)
})

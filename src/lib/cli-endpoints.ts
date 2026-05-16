import { normalizeDocumentationPath } from "./url"

const VIDEO_PATH_RE = /^\/videos\/play\/([a-z0-9-]+)\/(\d+)\/?$/i

export interface CliParseResult {
  help: boolean
  flags: {
    json: boolean
  }
  positionals: string[]
}

export function parseCliArgs(argv: string[]): CliParseResult {
  const flags = { json: false }
  const positionals: string[] = []

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === "--json") {
      flags.json = true
      continue
    }
    if (arg === "--base-url") {
      throw new Error("--base-url is no longer supported. CLI runs using local src logic.")
    }
    if (arg === "-h" || arg === "--help") {
      return { help: true, flags, positionals: [] }
    }
    if (arg.startsWith("--")) {
      throw new Error(`Unknown option: ${arg}`)
    }
    positionals.push(arg)
  }

  return { help: false, flags, positionals }
}

function normalizeHigPath(pathname: string): string {
  if (pathname === "/design/human-interface-guidelines/") {
    return "/design/human-interface-guidelines"
  }
  return pathname.endsWith("/") ? pathname.slice(0, -1) : pathname
}

export function resolveFetchEndpoint(input: string): string {
  const trimmed = input.trim()
  if (!trimmed) {
    throw new Error("Fetch input cannot be empty")
  }

  if (/^https?:\/\//i.test(trimmed)) {
    const target = new URL(trimmed)
    if (target.protocol !== "https:") {
      throw new Error("Only https URLs are supported")
    }

    if (target.hostname === "developer.apple.com") {
      if (target.pathname.startsWith("/documentation/")) {
        return target.pathname
      }

      if (target.pathname.startsWith("/design/human-interface-guidelines")) {
        return normalizeHigPath(target.pathname)
      }

      const videoMatch = target.pathname.match(VIDEO_PATH_RE)
      if (videoMatch) {
        return `/videos/play/${videoMatch[1]}/${videoMatch[2]}`
      }

      throw new Error(`Unsupported developer.apple.com URL path: ${target.pathname}`)
    }

    return `/external/${trimmed}`
  }

  if (trimmed.startsWith("/documentation/")) {
    return trimmed
  }

  if (trimmed.startsWith("/design/human-interface-guidelines")) {
    return normalizeHigPath(trimmed)
  }

  if (trimmed.startsWith("/videos/play/")) {
    const videoMatch = trimmed.match(VIDEO_PATH_RE)
    if (!videoMatch) {
      throw new Error("Invalid video path. Expected /videos/play/COLLECTION/VIDEO_ID")
    }
    return `/videos/play/${videoMatch[1]}/${videoMatch[2]}`
  }

  if (trimmed.startsWith("/external/")) {
    return trimmed
  }

  return `/documentation/${normalizeDocumentationPath(trimmed)}`
}

export function resolveSearchEndpoint(query: string): string {
  const trimmed = query.trim()
  if (!trimmed) {
    throw new Error("Search query cannot be empty")
  }
  return `/search?q=${encodeURIComponent(trimmed)}`
}

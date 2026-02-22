import { getRandomUserAgent } from "../fetch"

export class TranscriptNotFoundError extends Error {}

const APPLE_VIDEO_SUFFIX = " - Videos - Apple Developer"

interface TranscriptLine {
  startSeconds: number
  text: string
}

export async function fetchVideoTranscriptMarkdown(
  sourceUrl: string,
  collection: string,
  videoId: string,
): Promise<string> {
  const html = await fetchVideoTranscriptHtml(sourceUrl)
  const title = extractVideoTitleFromHtml(html) ?? `Video ${videoId}`
  const transcriptLines = extractTranscriptLinesFromHtml(html)

  if (transcriptLines.length === 0) {
    throw new TranscriptNotFoundError("Transcript not found for this video.")
  }

  return renderVideoTranscriptMarkdown({
    title,
    sourceUrl,
    collection,
    videoId,
    transcriptLines,
  })
}

export async function fetchVideoTranscriptHtml(sourceUrl: string): Promise<string> {
  const response = await fetch(sourceUrl, {
    headers: {
      "User-Agent": getRandomUserAgent(),
      Accept: "text/html,application/xhtml+xml",
      "Cache-Control": "no-cache",
    },
  })

  if (!response.ok) {
    if (response.status === 404) {
      throw new TranscriptNotFoundError("Video not found.")
    }
    throw new Error(`Failed to fetch video page: ${response.status} ${response.statusText}`)
  }

  return response.text()
}

function extractVideoTitleFromHtml(html: string): string | null {
  const titleMatch = html.match(/<title>([\s\S]*?)<\/title>/i)
  if (!titleMatch) {
    return null
  }

  const title = decodeHtmlEntities(stripHtml(titleMatch[1])).trim()
  if (!title) {
    return null
  }

  if (title.endsWith(APPLE_VIDEO_SUFFIX)) {
    return title.slice(0, -APPLE_VIDEO_SUFFIX.length).trim()
  }

  return title
}

export function extractTranscriptLinesFromHtml(html: string): TranscriptLine[] {
  const transcriptSectionMatch = html.match(
    /<section[^>]*id=["']transcript-content["'][^>]*>([\s\S]*?)<\/section>/i,
  )
  if (!transcriptSectionMatch) {
    return []
  }

  const transcriptSection = transcriptSectionMatch[1]
  const lines: TranscriptLine[] = []
  const spanPattern = /<span[^>]*data-start=["']([\d.]+)["'][^>]*>([\s\S]*?)<\/span>/gi

  let match = spanPattern.exec(transcriptSection)
  while (match) {
    const startSeconds = Number.parseFloat(match[1])
    const text = decodeHtmlEntities(stripHtml(match[2])).replace(/\s+/g, " ").trim()

    if (Number.isFinite(startSeconds) && text) {
      lines.push({ startSeconds, text })
    }

    match = spanPattern.exec(transcriptSection)
  }

  return lines
}

function renderVideoTranscriptMarkdown({
  title,
  sourceUrl,
  collection,
  videoId,
  transcriptLines,
}: {
  title: string
  sourceUrl: string
  collection: string
  videoId: string
  transcriptLines: TranscriptLine[]
}): string {
  const transcriptBody = transcriptLines
    .map((line) => `- [${formatTimestamp(line.startSeconds)}] ${line.text}`)
    .join("\n")

  return [
    "---",
    `title: ${title}`,
    `source: ${sourceUrl}`,
    `timestamp: ${new Date().toISOString()}`,
    "---",
    "",
    `# ${title}`,
    "",
    `**Collection:** ${collection}`,
    "",
    `**Video:** ${videoId}`,
    "",
    "## Transcript",
    "",
    transcriptBody,
    "",
    "---",
    "",
    "*Extracted by [sosumi.ai](https://sosumi.ai) - Making Apple docs AI-readable.*",
    "*This is unofficial content. All transcripts belong to Apple Inc.*",
    "",
  ].join("\n")
}

function formatTimestamp(seconds: number): string {
  const rounded = Math.max(0, Math.floor(seconds))
  const minutes = Math.floor(rounded / 60)
  const remainingSeconds = rounded % 60
  return `${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`
}

function stripHtml(input: string): string {
  return input.replace(/<[^>]+>/g, "")
}

function decodeHtmlEntities(input: string): string {
  return input.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (_, entity: string) => {
    if (entity[0] === "#") {
      const isHex = entity[1]?.toLowerCase() === "x"
      const codePoint = Number.parseInt(entity.slice(isHex ? 2 : 1), isHex ? 16 : 10)
      if (Number.isFinite(codePoint)) {
        return String.fromCodePoint(codePoint)
      }
      return ""
    }

    switch (entity) {
      case "amp":
        return "&"
      case "lt":
        return "<"
      case "gt":
        return ">"
      case "quot":
        return '"'
      case "apos":
        return "'"
      case "nbsp":
        return " "
      default:
        return `&${entity};`
    }
  })
}

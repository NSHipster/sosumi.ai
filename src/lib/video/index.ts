import { getRandomUserAgent } from "../fetch"

export class TranscriptNotFoundError extends Error {}

const APPLE_VIDEO_SUFFIX = " - Videos - Apple Developer"

interface TranscriptLine {
  startSeconds: number
  text: string
}

interface CodeSample {
  title: string | null
  startSeconds: number | null
  code: string
}

export async function fetchVideoTranscriptMarkdown(
  sourceUrl: string,
  collection: string,
  videoId: string,
): Promise<string> {
  const html = await fetchVideoTranscriptHtml(sourceUrl)
  const title = extractVideoTitleFromHtml(html) ?? `Video ${videoId}`
  const transcriptLines = extractTranscriptLinesFromHtml(html)
  const codeSamples = extractCodeSamplesFromHtml(html)

  if (transcriptLines.length === 0) {
    throw new TranscriptNotFoundError("Transcript not found for this video.")
  }

  return renderVideoTranscriptMarkdown({
    title,
    sourceUrl,
    collection,
    videoId,
    transcriptLines,
    codeSamples,
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

/**
 * Extracts the code samples that Apple shows in the Code tab of a session page.
 *
 * Each sample is an `li.sample-code-main-container` inside `li.supplement.sample-code`,
 * with a title line such as `3:40 - <a data-start-time="220">Title</a>`
 * and the code in `<pre class="code-source"><code>` with syntax-highlighting spans.
 */
export function extractCodeSamplesFromHtml(html: string): CodeSample[] {
  // Match the `sample-code` class itself, not `sample-code-main-container`.
  const supplementStart = html.search(
    /<li[^>]*class=["'][^"']*(?<![\w-])sample-code(?![\w-])[^"']*["'][^>]*>/i,
  )
  if (supplementStart === -1) {
    return []
  }

  // The escaped code can't contain a literal `</section>`, so it ends the list.
  const supplementEnd = html.indexOf("</section>", supplementStart)
  const supplement = html.slice(supplementStart, supplementEnd === -1 ? undefined : supplementEnd)

  const samples: CodeSample[] = []
  const containerPattern =
    /<li[^>]*class=["'][^"']*\bsample-code-main-container\b[^"']*["'][^>]*>([\s\S]*?)<\/li>/gi

  for (const [, container] of supplement.matchAll(containerPattern)) {
    const codeMatch = container.match(/<pre[^>]*>\s*<code[^>]*>([\s\S]*?)<\/code>\s*<\/pre>/i)
    if (!codeMatch) {
      continue
    }

    const code = decodeHtmlEntities(stripHtml(codeMatch[1]))
      .replace(/\r\n?/g, "\n")
      .replace(/^\s*\n/, "")
      .trimEnd()
    if (!code) {
      continue
    }

    samples.push({ ...extractCodeSampleHeading(container), code })
  }

  return samples
}

function extractCodeSampleHeading(container: string): Pick<CodeSample, "title" | "startSeconds"> {
  const paragraphMatch = container.match(/<p[^>]*>([\s\S]*?)<\/p>/i)
  if (!paragraphMatch) {
    return { title: null, startSeconds: null }
  }

  const paragraph = paragraphMatch[1]
  const anchorMatch = paragraph.match(/<a([^>]*)>([\s\S]*?)<\/a>/i)
  const startTimeMatch = anchorMatch?.[1].match(/data-start-time=["']([\d.]+)["']/i)
  const startSeconds = startTimeMatch ? Number.parseFloat(startTimeMatch[1]) : Number.NaN

  const titleSource = anchorMatch && Number.isFinite(startSeconds) ? anchorMatch[2] : paragraph
  const title = decodeHtmlEntities(stripHtml(titleSource)).replace(/\s+/g, " ").trim()

  return {
    title: title || null,
    startSeconds: Number.isFinite(startSeconds) ? startSeconds : null,
  }
}

function renderCodeSamplesMarkdown(codeSamples: CodeSample[]): string[] {
  if (codeSamples.length === 0) {
    return []
  }

  const lines = ["## Code", ""]
  codeSamples.forEach((sample, index) => {
    const timestamp =
      sample.startSeconds === null ? null : `[${formatTimestamp(sample.startSeconds)}]`
    const heading = [timestamp, sample.title].filter(Boolean).join(" ") || `Sample ${index + 1}`
    const fence = codeFenceFor(sample.code)

    lines.push(`### ${heading}`, "", `${fence}swift`, sample.code, fence, "")
  })

  return lines
}

function codeFenceFor(code: string): string {
  const longestRun = Math.max(0, ...(code.match(/`+/g) ?? []).map((run) => run.length))
  return "`".repeat(Math.max(3, longestRun + 1))
}

function renderVideoTranscriptMarkdown({
  title,
  sourceUrl,
  collection,
  videoId,
  transcriptLines,
  codeSamples,
}: {
  title: string
  sourceUrl: string
  collection: string
  videoId: string
  transcriptLines: TranscriptLine[]
  codeSamples: CodeSample[]
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
    ...renderCodeSamplesMarkdown(codeSamples),
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

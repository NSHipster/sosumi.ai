/**
 * Markdown formatting and nesting limits shared by the reference and HIG
 * renderers.
 */

/** Depth limit guarding against cyclic or pathologically nested block content. */
export const MAX_CONTENT_DEPTH = 50

/** Depth limit guarding against cyclic or pathologically nested inline content. */
export const MAX_INLINE_DEPTH = 20

/** Emitted in place of block content that exceeds `MAX_CONTENT_DEPTH`. */
export const CONTENT_TOO_DEEP = "[Content too deeply nested]"

/** Emitted in place of inline content that exceeds `MAX_INLINE_DEPTH`. */
export const INLINE_CONTENT_TOO_DEEP = "[Inline content too deeply nested]"

/**
 * Format rendered content as a Markdown list item, indenting continuation
 * lines (including nested lists) under the marker.
 */
function formatListItem(marker: string, content: string): string {
  const trimmed = content.replace(/\n+$/, "")
  if (!trimmed) {
    return `${marker.trimEnd()}\n`
  }

  // Collapse blank lines immediately before a nested list so it stays tight
  // under its parent item; keep other paragraph breaks.
  const tightened = trimmed.replace(/\n{2,}(?=(?:[-*]|\d+\.) )/g, "\n")
  const indent = " ".repeat(marker.length)
  const [first, ...rest] = tightened.split("\n")
  const continuation = rest.map((line) => (line ? indent + line : ""))
  return `${marker}${[first, ...continuation].join("\n")}\n`
}

/**
 * Format pre-rendered item contents as a Markdown list, terminated by a blank
 * line so following blocks aren't absorbed into the last item.
 */
export function formatList(itemContents: string[], ordered: boolean): string {
  const items = itemContents.map((content, index) =>
    formatListItem(ordered ? `${index + 1}. ` : "- ", content),
  )
  return `${items.join("")}\n`
}

/**
 * Format a DocC code listing as a fenced code block, defaulting to Swift.
 */
export function formatCodeBlock(code?: string | string[], syntax?: string): string {
  const body = Array.isArray(code) ? code.join("\n") : String(code || "")
  // DocC uses `occ` for Objective-C internally, but highlighters expect `objc`.
  const language = syntax === "occ" ? "objc" : syntax || "swift"
  return `\`\`\`${language}\n${body}\n\`\`\`\n\n`
}

/**
 * Format rendered cell contents as a Markdown table, escaping pipes and
 * flattening newlines that would otherwise break a row.
 */
export function formatTable(rows: string[][], hasHeaderRow: boolean): string {
  let markdown = ""
  rows.forEach((row, index) => {
    if (row.length === 0) return
    const cells = row.map((cell) => cell.replace(/\|/g, "\\|").replace(/\n/g, " ").trim())
    markdown += `| ${cells.join(" | ")} |\n`
    if (hasHeaderRow && index === 0) {
      markdown += `| ${cells.map(() => "---").join(" | ")} |\n`
    }
  })
  return markdown ? `${markdown}\n` : ""
}

/**
 * Format rendered content as a GitHub-style callout. An optional lead becomes
 * the callout's first paragraph, ahead of the content.
 */
export function formatCallout(type: string, content: string, lead?: string): string {
  const paragraphs = [lead, content.trim()].filter(Boolean)
  if (paragraphs.length === 0) {
    return ""
  }

  const quoted = paragraphs
    .join("\n\n")
    .split("\n")
    .map((line) => (line ? `> ${line}` : ">"))
    .join("\n")
  return `> [!${type}]\n${quoted}\n\n`
}

/**
 * Map a DocC aside style to a GitHub-style callout type.
 */
export function mapAsideStyleToCallout(style: string): string {
  switch (style.toLowerCase()) {
    case "warning":
      return "WARNING"
    case "important":
      return "IMPORTANT"
    case "caution":
      return "CAUTION"
    case "tip":
      return "TIP"
    case "deprecated":
      return "WARNING"
    default:
      return "NOTE"
  }
}

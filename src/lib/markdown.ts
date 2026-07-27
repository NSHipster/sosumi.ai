/**
 * Markdown formatting shared by the reference and HIG renderers.
 */

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

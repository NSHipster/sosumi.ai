/**
 * Format rendered content as a Markdown list item, indenting continuation
 * lines (including nested lists) under the marker.
 */
export function formatListItem(marker: string, content: string): string {
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

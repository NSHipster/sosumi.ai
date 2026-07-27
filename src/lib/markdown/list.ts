/**
 * Format rendered content as a Markdown list item, indenting continuation
 * lines (including nested lists) under the marker.
 */
export function formatListItem(marker: string, content: string): string {
  const trimmed = content.replace(/\n+$/, "")
  if (!trimmed) {
    return `${marker}\n`
  }

  // Only collapse blank lines immediately before a nested list; keep other
  // paragraph breaks. Indent every continuation line (including blanks) so
  // nested blocks stay inside the list item.
  const tightened = trimmed.replace(/\n{2,}(?=[-*] |\d+\. )/g, "\n")
  const lines = tightened.split("\n")
  const indent = " ".repeat(marker.length)
  const [first, ...rest] = lines
  let result = `${marker}${first}`
  for (const line of rest) {
    result += `\n${indent}${line}`
  }
  return `${result}\n`
}

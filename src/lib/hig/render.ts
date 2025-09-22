/**
 * Human Interface Guidelines (HIG) rendering functionality
 */

import type { ContentItem, TextFragment } from "../types"
import type {
  HIGPageJSON,
  HIGTableOfContents,
  HIGTocItem,
  HIGTopicSection,
  HIGReference,
  HIGImageReference,
  HIGExternalReference,
} from "./types"
import { isHIGImageReference } from "./util"

// ============================================================================
// RENDERING FUNCTIONS
// ============================================================================

/**
 * Render HIG page JSON to markdown
 */
export async function renderHIGFromJSON(jsonData: HIGPageJSON, sourceUrl: string): Promise<string> {
  let markdown = ""

  // Generate front matter
  markdown += generateHIGFrontMatter(jsonData, sourceUrl)

  // Add navigation breadcrumbs for HIG
  const breadcrumbs = generateHIGBreadcrumbs(sourceUrl)
  if (breadcrumbs) {
    markdown += breadcrumbs
  }

  // Add role heading if available
  if (jsonData.metadata?.role) {
    const roleDisplay =
      jsonData.metadata.role === "collectionGroup" ? "Guide Collection" : jsonData.metadata.role
    markdown += `**${roleDisplay}**\n\n`
  }

  // Add title
  const title = jsonData.metadata?.title || ""
  if (title) {
    markdown += `# ${title}\n\n`
  }

  // Add abstract
  if (jsonData.abstract && Array.isArray(jsonData.abstract)) {
    const abstractText = jsonData.abstract
      .filter((item: TextFragment) => item.type === "text")
      .map((item: TextFragment) => item.text)
      .join("")

    if (abstractText.trim()) {
      markdown += `> ${abstractText}\n\n`
    }
  }

  // Add primary content sections
  if (jsonData.primaryContentSections) {
    for (const section of jsonData.primaryContentSections) {
      if (section.kind === "content" && section.content) {
        markdown += renderHIGContent(section.content, jsonData.references)
      }
    }
  }

  // Add regular content sections
  if (jsonData.sections && jsonData.sections.length > 0) {
    markdown += renderHIGContent(jsonData.sections, jsonData.references)
  }

  // Add topic sections (unless hidden)
  if (jsonData.topicSections && jsonData.topicSectionsStyle !== "hidden") {
    markdown += renderHIGTopicSections(jsonData.topicSections, jsonData.references)
  }

  // Trim whitespace
  markdown = markdown.trim()

  // Add footer
  markdown += `\n\n---\n\n`
  markdown += `*Extracted by [sosumi.ai](https://sosumi.ai) - Making Apple docs AI-readable.*\n`
  markdown += `*This is unofficial content. All Human Interface Guidelines belong to Apple Inc.*\n`

  return markdown
}

/**
 * Render HIG table of contents to markdown
 */
export async function renderHIGTableOfContents(tocData: HIGTableOfContents): Promise<string> {
  let markdown = ""

  // Generate front matter
  markdown += `---\n`
  markdown += `title: Human Interface Guidelines\n`
  markdown += `description: Apple's Human Interface Guidelines - Complete table of contents\n`
  markdown += `source: https://developer.apple.com/design/human-interface-guidelines/\n`
  markdown += `timestamp: ${new Date().toISOString()}\n`
  markdown += `---\n\n`

  // Add title and introduction
  markdown += `# Human Interface Guidelines\n\n`
  markdown += `> Apple's comprehensive guide to designing interfaces for all Apple platforms.\n\n`

  // Render the table of contents
  if (tocData.interfaceLanguages?.swift) {
    markdown += renderHIGTocItems(tocData.interfaceLanguages.swift, 2)
  }

  // Add footer
  markdown += `\n\n---\n\n`
  markdown += `*Extracted by [sosumi.ai](https://sosumi.ai) - Making Apple docs AI-readable.*\n`
  markdown += `*This is unofficial content. All Human Interface Guidelines belong to Apple Inc.*\n`

  return markdown
}

// ============================================================================
// PRIVATE HELPER FUNCTIONS
// ============================================================================

/**
 * Generate front matter for HIG pages
 */
function generateHIGFrontMatter(jsonData: HIGPageJSON, sourceUrl: string): string {
  const frontMatter: Record<string, string> = {}

  if (jsonData.metadata?.title) {
    frontMatter.title = jsonData.metadata.title
  }

  if (jsonData.abstract && Array.isArray(jsonData.abstract)) {
    const description = jsonData.abstract
      .filter((item: TextFragment) => item.type === "text")
      .map((item: TextFragment) => item.text)
      .join("")
      .trim()
    if (description) {
      frontMatter.description = description
    }
  }

  frontMatter.source = sourceUrl
  frontMatter.timestamp = new Date().toISOString()

  // Convert to YAML format
  const yamlLines = Object.entries(frontMatter).map(([key, value]) => `${key}: ${value}`)
  return `---\n${yamlLines.join("\n")}\n---\n\n`
}

/**
 * Generate breadcrumb navigation for HIG
 */
function generateHIGBreadcrumbs(sourceUrl: string): string {
  const url = new URL(sourceUrl)
  const pathParts = url.pathname.split("/").filter(Boolean)
  // pathParts will be: ["design", "human-interface-guidelines", "foundations", "color"] for foundations/color

  if (pathParts.length < 3) return "" // Need at least /design/human-interface-guidelines

  let breadcrumbs = `**Navigation:** [Human Interface Guidelines](/design/human-interface-guidelines)`

  // Add breadcrumbs for all parts after /design/human-interface-guidelines
  // This includes both intermediate and final parts
  for (let i = 3; i < pathParts.length; i++) {
    const part = pathParts[i]
    // Build path up to this point
    const path = `/${pathParts.slice(0, i + 1).join("/")}`
    const formattedPart = part.replace(/-/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())
    breadcrumbs += ` › [${formattedPart}](${path})`
  }

  return `${breadcrumbs}\n\n`
}

/**
 * Render HIG content items
 */
function renderHIGContent(
  content: ContentItem[],
  references: Record<string, HIGReference | HIGImageReference | HIGExternalReference>,
): string {
  let markdown = ""

  for (const item of content) {
    if (item.type === "links" && item.items && item.style === "compactGrid") {
      // Handle the special case of link grids (like on the getting started page)
      for (const linkId of item.items) {
        if (typeof linkId === "string") {
          const reference = references[linkId]
          if (reference && !isHIGImageReference(reference)) {
            const title = reference.title || "Untitled"
            const url = reference.url || "#"
            const refAbstract = (reference as HIGReference).abstract
            const abstract = Array.isArray(refAbstract)
              ? refAbstract.map((a: TextFragment) => a.text).join("")
              : ""

            markdown += `- [${title}](${url})`
            if (abstract) {
              markdown += ` - ${abstract}`
            }
            markdown += "\n"
          }
        }
      }
      markdown += "\n"
    } else {
      // Handle other content types using the existing content renderer
      markdown += renderContentItem(item, references)
    }
  }

  return markdown
}

/**
 * Render individual content item
 */
function renderContentItem(
  item: ContentItem,
  references: Record<string, HIGReference | HIGImageReference | HIGExternalReference>,
): string {
  let markdown = ""

  if (item.type === "heading") {
    const level = Math.min(item.level || 2, 6)
    const hashes = "#".repeat(level)
    markdown += `${hashes} ${item.text}\n\n`
  } else if (item.type === "paragraph") {
    if (item.inlineContent) {
      const text = renderHIGInlineContent(item.inlineContent, references)
      markdown += `${text}\n\n`
    }
  } else if (item.type === "codeListing") {
    let code = ""
    if (Array.isArray(item.code)) {
      code = item.code.join("\n")
    } else {
      code = String(item.code || "")
    }
    const syntax = item.syntax || "swift"
    markdown += `\`\`\`${syntax}\n${code}\n\`\`\`\n\n`
  } else if (item.type === "unorderedList" && item.items) {
    for (const listItem of item.items) {
      const itemText = renderHIGContent(listItem.content || [], references)
      markdown += `- ${itemText.replace(/\n\n$/, "")}\n`
    }
    markdown += "\n"
  } else if (item.type === "orderedList" && item.items) {
    item.items.forEach((listItem: ContentItem, index: number) => {
      const itemText = renderHIGContent(listItem.content || [], references)
      markdown += `${index + 1}. ${itemText.replace(/\n\n$/, "")}\n`
    })
    markdown += "\n"
  }

  return markdown
}

/**
 * Render HIG inline content
 */
function renderHIGInlineContent(
  inlineContent: ContentItem[],
  references: Record<string, HIGReference | HIGImageReference | HIGExternalReference>,
): string {
  return inlineContent
    .map((item) => {
      if (item.type === "text") {
        return item.text
      } else if (item.type === "codeVoice") {
        return `\`${item.code}\``
      } else if (item.type === "reference") {
        const reference = item.identifier ? references[item.identifier] : undefined
        const refTitle =
          reference && !isHIGImageReference(reference)
            ? (reference as HIGReference | HIGExternalReference).title
            : undefined
        const title = item.title || item.text || refTitle || ""
        const url = reference ? (isHIGImageReference(reference) ? "#" : reference.url) : "#"
        return `[${title}](${url})`
      } else if (item.type === "emphasis") {
        return `*${
          item.inlineContent ? renderHIGInlineContent(item.inlineContent, references) : ""
        }*`
      } else if (item.type === "strong") {
        return `**${
          item.inlineContent ? renderHIGInlineContent(item.inlineContent, references) : ""
        }**`
      }
      return item.text || ""
    })
    .join("")
}

/**
 * Render HIG topic sections
 */
function renderHIGTopicSections(
  topicSections: HIGTopicSection[],
  references: Record<string, HIGReference | HIGImageReference | HIGExternalReference>,
): string {
  let markdown = ""

  for (const section of topicSections) {
    if (section.title) {
      markdown += `## ${section.title}\n\n`
    }

    if (section.identifiers) {
      for (const id of section.identifiers) {
        const reference = references[id]
        if (reference && !isHIGImageReference(reference)) {
          const title = reference.title || "Untitled"
          const url = reference.url || "#"
          const refAbstract = (reference as HIGReference).abstract
          const abstract = Array.isArray(refAbstract)
            ? refAbstract.map((a: TextFragment) => a.text).join("")
            : ""

          markdown += `- [${title}](${url})`
          if (abstract) {
            markdown += ` - ${abstract}`
          }
          markdown += "\n"
        }
      }
      markdown += "\n"
    }
  }

  return markdown
}

/**
 * Render HIG table of contents items
 */
function renderHIGTocItems(items: HIGTocItem[], headingLevel: number): string {
  let markdown = ""

  for (const item of items) {
    if (item.type === "module" || item.type === "symbol") {
      // Main sections get headings
      const hashes = "#".repeat(Math.min(headingLevel, 6))
      markdown += `${hashes} ${item.title}\n\n`

      if (item.children) {
        markdown += renderHIGTocItems(item.children, headingLevel + 1)
      }
    } else if (item.type === "article") {
      // Articles get listed as links
      const url = item.path
      markdown += `- [${item.title}](${url})\n`
    }
  }

  return markdown
}

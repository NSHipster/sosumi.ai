/**
 * Apple Developer Reference documentation rendering functionality
 */

import type { AppleDocJSON, ContentItem, IndexContentItem, TopicSection, Variant } from "./types"

interface RenderOptions {
  externalOrigin?: string
}

/**
 * Render JSON-based extracted content to markdown
 */
export async function renderFromJSON(
  jsonData: AppleDocJSON,
  sourceUrl: string,
  options: RenderOptions = {},
): Promise<string> {
  let markdown = ""

  // Generate front matter
  markdown += generateFrontMatterFromJSON(jsonData, sourceUrl)

  // Add navigation breadcrumbs
  const breadcrumbs = generateBreadcrumbs(sourceUrl, options.externalOrigin)
  if (breadcrumbs) {
    markdown += breadcrumbs
  }

  // Add symbol type and name
  if (jsonData.metadata?.roleHeading) {
    markdown += `**${jsonData.metadata.roleHeading}**\n\n`
  }

  // Add title
  const title = jsonData.metadata?.title || ""
  if (title) {
    markdown += `# ${title}\n\n`
  }

  // Add platform availability
  if (jsonData.metadata?.platforms && jsonData.metadata.platforms.length > 0) {
    const platforms = jsonData.metadata.platforms
      .map((p) => `${p.name} ${p.introducedAt}+${p.beta ? " Beta" : ""}`)
      .join(", ")
    markdown += `**Available on:** ${platforms}\n\n`
  }

  // Add abstract
  if (jsonData.abstract && Array.isArray(jsonData.abstract)) {
    const abstractText = jsonData.abstract
      .filter((item) => item.type === "text")
      .map((item) => item.text)
      .join("")

    if (abstractText.trim()) {
      markdown += `> ${abstractText}\n\n`
    }
  }

  // Add declaration
  if (jsonData.primaryContentSections) {
    const declarationSection = jsonData.primaryContentSections.find(
      (s) => s.kind === "declarations",
    )
    if (declarationSection?.declarations) {
      markdown += renderDeclarations(declarationSection.declarations)
    }

    // Add parameters
    const parametersSection = jsonData.primaryContentSections.find((s) => s.kind === "parameters")
    if (parametersSection?.parameters) {
      markdown += renderParameters(
        parametersSection.parameters,
        jsonData.references,
        options.externalOrigin,
      )
    }

    // Add content sections
    const contentSections = jsonData.primaryContentSections.filter((s) => s.kind === "content")
    for (const section of contentSections) {
      if (section.content) {
        markdown += renderContent(section.content, jsonData.references, options.externalOrigin)
      }
    }
  }

  // Add relationship sections (Inherited By, Conforming Types, etc.)
  if (jsonData.relationshipsSections) {
    markdown += renderRelationships(
      jsonData.relationshipsSections,
      jsonData.variants,
      jsonData.references,
      options.externalOrigin,
    )
  }

  // Add topic sections
  if (jsonData.topicSections) {
    markdown += renderTopicSections(
      jsonData.topicSections,
      jsonData.variants,
      jsonData.references,
      options.externalOrigin,
    )
  }

  // Add index content for framework pages
  if (jsonData.interfaceLanguages?.swift) {
    const swiftContent = jsonData.interfaceLanguages.swift[0]
    if (swiftContent.children) {
      markdown += renderIndexContent(swiftContent.children, options.externalOrigin)
    }
  }

  // Add see also sections
  if (jsonData.seeAlsoSections) {
    markdown += renderSeeAlso(
      jsonData.seeAlsoSections,
      jsonData.variants,
      jsonData.references,
      options.externalOrigin,
    )
  }

  // Trim whitespace
  markdown = markdown.trim()

  // Add footer
  markdown += `\n\n---\n\n`
  markdown += `*Extracted by [sosumi.ai](https://sosumi.ai) - Making Apple docs AI-readable.*\n`
  markdown += `*This is unofficial content. All documentation belongs to Apple Inc.*\n`

  return markdown
}

/**
 * Generate YAML front-matter from JSON data
 */
function generateFrontMatterFromJSON(jsonData: AppleDocJSON, sourceUrl: string): string {
  const frontMatter: Record<string, string> = {}

  if (jsonData.metadata?.title) {
    const cleanTitle = jsonData.metadata.title.replace("| Apple Developer Documentation", "").trim()
    frontMatter.title = cleanTitle
  } else if (jsonData.interfaceLanguages?.swift?.[0]?.title) {
    frontMatter.title = jsonData.interfaceLanguages.swift[0].title
  }

  if (jsonData.abstract && Array.isArray(jsonData.abstract)) {
    const description = jsonData.abstract
      .filter((item) => item.type === "text")
      .map((item) => item.text)
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
 * Generate breadcrumb navigation
 */
function generateBreadcrumbs(sourceUrl: string, externalOrigin?: string): string {
  const url = new URL(sourceUrl)
  const pathParts = url.pathname.split("/").filter(Boolean)
  const documentationIndex = pathParts.indexOf("documentation")

  if (documentationIndex === -1 || pathParts.length <= documentationIndex + 2) {
    return ""
  }

  const framework = pathParts[documentationIndex + 1]
  let breadcrumbs = `**Navigation:** [${framework.charAt(0).toUpperCase() + framework.slice(1)}](${rewriteDocumentationPath(
    `/documentation/${framework}`,
    externalOrigin,
  )})`

  if (pathParts.length > documentationIndex + 2) {
    // Add intermediate breadcrumbs if needed
    for (let i = documentationIndex + 2; i < pathParts.length - 1; i++) {
      const part = pathParts[i]
      const path = pathParts.slice(documentationIndex, i + 1).join("/")
      breadcrumbs += ` › [${part}](${rewriteDocumentationPath(`/${path}`, externalOrigin)})`
    }
  }

  return `${breadcrumbs}\n\n`
}

/**
 * Render declaration sections
 */
function renderDeclarations(declarations: Array<{ tokens?: Array<{ text?: string }> }>): string {
  let markdown = ""

  for (const decl of declarations) {
    if (decl.tokens) {
      // Simply concatenate the tokens as Apple has them formatted
      const code = decl.tokens
        .filter((token) => token != null)
        .map((token) => token.text || "")
        .join("")
        .trim()

      markdown += `\`\`\`swift\n${code}\n\`\`\`\n\n`
    }
  }

  return markdown
}

/**
 * Render parameters section
 */
function renderParameters(
  parameters: Array<{ name: string; content?: ContentItem[] }>,
  references?: Record<string, ContentItem>,
  externalOrigin?: string,
): string {
  if (parameters.length === 0) return ""

  let markdown = "## Parameters\n\n"

  for (const param of parameters) {
    markdown += `**${param.name}**\n\n`
    if (param.content && Array.isArray(param.content)) {
      const paramText = renderContentArray(param.content, references, 0, externalOrigin)
      markdown += `${paramText}\n\n`
    }
  }

  return markdown
}

/**
 * Render main content sections
 */
function renderContent(
  content: ContentItem[],
  references?: Record<string, ContentItem>,
  externalOrigin?: string,
): string {
  return renderContentArray(content, references, 0, externalOrigin)
}

/**
 * Render content array to markdown
 */
function renderContentArray(
  content: ContentItem[],
  references?: Record<string, ContentItem>,
  depth: number = 0,
  externalOrigin?: string,
): string {
  // Prevent infinite recursion by limiting depth
  if (depth > 50) {
    console.warn("Maximum recursion depth reached in renderContentArray")
    return "[Content too deeply nested]"
  }

  let markdown = ""

  for (const item of content) {
    if (item.type === "heading") {
      const level = Math.min(item.level || 2, 6)
      const hashes = "#".repeat(level)
      markdown += `${hashes} ${item.text}\n\n`
    } else if (item.type === "paragraph") {
      if (item.inlineContent) {
        const text = renderInlineContent(item.inlineContent, references, depth, externalOrigin)
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
    } else if (item.type === "unorderedList") {
      if (item.items) {
        for (const listItem of item.items) {
          const itemText = renderContentArray(
            listItem.content || [],
            references,
            depth + 1,
            externalOrigin,
          )
          markdown += `- ${itemText.replace(/\n\n$/, "")}\n`
        }
        markdown += "\n"
      }
    } else if (item.type === "orderedList") {
      if (item.items) {
        item.items.forEach((listItem: ContentItem, index: number) => {
          const itemText = renderContentArray(
            listItem.content || [],
            references,
            depth + 1,
            externalOrigin,
          )
          markdown += `${index + 1}. ${itemText.replace(/\n\n$/, "")}\n`
        })
        markdown += "\n"
      }
    } else if (item.type === "aside") {
      const style = item.style || "note"
      const calloutType = mapAsideStyleToCallout(style)
      const asideContent = item.content
        ? renderContentArray(item.content, references, depth + 1, externalOrigin)
        : ""
      const cleanContent = asideContent.trim().replace(/\n/g, "\n> ")
      markdown += `> [!${calloutType}]\n> ${cleanContent}\n\n`
    } else if (item.type === "table") {
      markdown += renderTable(item, references, depth, externalOrigin)
    }
  }

  return markdown
}

/**
 * Render a table content item to markdown.
 * Apple's JSON uses header: "row" (first row is header) and rows where each cell is ContentItem[].
 */
function renderTable(
  item: ContentItem,
  references?: Record<string, ContentItem>,
  depth: number = 0,
  externalOrigin?: string,
): string {
  const table = item as ContentItem & {
    header?: string
    rows?: ContentItem[][][] // rows[rowIndex][cellIndex] = ContentItem[]
  }
  const rows = table.rows ?? []
  if (rows.length === 0) return ""

  const escapeCell = (s: string) => s.replace(/\|/g, "\\|").replace(/\n/g, " ").trim()
  const renderCell = (cell: ContentItem | ContentItem[]) => {
    const items = Array.isArray(cell) ? cell : [cell]
    const s = renderContentArray(items, references, depth + 1, externalOrigin)
    return escapeCell(s)
  }

  const firstRowIsHeader = table.header === "row"
  let markdown = ""
  rows.forEach((row, rowIndex) => {
    const cells = row.map((c) => renderCell(c))
    if (cells.length === 0) return
    markdown += `| ${cells.join(" | ")} |\n`
    if (firstRowIsHeader && rowIndex === 0) {
      markdown += `| ${cells.map(() => "---").join(" | ")} |\n`
    }
  })
  return markdown ? `${markdown}\n` : ""
}

/**
 * Render inline content to markdown
 */
function renderInlineContent(
  inlineContent: ContentItem[],
  references?: Record<string, ContentItem>,
  depth: number = 0,
  externalOrigin?: string,
): string {
  // Prevent infinite recursion by limiting depth
  if (depth > 20) {
    console.warn("Maximum recursion depth reached in renderInlineContent")
    return "[Inline content too deeply nested]"
  }

  return inlineContent
    .map((item) => {
      if (item.type === "text") {
        return item.text
      } else if (item.type === "codeVoice") {
        return `\`${item.code}\``
      } else if (item.type === "reference") {
        const title =
          item.title ||
          item.text ||
          (item.identifier ? extractTitleFromIdentifier(item.identifier) : "")
        const url = item.identifier
          ? convertIdentifierToURL(item.identifier, references, externalOrigin)
          : ""
        return `[${title}](${url})`
      } else if (item.type === "emphasis") {
        return `*${item.inlineContent ? renderInlineContent(item.inlineContent, references, depth + 1, externalOrigin) : ""}*`
      } else if (item.type === "strong") {
        return `**${item.inlineContent ? renderInlineContent(item.inlineContent, references, depth + 1, externalOrigin) : ""}**`
      } else if (item.type === "image" && item.identifier) {
        const ref = references?.[item.identifier] as
          | (ContentItem & { variants?: Array<{ url: string }>; alt?: string })
          | undefined
        const url = ref?.variants?.[0]?.url
        const alt = ref?.alt ?? ""
        return url ? `![${alt}](${url})` : ""
      }
      return item.text || ""
    })
    .join("")
}

/**
 * Render relationship sections
 */
function renderRelationships(
  relationships: ContentItem[],
  variants?: Variant[],
  references?: Record<string, ContentItem>,
  externalOrigin?: string,
): string {
  let markdown = ""

  for (const rel of relationships) {
    if (rel.title && rel.identifiers) {
      markdown += `## ${rel.title}\n\n`
      for (const id of rel.identifiers) {
        const info = variants?.find((v: Variant) => v.identifier === id)
        const reference = references?.[id]
        const title = info?.title || reference?.title || extractTitleFromIdentifier(id)
        const url = convertIdentifierToURL(id, references, externalOrigin)
        markdown += `- [${title}](${url})\n`
      }
      markdown += "\n"
    }
  }

  return markdown
}

/**
 * Render topic sections
 */
function renderTopicSections(
  topics: TopicSection[],
  variants?: Variant[],
  references?: Record<string, ContentItem>,
  externalOrigin?: string,
): string {
  let markdown = ""

  for (const topic of topics) {
    if (topic.title) {
      markdown += `## ${topic.title}\n\n`

      if (topic.identifiers) {
        for (const id of topic.identifiers) {
          const info = variants?.find((v: Variant) => v.identifier === id)
          const reference = references?.[id]
          if (info || reference) {
            const title = info?.title || reference?.title || extractTitleFromIdentifier(id)
            const url = convertIdentifierToURL(id, references, externalOrigin)
            const abstract = info?.abstract
              ? info.abstract.map((a: { text: string }) => a.text).join("")
              : reference?.abstract
                ? reference.abstract.map((a: { text: string }) => a.text).join("")
                : ""

            markdown += `- [${title}](${url})`
            if (abstract) {
              markdown += ` ${abstract}`
            }
            markdown += "\n"
          } else {
            const title = extractTitleFromIdentifier(id)
            const url = convertIdentifierToURL(id, references, externalOrigin)
            markdown += `- [${title}](${url})\n`
          }
        }
        markdown += "\n"
      }
    }
  }

  return markdown
}

/**
 * Render index content for framework pages
 */
function renderIndexContent(children: IndexContentItem[], externalOrigin?: string): string {
  return renderIndexContentWithIndent(children, 2, externalOrigin)
}

/**
 * Render index content with proper indentation and spacing
 */
function renderIndexContentWithIndent(
  children: IndexContentItem[],
  headingLevel: number,
  externalOrigin?: string,
): string {
  let markdown = ""

  for (let i = 0; i < children.length; i++) {
    const child = children[i]

    if (child.type === "groupMarker") {
      // Add spacing before group markers (except the first one)
      if (i > 0) {
        markdown += "\n"
      }

      // Group markers are headings at the current level
      const hashes = "#".repeat(Math.min(headingLevel, 6))
      markdown += `${hashes} ${child.title}\n\n`
    } else if (child.path && child.title) {
      const beta = child.beta ? " **Beta**" : ""

      // List items are always unindented under their heading
      const rewrittenPath = rewriteDocumentationPath(child.path, externalOrigin)
      markdown += `- [${child.title}](${rewrittenPath})${beta}\n`

      if (child.children) {
        // Add spacing before nested content
        markdown += "\n"
        // Nested content gets a deeper heading level
        const nestedContent = renderIndexContentWithIndent(
          child.children,
          headingLevel + 1,
          externalOrigin,
        )
        markdown += nestedContent
      }
    }
  }

  return markdown
}

/**
 * Render see also sections
 */
function renderSeeAlso(
  seeAlso: Array<{ title: string; identifiers?: string[] }>,
  variants?: Variant[],
  references?: Record<string, ContentItem>,
  externalOrigin?: string,
): string {
  let markdown = ""

  for (const section of seeAlso) {
    if (section.title && section.identifiers) {
      markdown += `## ${section.title}\n\n`
      for (const id of section.identifiers) {
        const info = variants?.find((v: Variant) => v.identifier === id)
        const reference = references?.[id]
        const title = info?.title || reference?.title || extractTitleFromIdentifier(id)
        const url = convertIdentifierToURL(id, references, externalOrigin)
        markdown += `- [${title}](${url})\n`
      }
      markdown += "\n"
    }
  }

  return markdown
}

/**
 * Map aside style to GitHub-style callout
 */
function mapAsideStyleToCallout(style: string): string {
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

/**
 * Convert doc:// identifier to sosumi.ai URL
 */
function convertIdentifierToURL(
  identifier: string,
  references?: Record<string, ContentItem>,
  externalOrigin?: string,
): string {
  // Check if we have a reference with a URL for this identifier
  const reference = references?.[identifier]
  if (reference?.url) {
    return rewriteDocumentationPath(reference.url, externalOrigin)
  }

  if (identifier.startsWith("doc://com.apple.SwiftUI/documentation/")) {
    const path = identifier.replace("doc://com.apple.SwiftUI/documentation/", "/documentation/")
    return rewriteDocumentationPath(path, externalOrigin)
  } else if (identifier.startsWith("doc://com.apple.")) {
    // Handle other Apple docs
    const matches = identifier.match(/\/documentation\/(.+)/)
    if (matches) {
      return rewriteDocumentationPath(`/documentation/${matches[1]}`, externalOrigin)
    }
  } else if (identifier.startsWith("doc://")) {
    const matches = identifier.match(/\/documentation\/(.+)/)
    if (matches) {
      return rewriteDocumentationPath(`/documentation/${matches[1]}`, externalOrigin)
    }
  }
  return identifier
}

function rewriteDocumentationPath(path: string | undefined, externalOrigin?: string): string {
  if (!path) {
    return ""
  }

  if (!externalOrigin || !path.startsWith("/documentation/")) {
    return path
  }

  return `/external/${externalOrigin}${path}`
}

/**
 * Extract title from identifier
 */
export function extractTitleFromIdentifier(identifier: string): string {
  const parts = identifier.split("/")
  const lastPart = parts[parts.length - 1]

  // Handle disambiguation suffixes (e.g., "body-8kl5o" -> "body", "init(exactly:)-63925" -> "init(exactly:)")
  const disambiguationMatch = lastPart.match(/^(.+?)(?:-\w+)?$/)
  if (disambiguationMatch) {
    const baseName = disambiguationMatch[1]

    // If it looks like a method signature (contains parentheses), preserve it
    if (baseName.includes("(") && baseName.includes(")")) {
      return baseName
    }

    // For simple identifiers, convert camelCase to readable format
    return baseName
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .replace(/\s+/g, " ")
      .trim()
  }

  // Fallback: convert camelCase to readable format
  return lastPart
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim()
}

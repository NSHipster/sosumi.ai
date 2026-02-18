/**
 * Human Interface Guidelines (HIG) specific types
 */

import type { ContentItem, PrimaryContentSection, TextFragment } from "../types"

// ============================================================================
// HIG TYPES
// ============================================================================

/**
 * Represents an icon reference in the HIG ToC
 */
export interface HIGIconReference {
  alt: string
  identifier: string
  type: "image"
  variants: Array<{
    traits: string[]
    url: string
  }>
}

/**
 * Represents an item in the HIG table of contents
 */
export interface HIGTocItem {
  children?: HIGTocItem[]
  icon?: string
  path: string
  title: string
  type: "module" | "symbol" | "article"
}

/**
 * Represents the complete HIG table of contents structure
 */
export interface HIGTableOfContents {
  includedArchiveIdentifiers: string[]
  interfaceLanguages: {
    swift: HIGTocItem[]
  }
  references: Record<string, HIGIconReference>
  schemaVersion: {
    major: number
    minor: number
    patch: number
  }
}

/**
 * HIG-specific image metadata with card/icon types
 */
export interface HIGImage {
  identifier: string
  type: "icon" | "card" | "image"
}

/**
 * HIG page metadata with locale and image support
 */
export interface HIGMetadata {
  role: string
  title: string
  images?: HIGImage[]
  availableLocales?: string[]
}

/**
 * HIG-specific identifier with interface language
 */
export interface HIGIdentifier {
  interfaceLanguage: string
  url: string
}

/**
 * HIG hierarchy information
 */
export interface HIGHierarchy {
  paths: string[][]
}

/**
 * HIG topic section structure
 */
export interface HIGTopicSection {
  title?: string
  identifiers: string[]
  anchor?: string
}

/**
 * HIG image variant with resolution and color mode support
 */
export interface HIGImageVariant {
  traits: string[]
  url: string
}

/**
 * HIG image reference with variants
 */
export interface HIGImageReference {
  alt: string | null
  identifier: string
  type: "icon" | "card" | "image"
  variants: HIGImageVariant[]
}

/**
 * HIG reference item (for linked articles and topics)
 */
export interface HIGReference {
  kind: string
  role?: string
  title: string
  url: string
  abstract?: TextFragment[]
  identifier: string
  images?: HIGImage[]
  type: "topic"
}

/**
 * External/non-topic reference appearing in HIG references map
 */
export interface HIGExternalReference {
  title: string
  identifier: string
  titleInlineContent?: TextFragment[]
  url: string
  type: string // e.g. "link"
}

/**
 * HIG legal notices
 */
export interface HIGLegalNotices {
  copyright: string
  termsOfUse: string
  privacy?: string
  privacyPolicy?: string
}

/**
 * The main HIG page JSON structure
 */
export interface HIGPageJSON {
  // Metadata and identification
  metadata: HIGMetadata
  kind: "article"
  identifier: HIGIdentifier
  hierarchy: HIGHierarchy

  // Content sections
  sections: ContentItem[]
  primaryContentSections: PrimaryContentSection[]
  abstract: TextFragment[]

  // Topic organization
  topicSections?: HIGTopicSection[]
  topicSectionsStyle?: "hidden" | "list" | "compactGrid"

  // References to other content and images
  references: Record<string, HIGReference | HIGImageReference | HIGExternalReference>

  // Schema version
  schemaVersion: {
    major: number
    minor: number
    patch: number
  }

  // Legal information
  legalNotices?: HIGLegalNotices
}

// ============================================================================
// TYPE GUARDS
// ============================================================================

/**
 * Type guard to check if a reference is an image reference
 */
export function isHIGImageReference(
  ref: HIGReference | HIGImageReference | HIGExternalReference,
): ref is HIGImageReference {
  return "alt" in ref && "variants" in ref
}

/**
 * Type guard to check if a reference is a topic reference
 */
export function isHIGTopicReference(
  ref: HIGReference | HIGImageReference | HIGExternalReference,
): ref is HIGReference {
  return ref.type === "topic"
}

/**
 * Type guard to check if a ToC item has children
 */
export function hasChildren(item: HIGTocItem): boolean {
  return item.children !== undefined && item.children.length > 0
}

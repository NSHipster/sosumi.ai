/**
 * Type definitions for Apple Developer documentation JSON API
 *
 * This module consolidates all types used across the codebase for processing
 * Apple documentation. Types are organized by category and complexity.
 */

// ============================================================================
// CORE CONTENT TYPES
// ============================================================================

/**
 * Represents a text fragment with optional styling information
 */
export interface TextFragment {
  text: string
  type?: string
}

/**
 * Represents a code fragment with syntax highlighting
 */
export interface CodeFragment {
  code: string | string[]
  syntax?: string
}

/**
 * Represents a tokenized piece of content
 */
export interface Token {
  text?: string
}

/**
 * The main content item type used throughout the documentation structure.
 * Can represent text, code, lists, headings, and other content elements.
 */
export interface ContentItem {
  // Basic content properties
  text?: string
  type?: string
  title?: string
  name?: string

  // Tokenized content
  tokens?: Token[]

  // Nested content
  content?: ContentItem[]
  inlineContent?: ContentItem[]
  items?: ContentItem[]

  // Code content
  code?: string | string[]
  syntax?: string

  // Structural properties
  level?: number
  style?: string
  identifier?: string
  identifiers?: string[]
  url?: string

  // Abstract content
  abstract?: TextFragment[]
}

// ============================================================================
// DECLARATION & PARAMETER TYPES
// ============================================================================

/**
 * Represents a code declaration with tokenized content
 */
export interface Declaration {
  tokens?: Token[]
}

/**
 * Represents a function or method parameter
 */
export interface Parameter {
  name: string
  content?: ContentItem[]
}

// ============================================================================
// SECTION TYPES
// ============================================================================

/**
 * Represents a topic section in the documentation
 */
export interface TopicSection {
  title: string
  identifiers?: string[]
  children?: TopicSection[]
  abstract?: ContentItem[]
  anchor?: string
}

/**
 * Represents a "see also" section with related identifiers
 */
export interface SeeAlsoSection {
  title: string
  identifiers?: string[]
}

/**
 * Represents a primary content section with specific kind and content
 */
export interface PrimaryContentSection {
  kind: string
  content?: ContentItem[]
  declarations?: Declaration[]
  parameters?: Parameter[]
  items?: PropertyItem[]
}

/**
 * Represents a property item used in data dictionary pages.
 */
export interface PropertyItem {
  name: string
  required?: boolean
  content?: ContentItem[]
  type?: Array<{
    text?: string
    kind?: string
    identifier?: string
  }>
  attributes?: Array<{
    kind?: string
    values?: string[]
  }>
}

// ============================================================================
// VARIANT TYPES
// ============================================================================

/**
 * Common properties shared across all variant types
 */
interface BaseVariant {
  title?: string
  abstract?: TextFragment[]
  identifier?: string
  type?: string
  role?: string
  kind?: string
}

/**
 * Represents a language-specific variant of documentation
 */
export interface LanguageVariant extends BaseVariant {
  traits: Array<{ interfaceLanguage: string }>
  paths: string[]
}

/**
 * Represents an image variant with URL and traits
 */
export interface ImageVariant extends BaseVariant {
  url: string
  traits: string[]
}

/**
 * Represents a symbol variant with detailed metadata
 */
export interface SymbolVariant extends BaseVariant {
  url?: string
  fragments?: Array<{
    kind: string
    text?: string
    preciseIdentifier?: string
  }>
  conformance?: {
    constraints?: Array<{
      code?: string
      type: string
      text?: string
    }>
    conformancePrefix?: Array<{
      text: string
      type: string
    }>
    availabilityPrefix?: Array<{
      type: string
      text: string
    }>
  }
}

/**
 * Union type representing any variant type
 */
export type Variant = LanguageVariant | ImageVariant | SymbolVariant

// ============================================================================
// INTERFACE & INDEX TYPES
// ============================================================================

/**
 * Represents a Swift interface item in the documentation index
 */
export interface SwiftInterfaceItem {
  path: string
  title: string
  type: string
  children?: SwiftInterfaceItem[]
  external?: boolean
  beta?: boolean
}

/**
 * Represents an item in the documentation index
 */
export interface IndexContentItem {
  type?: string
  title?: string
  path?: string
  beta?: boolean
  children?: IndexContentItem[]
}

// ============================================================================
// METADATA TYPES
// ============================================================================

/**
 * Platform information for documentation
 */
export interface Platform {
  name: string
  introducedAt: string
  beta?: boolean
}

/**
 * Documentation metadata
 */
export interface DocumentationMetadata {
  title?: string
  platforms?: Platform[]
  roleHeading?: string
  symbolKind?: string
}

/**
 * Documentation identifier with URL and language
 */
export interface DocumentationIdentifier {
  url: string
  interfaceLanguage?: string
}

// ============================================================================
// MAIN DOCUMENTATION STRUCTURE
// ============================================================================

/**
 * The main Apple documentation JSON structure.
 * This is the root type for all Apple documentation responses.
 */
export interface AppleDocJSON {
  // Metadata
  metadata?: DocumentationMetadata
  kind?: string
  identifier?: DocumentationIdentifier

  // Content
  abstract?: Array<{ text: string; type: string }>
  sections?: ContentItem[]

  // Primary content sections
  primaryContentSections?: PrimaryContentSection[]

  // Topic sections
  topicSections?: TopicSection[]
  seeAlsoSections?: SeeAlsoSection[]

  // Variants and relationships
  variants?: Variant[]
  relationshipsSections?: ContentItem[]

  // References
  references?: Record<string, ContentItem>

  // Index-specific fields
  interfaceLanguages?: {
    swift?: SwiftInterfaceItem[]
  }
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

/**
 * Type guard to check if a variant is a language variant
 */
export function isLanguageVariant(variant: Variant): variant is LanguageVariant {
  return (
    "traits" in variant &&
    Array.isArray(variant.traits) &&
    variant.traits.length > 0 &&
    typeof variant.traits[0] === "object" &&
    "interfaceLanguage" in variant.traits[0]
  )
}

/**
 * Type guard to check if a variant is an image variant
 */
export function isImageVariant(variant: Variant): variant is ImageVariant {
  return (
    "url" in variant &&
    "traits" in variant &&
    Array.isArray(variant.traits) &&
    typeof variant.traits[0] === "string"
  )
}

/**
 * Type guard to check if a variant is a symbol variant
 */
export function isSymbolVariant(variant: Variant): variant is SymbolVariant {
  return "fragments" in variant || "conformance" in variant
}

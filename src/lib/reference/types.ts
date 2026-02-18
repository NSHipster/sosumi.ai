/**
 * Apple Developer Reference documentation specific types
 */

// Most types used by reference docs are already in the shared types.ts
// This file is for reference-specific types only, if any are needed in the future

// Re-export commonly used types from shared types for convenience
export type {
  AppleDocJSON,
  ContentItem,
  Declaration,
  DocumentationIdentifier,
  DocumentationMetadata,
  ImageVariant,
  IndexContentItem,
  isImageVariant,
  isLanguageVariant,
  isSymbolVariant,
  LanguageVariant,
  Parameter,
  Platform,
  PrimaryContentSection,
  SeeAlsoSection,
  SwiftInterfaceItem,
  SymbolVariant,
  TextFragment,
  TopicSection,
  Variant,
} from "../types"

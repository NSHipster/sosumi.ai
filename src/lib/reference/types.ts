/**
 * Apple Developer Reference documentation specific types
 */

// Most types used by reference docs are already in the shared types.ts
// This file is for reference-specific types only, if any are needed in the future

// Re-export commonly used types from shared types for convenience
export type {
  AppleDocJSON,
  ContentItem,
  TextFragment,
  Declaration,
  Parameter,
  TopicSection,
  SeeAlsoSection,
  PrimaryContentSection,
  Variant,
  LanguageVariant,
  ImageVariant,
  SymbolVariant,
  SwiftInterfaceItem,
  IndexContentItem,
  Platform,
  DocumentationMetadata,
  DocumentationIdentifier,
  isLanguageVariant,
  isImageVariant,
  isSymbolVariant,
} from "../types"

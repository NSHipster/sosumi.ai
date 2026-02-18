import type { HIGExternalReference, HIGImageReference, HIGReference, HIGTocItem } from "./types"

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

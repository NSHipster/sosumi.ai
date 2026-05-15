/**
 * DocC variant overrides — applies RFC 6902 JSON Patch documents shipped in
 * `variantOverrides` so language-specific (Objective-C) variants render the
 * correct declarations, references, and section ordering.
 *
 * Apple's DocC JSON ships the Swift payload at the top level even when the
 * upstream request includes `?language=objc`. The Objective-C content lives
 * inside `variantOverrides[*].patch`, keyed by `traits[].interfaceLanguage`
 * (`"occ"` for Objective-C). The Apple web client applies these patches
 * client-side; we do the same here.
 */

import type { AppleDocJSON, JsonPatchOperation, VariantOverride } from "../types"

/**
 * Map a user-facing language code (as accepted by the public API) to the
 * `interfaceLanguage` trait Apple uses in `variantOverrides`.
 */
const TRAIT_BY_LANGUAGE: Record<string, string> = {
  swift: "swift",
  objc: "occ",
}

/**
 * Apply the variant override matching `language` to `jsonData`, returning a
 * new object. Returns the input unchanged when no language is given, no
 * override matches, or `variantOverrides` is empty/missing.
 */
export function applyVariantOverrides(jsonData: AppleDocJSON, language?: string): AppleDocJSON {
  if (!language) return jsonData
  const trait = TRAIT_BY_LANGUAGE[language]
  if (!trait) return jsonData
  if (!jsonData.variantOverrides?.length) return jsonData

  const override = jsonData.variantOverrides.find((v: VariantOverride) =>
    v.traits?.some((t) => t.interfaceLanguage === trait),
  )
  if (!override?.patch?.length) return jsonData

  // Deep clone so we don't mutate the caller's object. structuredClone is
  // available in Workers, Node 17+, and modern browsers.
  const patched = structuredClone(jsonData) as AppleDocJSON
  for (const op of override.patch) {
    applyOperation(patched, op)
  }
  return patched
}

/**
 * Apply a single JSON Patch operation in place. Supports the `add`, `remove`,
 * and `replace` operations — the only ones observed in DocC payloads. Unknown
 * ops and unreachable paths are skipped silently to match the browser's
 * tolerant behavior on malformed patches.
 */
function applyOperation(doc: unknown, op: JsonPatchOperation): void {
  const tokens = parsePointer(op.path)
  if (tokens === null) return

  // Root replacement is unsupported here — DocC patches never target the root.
  if (tokens.length === 0) return

  const parentTokens = tokens.slice(0, -1)
  const key = tokens[tokens.length - 1]
  const parent = resolvePointer(doc, parentTokens)
  if (parent === undefined || parent === null) return

  if (Array.isArray(parent)) {
    const index = key === "-" ? parent.length : Number(key)
    if (!Number.isInteger(index) || index < 0) return

    switch (op.op) {
      case "add":
        if (index > parent.length) return
        parent.splice(index, 0, op.value)
        return
      case "remove":
        if (index >= parent.length) return
        parent.splice(index, 1)
        return
      case "replace":
        if (index >= parent.length) return
        parent[index] = op.value
        return
    }
    return
  }

  if (typeof parent === "object") {
    const obj = parent as Record<string, unknown>
    switch (op.op) {
      case "add":
      case "replace":
        obj[key] = op.value
        return
      case "remove":
        delete obj[key]
        return
    }
  }
}

/**
 * Parse a JSON Pointer (RFC 6901). Returns null when the pointer is not a
 * string or does not start with `/` (RFC 6901 requires either an empty string
 * or a leading `/`).
 */
function parsePointer(pointer: string): string[] | null {
  if (typeof pointer !== "string") return null
  if (pointer === "") return []
  if (!pointer.startsWith("/")) return null
  return pointer
    .substring(1)
    .split("/")
    .map((token) => token.replace(/~1/g, "/").replace(/~0/g, "~"))
}

/**
 * Walk `doc` along the given pointer tokens. Returns the resolved node or
 * `undefined` if any segment is missing.
 */
function resolvePointer(doc: unknown, tokens: string[]): unknown {
  let current: unknown = doc
  for (const token of tokens) {
    if (current === null || current === undefined) return undefined
    if (Array.isArray(current)) {
      const index = token === "-" ? current.length : Number(token)
      if (!Number.isInteger(index) || index < 0 || index >= current.length) return undefined
      current = current[index]
    } else if (typeof current === "object") {
      current = (current as Record<string, unknown>)[token]
    } else {
      return undefined
    }
  }
  return current
}

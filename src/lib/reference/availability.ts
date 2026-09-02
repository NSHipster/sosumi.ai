/**
 * Deployment target awareness for Apple DocC availability metadata.
 *
 * Apple's DocC JSON is always a snapshot of the current SDK.
 * It carries no historical revision of a page,
 * so "show me this page as it read on macOS 14.5" is not answerable from this data.
 * What every symbol does carry is per-platform availability
 * (`introducedAt`, `deprecatedAt`, `beta`, `unavailable`),
 * which is enough to answer the question agents actually need:
 * does this symbol exist on the platform and version I am targeting?
 */

import type { Platform } from "./types"

/** A platform, and optionally an OS version, that a caller is building against. */
export interface DeploymentTarget {
  /** Canonical Apple platform name, for example `"macOS"`. */
  platform: string
  /** Dotted version string, for example `"14.5"`. Absent means the latest SDK. */
  version?: string
}

export type AvailabilityStatus =
  /** The symbol exists on the target. */
  | "available"
  /** The symbol exists but is deprecated as of the target. */
  | "deprecated"
  /** The symbol was introduced after the target. */
  | "unintroduced"
  /** The symbol is not offered on the target platform at all. */
  | "unavailable"
  /** The page carries no platform metadata, as with articles and collections. */
  | "unknown"

export interface AvailabilityVerdict {
  status: AvailabilityStatus
  /** Human-readable explanation, rendered in parentheses after the target. */
  detail: string
}

/** Platform names as Apple spells them in DocC `metadata.platforms`. */
export const SUPPORTED_PLATFORM_NAMES = [
  "iOS",
  "iPadOS",
  "Mac Catalyst",
  "macOS",
  "tvOS",
  "visionOS",
  "watchOS",
] as const

/** Spellings callers are likely to use, mapped to Apple's own. */
const PLATFORM_ALIASES = new Map<string, string>([
  ["ios", "iOS"],
  ["iphoneos", "iOS"],
  ["ipados", "iPadOS"],
  ["maccatalyst", "Mac Catalyst"],
  ["mac catalyst", "Mac Catalyst"],
  ["catalyst", "Mac Catalyst"],
  ["macos", "macOS"],
  ["osx", "macOS"],
  ["mac os x", "macOS"],
  ["tvos", "tvOS"],
  ["visionos", "visionOS"],
  ["xros", "visionOS"],
  ["watchos", "watchOS"],
])

const VERSION_PATTERN = /^\d+(\.\d+)*$/

export const UNSUPPORTED_DEPLOYMENT_TARGET_MESSAGE =
  `Unsupported platform or version. ` +
  `Supported platforms: ${SUPPORTED_PLATFORM_NAMES.join(", ")}. ` +
  `Versions are dotted numbers, for example 14.5.`

/**
 * Compare two dotted version strings.
 * Missing components count as zero, so `26` and `26.0` are equal.
 */
export function compareVersions(a: string, b: string): number {
  const left = a.split(".")
  const right = b.split(".")
  const length = Math.max(left.length, right.length)

  for (let index = 0; index < length; index += 1) {
    const leftPart = Number.parseInt(left[index] ?? "0", 10) || 0
    const rightPart = Number.parseInt(right[index] ?? "0", 10) || 0
    if (leftPart !== rightPart) {
      return leftPart < rightPart ? -1 : 1
    }
  }

  return 0
}

/**
 * Resolve a caller-supplied platform and version into a deployment target.
 * Returns `null` when the platform is not one Apple documents,
 * or when the version is not a dotted number.
 */
export function parseDeploymentTarget(
  platform?: string | null,
  osVersion?: string | null,
): DeploymentTarget | null {
  const name = platform?.trim()
  if (!name) {
    return null
  }

  const canonical = PLATFORM_ALIASES.get(name.toLowerCase())
  if (!canonical) {
    return null
  }

  const version = osVersion?.trim()
  if (!version) {
    return { platform: canonical }
  }

  if (!VERSION_PATTERN.test(version)) {
    return null
  }

  return { platform: canonical, version }
}

/**
 * Format one platform's availability for the page header.
 * Deprecated APIs get a closed range so the window is visible at a glance,
 * rather than only in the deprecation callout further down.
 */
export function formatPlatformAvailability(platform: Platform): string {
  if (platform.unavailable) {
    return `${platform.name} (unavailable)`
  }

  const introducedAt = platform.introducedAt?.trim()
  if (platform.deprecatedAt) {
    const range = introducedAt ? `${introducedAt}-${platform.deprecatedAt}` : platform.deprecatedAt
    return `${platform.name} ${range} (deprecated)`
  }

  const base = introducedAt ? `${platform.name} ${introducedAt}+` : platform.name
  if (platform.deprecated) {
    return `${base} (deprecated)`
  }

  return platform.beta ? `${base} Beta` : base
}

/**
 * Decide whether a page's symbol is usable on the requested deployment target.
 */
export function evaluateAvailability(
  platforms: Platform[] | undefined,
  target: DeploymentTarget,
): AvailabilityVerdict {
  if (!platforms?.length) {
    return {
      status: "unknown",
      detail: "no platform availability information on this page",
    }
  }

  const match = platforms.find(
    (platform) => platform.name.toLowerCase() === target.platform.toLowerCase(),
  )
  if (!match || match.unavailable) {
    return { status: "unavailable", detail: `not available on ${target.platform}` }
  }

  const introducedAt = match.introducedAt?.trim()
  if (target.version && introducedAt && compareVersions(target.version, introducedAt) < 0) {
    return {
      status: "unintroduced",
      detail: `not available; introduced in ${match.name} ${introducedAt}`,
    }
  }

  // Without a requested version the caller is asking about the latest SDK,
  // where any recorded deprecation already applies.
  if (match.deprecatedAt) {
    if (!target.version || compareVersions(target.version, match.deprecatedAt) >= 0) {
      return {
        status: "deprecated",
        detail: `deprecated as of ${match.name} ${match.deprecatedAt}`,
      }
    }
  } else if (match.deprecated) {
    return { status: "deprecated", detail: `deprecated on ${match.name}` }
  }

  const since = introducedAt ? `available since ${match.name} ${introducedAt}` : "available"
  return { status: "available", detail: match.beta ? `${since}, beta` : since }
}

/** Render the deployment target line that precedes a page's body. */
export function formatDeploymentTargetLine(
  platforms: Platform[] | undefined,
  target: DeploymentTarget,
): string {
  const label = target.version ? `${target.platform} ${target.version}` : target.platform
  const { detail } = evaluateAvailability(platforms, target)
  return `**Deployment target:** ${label} (${detail})`
}

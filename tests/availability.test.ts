/** biome-ignore-all lint/suspicious/noExplicitAny: pedantic type check */
import { SELF } from "cloudflare:test"
import { describe, expect, it } from "vitest"
import {
  compareVersions,
  evaluateAvailability,
  formatPlatformAvailability,
  parseDeploymentTarget,
  renderFromJSON,
  SUPPORTED_PLATFORM_NAMES,
} from "../src/lib/reference"

describe("compareVersions", () => {
  it("orders dotted versions numerically", () => {
    expect(compareVersions("14.5", "14.0")).toBeGreaterThan(0)
    expect(compareVersions("9.0", "10.0")).toBeLessThan(0)
    expect(compareVersions("14.0", "14.0")).toBe(0)
  })

  it("treats missing components as zero", () => {
    expect(compareVersions("26", "26.0")).toBe(0)
    expect(compareVersions("26.0.1", "26")).toBeGreaterThan(0)
  })
})

describe("parseDeploymentTarget", () => {
  it("canonicalizes platform names case-insensitively", () => {
    expect(parseDeploymentTarget("macos", "14.5")).toEqual({
      platform: "macOS",
      version: "14.5",
    })
    expect(parseDeploymentTarget("IOS", "17")).toEqual({ platform: "iOS", version: "17" })
    expect(parseDeploymentTarget("mac catalyst", undefined)).toEqual({
      platform: "Mac Catalyst",
    })
  })

  it("returns null for unsupported platforms", () => {
    expect(parseDeploymentTarget("windows", "11")).toBeNull()
    expect(parseDeploymentTarget("", "14.5")).toBeNull()
  })

  it("returns null for malformed versions", () => {
    expect(parseDeploymentTarget("macOS", "sonoma")).toBeNull()
    expect(parseDeploymentTarget("macOS", "14.x")).toBeNull()
  })

  it("exposes the supported platform names", () => {
    expect(SUPPORTED_PLATFORM_NAMES).toContain("macOS")
    expect(SUPPORTED_PLATFORM_NAMES).toContain("visionOS")
  })
})

describe("formatPlatformAvailability", () => {
  it("renders an open-ended range for current APIs", () => {
    expect(formatPlatformAvailability({ name: "macOS", introducedAt: "14.0" })).toBe("macOS 14.0+")
  })

  it("keeps the beta marker", () => {
    expect(formatPlatformAvailability({ name: "macOS", introducedAt: "27.0", beta: true })).toBe(
      "macOS 27.0+ Beta",
    )
  })

  it("renders a closed range when the API is deprecated", () => {
    expect(
      formatPlatformAvailability({ name: "macOS", introducedAt: "10.0", deprecatedAt: "27.0" }),
    ).toBe("macOS 10.0-27.0 (deprecated)")
  })

  it("marks deprecation without a version", () => {
    expect(formatPlatformAvailability({ name: "iOS", introducedAt: "2.0", deprecated: true })).toBe(
      "iOS 2.0+ (deprecated)",
    )
  })

  it("marks unavailable platforms", () => {
    expect(formatPlatformAvailability({ name: "tvOS", introducedAt: "", unavailable: true })).toBe(
      "tvOS (unavailable)",
    )
  })
})

describe("evaluateAvailability", () => {
  const platforms = [
    { name: "macOS", introducedAt: "10.0", deprecatedAt: "27.0" },
    { name: "iOS", introducedAt: "14.0" },
  ]

  it("reports symbols that predate the deployment target as available", () => {
    expect(evaluateAvailability(platforms, { platform: "macOS", version: "14.5" })).toEqual({
      status: "available",
      detail: "available since macOS 10.0",
    })
  })

  it("reports symbols introduced after the deployment target", () => {
    expect(evaluateAvailability(platforms, { platform: "iOS", version: "13.0" })).toEqual({
      status: "unintroduced",
      detail: "not available; introduced in iOS 14.0",
    })
  })

  it("reports symbols deprecated by the deployment target", () => {
    expect(evaluateAvailability(platforms, { platform: "macOS", version: "27.0" })).toEqual({
      status: "deprecated",
      detail: "deprecated as of macOS 27.0",
    })
  })

  it("reports platforms the page does not cover", () => {
    expect(evaluateAvailability(platforms, { platform: "watchOS", version: "10.0" })).toEqual({
      status: "unavailable",
      detail: "not available on watchOS",
    })
  })

  it("honors an explicit unavailable flag", () => {
    expect(
      evaluateAvailability([{ name: "tvOS", introducedAt: "", unavailable: true }], {
        platform: "tvOS",
      }),
    ).toEqual({ status: "unavailable", detail: "not available on tvOS" })
  })

  it("falls back to the latest SDK when no version is given", () => {
    expect(evaluateAvailability(platforms, { platform: "macOS" })).toEqual({
      status: "deprecated",
      detail: "deprecated as of macOS 27.0",
    })
  })

  it("notes beta availability", () => {
    expect(
      evaluateAvailability([{ name: "macOS", introducedAt: "27.0", beta: true }], {
        platform: "macOS",
        version: "27.0",
      }),
    ).toEqual({ status: "available", detail: "available since macOS 27.0, beta" })
  })

  it("reports pages with no platform metadata as unknown", () => {
    expect(evaluateAvailability(undefined, { platform: "macOS", version: "14.5" })).toEqual({
      status: "unknown",
      detail: "no platform availability information on this page",
    })
  })
})

describe("renderFromJSON with a deployment target", () => {
  const deprecatedSymbol = {
    metadata: {
      title: "activate(ignoringOtherApps:)",
      platforms: [{ name: "macOS", introducedAt: "10.0", deprecatedAt: "27.0" }],
    },
  }

  it("renders deprecation ranges in the availability line", async () => {
    const result = await renderFromJSON(deprecatedSymbol as any, "https://test.com")

    expect(result).toContain("**Available on:** macOS 10.0-27.0 (deprecated)")
  })

  it("annotates the page for the requested deployment target", async () => {
    const result = await renderFromJSON(deprecatedSymbol as any, "https://test.com", {
      deploymentTarget: { platform: "macOS", version: "14.5" },
    })

    expect(result).toContain("**Deployment target:** macOS 14.5 (available since macOS 10.0)")
  })

  it("flags symbols that do not exist yet on the deployment target", async () => {
    const data = {
      metadata: {
        title: "activate()",
        platforms: [{ name: "macOS", introducedAt: "14.0" }],
      },
    }

    const result = await renderFromJSON(data as any, "https://test.com", {
      deploymentTarget: { platform: "macOS", version: "13.0" },
    })

    expect(result).toContain(
      "**Deployment target:** macOS 13.0 (not available; introduced in macOS 14.0)",
    )
  })

  it("omits the deployment target line when none is requested", async () => {
    const result = await renderFromJSON(deprecatedSymbol as any, "https://test.com")

    expect(result).not.toContain("**Deployment target:**")
  })
})

describe("HTTP deployment target parameters", () => {
  it("rejects an unsupported platform", async () => {
    const response = await SELF.fetch(
      "https://sosumi.ai/documentation/appkit/nsapplication?platform=windows",
    )

    expect(response.status).toBe(400)
    expect(await response.text()).toContain("Unsupported platform or version")
  })

  it("rejects a malformed version", async () => {
    const response = await SELF.fetch(
      "https://sosumi.ai/documentation/appkit/nsapplication?platform=macOS&osVersion=sonoma",
    )

    expect(response.status).toBe(400)
  })

  it("rejects osVersion without a platform", async () => {
    const response = await SELF.fetch(
      "https://sosumi.ai/documentation/appkit/nsapplication?osVersion=14.5",
    )

    expect(response.status).toBe(400)
    expect(await response.text()).toContain("platform")
  })
})

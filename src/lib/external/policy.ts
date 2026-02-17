export const EXTERNAL_DOC_USER_AGENT = "sosumi-ai/1.0 (+https://sosumi.ai/#bot)"

const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "::1"])
const ROBOTS_CACHE_TTL_MS = 5 * 60 * 1000
const robotsPolicyCache = new Map<string, { expiresAt: number; policy: RobotsPolicyResult }>()
const robotsPolicyInFlight = new Map<string, Promise<RobotsPolicyResult>>()

export interface ExternalPolicyEnv {
  EXTERNAL_DOC_HOST_ALLOWLIST?: string
  EXTERNAL_DOC_HOST_BLOCKLIST?: string
}

export class ExternalAccessError extends Error {
  status: number

  constructor(message: string, status: number = 403) {
    super(message)
    this.name = "ExternalAccessError"
    this.status = status
  }
}

export function validateExternalDocumentationUrl(rawUrl: string): URL {
  let parsedUrl: URL

  try {
    parsedUrl = new URL(rawUrl)
  } catch {
    throw new ExternalAccessError("Invalid external URL.", 400)
  }

  if (parsedUrl.protocol !== "https:") {
    throw new ExternalAccessError("Only https:// external URLs are supported.", 400)
  }

  if (parsedUrl.username || parsedUrl.password) {
    throw new ExternalAccessError("Credentialed URLs are not supported.", 400)
  }

  return parsedUrl
}

export async function assertExternalDocumentationAccess(
  targetUrl: URL,
  env: ExternalPolicyEnv,
): Promise<void> {
  assertHostPolicy(targetUrl, env)
  const robotsAllowed = await isAllowedByRobotsTxt(targetUrl)
  if (!robotsAllowed) {
    throw new ExternalAccessError("External host denied access for this path via robots.txt.", 403)
  }
}

function assertHostPolicy(targetUrl: URL, env: ExternalPolicyEnv): void {
  const hostname = targetUrl.hostname.toLowerCase()
  const allowlist = parseHostList(env.EXTERNAL_DOC_HOST_ALLOWLIST)
  const blocklist = parseHostList(env.EXTERNAL_DOC_HOST_BLOCKLIST)
  const explicitlyAllowlisted = isHostListed(hostname, allowlist)

  if (isHostListed(hostname, blocklist)) {
    throw new ExternalAccessError("External host is blocked by configuration.", 403)
  }

  if (allowlist.size > 0 && !explicitlyAllowlisted) {
    throw new ExternalAccessError("External host is not allowlisted.", 403)
  }

  if (isLocalOrPrivateHost(hostname) && !explicitlyAllowlisted) {
    throw new ExternalAccessError(
      "External URL points to a local or private host and is not allowlisted.",
      403,
    )
  }
}

async function isAllowedByRobotsTxt(targetUrl: URL): Promise<boolean> {
  const policy = await getRobotsPolicy(targetUrl.origin)
  if (policy.kind === "allow-all") {
    return true
  }
  if (policy.kind === "deny-all") {
    return false
  }
  return evaluateRobotsPolicy(
    policy.robotsText,
    targetUrl.pathname + targetUrl.search,
    EXTERNAL_DOC_USER_AGENT,
  )
}

function evaluateRobotsPolicy(robotsText: string, path: string, userAgent: string): boolean {
  const groups = parseRobotsGroups(robotsText)
  const matchingGroups = groups.filter((group) =>
    group.agents.some((agent) => userAgentMatches(agent, userAgent)),
  )

  if (matchingGroups.length === 0) {
    return true
  }

  let winningRule: { kind: "allow" | "disallow"; length: number } | null = null
  for (const group of matchingGroups) {
    for (const rule of group.rules) {
      if (!patternMatchesPath(rule.pattern, path)) {
        continue
      }

      const current = { kind: rule.kind, length: normalizedPatternLength(rule.pattern) }
      if (!winningRule || current.length > winningRule.length) {
        winningRule = current
      } else if (winningRule && current.length === winningRule.length && current.kind === "allow") {
        winningRule = current
      }
    }
  }

  if (!winningRule) {
    return true
  }

  return winningRule.kind === "allow"
}

function parseRobotsGroups(robotsText: string): Array<{
  agents: string[]
  rules: Array<{ kind: "allow" | "disallow"; pattern: string }>
}> {
  const groups: Array<{
    agents: string[]
    rules: Array<{ kind: "allow" | "disallow"; pattern: string }>
  }> = []

  let currentGroup: {
    agents: string[]
    rules: Array<{ kind: "allow" | "disallow"; pattern: string }>
  } = {
    agents: [],
    rules: [],
  }

  const lines = robotsText.split(/\r?\n/)
  for (const rawLine of lines) {
    const line = stripComments(rawLine).trim()
    if (!line) {
      continue
    }

    const delimiterIndex = line.indexOf(":")
    if (delimiterIndex === -1) {
      continue
    }

    const key = line.slice(0, delimiterIndex).trim().toLowerCase()
    const value = line.slice(delimiterIndex + 1).trim()

    if (key === "user-agent") {
      if (currentGroup.agents.length > 0 && currentGroup.rules.length > 0) {
        groups.push(currentGroup)
        currentGroup = { agents: [], rules: [] }
      }
      currentGroup.agents.push(value.toLowerCase())
      continue
    }

    if (key === "allow" || key === "disallow") {
      if (currentGroup.agents.length === 0) {
        continue
      }

      currentGroup.rules.push({
        kind: key,
        pattern: value,
      })
    }
  }

  if (currentGroup.agents.length > 0) {
    groups.push(currentGroup)
  }

  return groups
}

function userAgentMatches(ruleUserAgent: string, actualUserAgent: string): boolean {
  if (!ruleUserAgent) {
    return false
  }
  if (ruleUserAgent === "*") {
    return true
  }
  return actualUserAgent.toLowerCase().includes(ruleUserAgent.toLowerCase())
}

function patternMatchesPath(pattern: string, path: string): boolean {
  // "Disallow:" empty value means allow all.
  if (pattern.length === 0) {
    return true
  }

  const endsWithDollar = pattern.endsWith("$")
  const patternBody = endsWithDollar ? pattern.slice(0, -1) : pattern
  const escaped = escapeRegExp(patternBody).replace(/\\\*/g, ".*")
  const regex = new RegExp(`^${escaped}${endsWithDollar ? "$" : ""}`)
  return regex.test(path)
}

function normalizedPatternLength(pattern: string): number {
  return pattern.replace(/\$/g, "").length
}

function stripComments(line: string): string {
  const hashIndex = line.indexOf("#")
  if (hashIndex === -1) {
    return line
  }
  return line.slice(0, hashIndex)
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function parseHostList(rawList: string | undefined): Set<string> {
  if (!rawList) {
    return new Set()
  }

  return new Set(
    rawList
      .split(/\r?\n|,/)
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean),
  )
}

type RobotsPolicyResult =
  | { kind: "allow-all" }
  | { kind: "deny-all" }
  | { kind: "rules"; robotsText: string }

async function getRobotsPolicy(origin: string): Promise<RobotsPolicyResult> {
  const now = Date.now()
  const cached = robotsPolicyCache.get(origin)
  if (cached && cached.expiresAt > now) {
    return cached.policy
  }

  const inFlight = robotsPolicyInFlight.get(origin)
  if (inFlight) {
    return inFlight
  }

  const request = fetchRobotsPolicy(origin)
    .then((policy) => {
      robotsPolicyCache.set(origin, {
        expiresAt: Date.now() + ROBOTS_CACHE_TTL_MS,
        policy,
      })
      return policy
    })
    .finally(() => {
      robotsPolicyInFlight.delete(origin)
    })

  robotsPolicyInFlight.set(origin, request)
  return request
}

async function fetchRobotsPolicy(origin: string): Promise<RobotsPolicyResult> {
  const robotsUrl = new URL("/robots.txt", origin)
  const response = await fetch(robotsUrl.toString(), {
    headers: {
      "User-Agent": EXTERNAL_DOC_USER_AGENT,
      Accept: "text/plain, text/*;q=0.9, */*;q=0.1",
    },
  })

  // Missing robots.txt is treated as no policy restrictions.
  if (response.status === 404 || response.status === 410) {
    return { kind: "allow-all" }
  }

  // Explicit access denial when robots cannot be read due to auth restrictions.
  if (response.status === 401 || response.status === 403) {
    return { kind: "deny-all" }
  }

  // Fail open for transient server/network issues.
  if (!response.ok) {
    return { kind: "allow-all" }
  }

  const robotsText = await response.text()
  return { kind: "rules", robotsText }
}

function isHostListed(hostname: string, list: Set<string>): boolean {
  if (list.has(hostname)) {
    return true
  }

  for (const candidate of list) {
    if (candidate.startsWith(".")) {
      if (hostname.endsWith(candidate)) {
        return true
      }
      continue
    }

    if (hostname === candidate || hostname.endsWith(`.${candidate}`)) {
      return true
    }
  }

  return false
}

function isLocalOrPrivateHost(hostname: string): boolean {
  if (LOCAL_HOSTNAMES.has(hostname)) {
    return true
  }

  if (hostname.endsWith(".local")) {
    return true
  }

  if (isPrivateIPv4(hostname)) {
    return true
  }

  if (isPrivateIPv6(hostname)) {
    return true
  }

  return false
}

function isPrivateIPv4(hostname: string): boolean {
  const octets = hostname.split(".")
  if (octets.length !== 4 || octets.some((octet) => !/^\d{1,3}$/.test(octet))) {
    return false
  }

  const [a, b] = octets.map((octet) => Number.parseInt(octet, 10))
  if (a > 255 || b > 255) {
    return false
  }

  return (
    a === 10 ||
    a === 127 ||
    a === 0 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168)
  )
}

function isPrivateIPv6(hostname: string): boolean {
  const normalized = hostname.toLowerCase().replace(/^\[|\]$/g, "")
  return (
    normalized === "::1" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe8") ||
    normalized.startsWith("fe9") ||
    normalized.startsWith("fea") ||
    normalized.startsWith("feb")
  )
}

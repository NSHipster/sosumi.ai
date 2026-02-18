import robotsParser from "robots-parser"

export const EXTERNAL_DOC_USER_AGENT = "sosumi-ai/1.0 (+https://sosumi.ai/#bot)"

const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "::1"])
const EXTERNAL_PATH_PREFIX = "/external/"
const ROBOTS_CACHE_TTL_MS = 5 * 60 * 1000
const ROBOTS_CACHE_MAX_ENTRIES = 1000
const ROBOTS_INFLIGHT_MAX_ENTRIES = 1000
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
  if (!rawUrl || hasControlOrWhitespace(rawUrl)) {
    throw new ExternalAccessError("Invalid external URL.", 400)
  }

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

  if (parsedUrl.hash) {
    throw new ExternalAccessError("URL fragments are not supported.", 400)
  }

  return parsedUrl
}

export function decodeExternalTargetPath(path: string): string {
  if (!path.startsWith(EXTERNAL_PATH_PREFIX)) {
    throw new ExternalAccessError("Invalid external URL.", 400)
  }

  const encodedTarget = path.slice(EXTERNAL_PATH_PREFIX.length)
  if (!encodedTarget) {
    throw new ExternalAccessError("Invalid external URL.", 400)
  }

  try {
    const decodedTarget = decodeURIComponent(encodedTarget)
    if (!decodedTarget || hasControlOrWhitespace(decodedTarget)) {
      throw new ExternalAccessError("Invalid external URL.", 400)
    }
    return decodedTarget
  } catch {
    throw new ExternalAccessError("Invalid external URL.", 400)
  }
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
    // This blocks obvious local/private hostnames, but DNS rebinding on public hostnames
    // still requires explicit allowlists for strict SSRF protection in runtimes without DNS resolution APIs.
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
  return evaluateRobotsPolicy(policy.robotsText, targetUrl, EXTERNAL_DOC_USER_AGENT)
}

function evaluateRobotsPolicy(robotsText: string, targetUrl: URL, userAgent: string): boolean {
  const robots = robotsParser(new URL("/robots.txt", targetUrl.origin).toString(), robotsText)
  const isAllowed = robots.isAllowed(targetUrl.toString(), userAgent)
  return isAllowed !== false
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
  pruneExpiredRobotsPolicyEntries(now)

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
      enforceMaxMapEntries(robotsPolicyCache, ROBOTS_CACHE_MAX_ENTRIES)
      return policy
    })
    .finally(() => {
      robotsPolicyInFlight.delete(origin)
    })

  enforceMaxMapEntries(robotsPolicyInFlight, ROBOTS_INFLIGHT_MAX_ENTRIES, origin)
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

function pruneExpiredRobotsPolicyEntries(now: number): void {
  for (const [origin, entry] of robotsPolicyCache.entries()) {
    if (entry.expiresAt <= now) {
      robotsPolicyCache.delete(origin)
    }
  }
}

function enforceMaxMapEntries<K, V>(map: Map<K, V>, maxEntries: number, incomingKey?: K): void {
  while (
    map.size > maxEntries ||
    (incomingKey !== undefined && map.size >= maxEntries && !map.has(incomingKey))
  ) {
    const oldestKey = map.keys().next().value
    if (oldestKey === undefined) {
      break
    }
    map.delete(oldestKey)
  }
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

  const octetNumbers = octets.map((octet) => Number.parseInt(octet, 10))
  if (octetNumbers.some((value) => value > 255)) {
    return false
  }
  const [a, b] = octetNumbers

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

function hasControlOrWhitespace(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index)
    if (code <= 0x20 || code === 0x7f) {
      return true
    }
  }
  return false
}

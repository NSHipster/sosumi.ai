/**
 * Web Bot Auth (IETF Web Bot Auth working group) support.
 *
 * Two responsibilities:
 *
 *  1. Publish a JWKS at `/.well-known/http-message-signatures-directory`
 *     so receiving sites can look up the public key(s)
 *     used to verify our signatures.
 *  2. Sign the requests sosumi.ai makes to external Swift-DocC hosts
 *     with RFC 9421 HTTP Message Signatures,
 *     attaching `Signature-Agent`, `Signature-Input`, and `Signature` headers
 *     so those sites can verify the traffic comes from us.
 *
 * The Ed25519 private key is provided out-of-band
 * as the `WEB_BOT_AUTH_KEY` secret (a JSON Web Key).
 * The matching public key served in the directory is derived from it,
 * so no key material lives in the repository.
 *
 * See https://datatracker.ietf.org/wg/webbotauth/about/
 */

import {
  directoryResponseHeaders,
  HTTP_MESSAGE_SIGNATURES_DIRECTORY,
  jwkToKeyID,
  MediaType,
  type Signer,
  signatureHeaders,
} from "web-bot-auth"
import { helpers, signerFromJWK } from "web-bot-auth/crypto"

export interface WebBotAuthEnv {
  /**
   * Ed25519 private key as a JSON Web Key (JSON string).
   * Provided as a secret.
   */
  WEB_BOT_AUTH_KEY?: string
  /** Origin advertised in the `Signature-Agent` header and hosting the directory. */
  SIGNATURE_AGENT?: string
}

/** Path of the published key directory. */
export const DIRECTORY_PATH = HTTP_MESSAGE_SIGNATURES_DIRECTORY

/** Content type for the key directory response. */
export const DIRECTORY_MEDIA_TYPE = MediaType.HTTP_MESSAGE_SIGNATURES_DIRECTORY

const DEFAULT_SIGNATURE_AGENT = "https://sosumi.ai"

/**
 * How long an outbound request signature stays valid.
 * Short, to limit replay.
 */
const OUTBOUND_SIGNATURE_TTL_MS = 5 * 60 * 1000

/** How long the directory self-signature stays valid. */
const DIRECTORY_SIGNATURE_TTL_MS = 60 * 60 * 1000

/** A public JSON Web Key as published in the directory (RFC 8037 Ed25519). */
export interface DirectoryKey {
  kty?: string
  crv?: string
  x?: string
  kid: string
  use: string
}

interface WebBotAuthConfig {
  signer: Signer
  publicKey: DirectoryKey
  agent: string
}

/**
 * Cached, parsed configuration.
 * The signing key is application-global (the same for every request),
 * so it is memoized across requests in the isolate
 * and only rebuilt when the underlying secret or agent changes.
 */
let cache: { key: string; agent: string; config: Promise<WebBotAuthConfig> } | null = null

/**
 * Prime the signing configuration from the environment.
 * Call this once per request,
 * before any outbound fetch or directory response is produced.
 */
export function configureWebBotAuth(env: WebBotAuthEnv): void {
  const key = env.WEB_BOT_AUTH_KEY?.trim()
  if (!key) {
    cache = null
    return
  }

  const agent = env.SIGNATURE_AGENT?.trim() || DEFAULT_SIGNATURE_AGENT
  if (cache && cache.key === key && cache.agent === agent) {
    return
  }

  cache = { key, agent, config: buildConfig(key, agent) }
}

interface Ed25519PrivateJwk {
  kty: "OKP"
  crv: "Ed25519"
  x: string
  d: string
}

/**
 * Parse and validate the signing secret as an Ed25519 OKP private JWK.
 * Fails closed on anything malformed
 * so a misconfigured `WEB_BOT_AUTH_KEY` never yields a broken directory key
 * or unverifiable signatures.
 */
function parseSigningJwk(key: string): Ed25519PrivateJwk {
  let jwk: JsonWebKey
  try {
    jwk = JSON.parse(key) as JsonWebKey
  } catch (error) {
    throw new Error(`WEB_BOT_AUTH_KEY is not valid JSON: ${(error as Error).message}`)
  }

  if (
    jwk.kty !== "OKP" ||
    jwk.crv !== "Ed25519" ||
    typeof jwk.x !== "string" ||
    jwk.x.length === 0 ||
    typeof jwk.d !== "string" ||
    jwk.d.length === 0
  ) {
    throw new Error(
      "WEB_BOT_AUTH_KEY must be an Ed25519 private JSON Web Key (kty=OKP, crv=Ed25519, with x and d).",
    )
  }

  return { kty: jwk.kty, crv: jwk.crv, x: jwk.x, d: jwk.d }
}

async function buildConfig(key: string, agent: string): Promise<WebBotAuthConfig> {
  const jwk = parseSigningJwk(key)
  const signer = await signerFromJWK(jwk)
  const kid = await jwkToKeyID(jwk, helpers.WEBCRYPTO_SHA256, helpers.BASE64URL_DECODE)

  // Publish only the public half of the key (never the `d` parameter).
  const publicKey: DirectoryKey = {
    kty: jwk.kty,
    crv: jwk.crv,
    x: jwk.x,
    kid,
    use: "sig",
  }

  return { signer, publicKey, agent }
}

async function currentConfig(): Promise<WebBotAuthConfig | null> {
  const entry = cache
  if (!entry) {
    return null
  }

  try {
    return await entry.config
  } catch (error) {
    console.error("web-bot-auth: failed to load signing key", error)
    // Drop the failed config so the next request rebuilds it,
    // rather than serving the cached rejection until the isolate restarts.
    // Guard against clobbering a newer config set by a concurrent reconfigure.
    if (cache === entry) {
      cache = null
    }
    return null
  }
}

/** Serialize a value as an RFC 8941 structured-field string (a quoted string). */
function structuredString(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`
}

export interface DirectoryResponse {
  body: { keys: DirectoryKey[] }
  headers: Record<string, string>
}

/**
 * Build the signed key directory response,
 * or `null` when no key is configured.
 *
 * The response body is a JWKS
 * and carries `Signature`/`Signature-Input` headers
 * signing over `@authority` with `tag="http-message-signatures-directory"`,
 * demonstrating control of the published key.
 */
export async function webBotAuthDirectory(requestUrl: string): Promise<DirectoryResponse | null> {
  const config = await currentConfig()
  if (!config) {
    return null
  }

  const created = new Date()
  const expires = new Date(created.getTime() + DIRECTORY_SIGNATURE_TTL_MS)
  const message = {
    response: { status: 200, headers: {} as Record<string, string> },
    request: { method: "GET", url: requestUrl, headers: {} as Record<string, string> },
  }

  const signature = await directoryResponseHeaders(message, [config.signer], { created, expires })

  return {
    body: { keys: [config.publicKey] },
    headers: {
      "Content-Type": DIRECTORY_MEDIA_TYPE,
      Signature: signature.Signature,
      "Signature-Input": signature["Signature-Input"],
      "Cache-Control": "public, max-age=300, s-maxage=300",
    },
  }
}

/**
 * Produce Web Bot Auth headers for an outbound request,
 * or `{}` when no key is configured (e.g. local development or the CLI).
 * Signing failures degrade to an unsigned request
 * rather than breaking the fetch.
 */
export async function webBotAuthHeaders(
  method: string,
  url: string | URL,
): Promise<Record<string, string>> {
  const config = await currentConfig()
  if (!config) {
    return {}
  }

  try {
    const agent = structuredString(config.agent)
    // `signature-agent` must be present on the message
    // so it is covered by the signature;
    // the same value is returned for the outbound request.
    const headers = new Headers()
    headers.set("Signature-Agent", agent)

    const created = new Date()
    const expires = new Date(created.getTime() + OUTBOUND_SIGNATURE_TTL_MS)
    const signature = await signatureHeaders(
      { method, url: url.toString(), headers },
      config.signer,
      { created, expires },
    )

    return {
      "Signature-Agent": agent,
      "Signature-Input": signature["Signature-Input"],
      Signature: signature.Signature,
    }
  } catch (error) {
    console.error("web-bot-auth: failed to sign outbound request", error)
    return {}
  }
}

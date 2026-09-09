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
  MediaType,
  signatureHeaders,
} from "web-bot-auth"
import { configureSigningKey, currentSigningKey, type PublicSigningKey } from "./auth"
import { PUBLISHER_ORIGIN } from "./identity"

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

const DEFAULT_SIGNATURE_AGENT = PUBLISHER_ORIGIN

/**
 * How long an outbound request signature stays valid.
 * Short, to limit replay.
 */
const OUTBOUND_SIGNATURE_TTL_MS = 5 * 60 * 1000

/** How long the directory self-signature stays valid. */
const DIRECTORY_SIGNATURE_TTL_MS = 60 * 60 * 1000

let signatureAgent: string | null = null

/**
 * Prime the signing configuration from the environment.
 * Call this once per request,
 * before any outbound fetch or directory response is produced.
 */
export function configureWebBotAuth(env: WebBotAuthEnv): void {
  const key = env.WEB_BOT_AUTH_KEY?.trim()
  configureSigningKey(key)
  signatureAgent = key ? env.SIGNATURE_AGENT?.trim() || DEFAULT_SIGNATURE_AGENT : null
}

/** Serialize a value as an RFC 8941 structured-field string (a quoted string). */
function structuredString(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`
}

export interface DirectoryResponse {
  body: { keys: PublicSigningKey[] }
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
  const signingKey = await currentSigningKey()
  if (!signingKey) {
    return null
  }

  const created = new Date()
  const expires = new Date(created.getTime() + DIRECTORY_SIGNATURE_TTL_MS)
  const message = {
    response: { status: 200, headers: {} as Record<string, string> },
    request: { method: "GET", url: requestUrl, headers: {} as Record<string, string> },
  }

  const signature = await directoryResponseHeaders(message, [signingKey.signer], {
    created,
    expires,
  })

  return {
    body: { keys: [signingKey.publicKey] },
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
  const signingKey = await currentSigningKey()
  const agentValue = signatureAgent
  if (!signingKey || !agentValue) {
    return {}
  }

  try {
    const agent = structuredString(agentValue)
    // `signature-agent` must be present on the message
    // so it is covered by the signature;
    // the same value is returned for the outbound request.
    const headers = new Headers()
    headers.set("Signature-Agent", agent)

    const created = new Date()
    const expires = new Date(created.getTime() + OUTBOUND_SIGNATURE_TTL_MS)
    const signature = await signatureHeaders(
      { method, url: url.toString(), headers },
      signingKey.signer,
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

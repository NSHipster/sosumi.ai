import { jwkToKeyID, type Signer } from "web-bot-auth"
import { helpers, signerFromJWK } from "web-bot-auth/crypto"

/** The public half of the application's Ed25519 signing key. */
export interface PublicSigningKey {
  kty: "OKP"
  crv: "Ed25519"
  x: string
  kid: string
  use: string
}

export interface SigningKeyConfig {
  signer: Signer
  publicKey: PublicSigningKey
}

interface Ed25519PrivateJwk {
  kty: "OKP"
  crv: "Ed25519"
  x: string
  d: string
}

let cache: { key: string; config: Promise<SigningKeyConfig> } | null = null

/** Configure the application-wide signing key from a serialized private JWK. */
export function configureSigningKey(serializedKey?: string): void {
  const key = serializedKey?.trim()
  if (!key) {
    cache = null
    return
  }

  if (cache?.key === key) {
    return
  }

  cache = { key, config: buildSigningKeyConfig(key) }
}

/** Return the configured signer and public key, or null if unavailable. */
export async function currentSigningKey(): Promise<SigningKeyConfig | null> {
  const entry = cache
  if (!entry) {
    return null
  }

  try {
    return await entry.config
  } catch (error) {
    console.error("auth: failed to load signing key", error)
    if (cache === entry) {
      cache = null
    }
    return null
  }
}

/** Return a copy of the configured public signing key, if available. */
export async function currentPublicSigningKey(): Promise<PublicSigningKey | null> {
  const config = await currentSigningKey()
  return config ? { ...config.publicKey } : null
}

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

async function buildSigningKeyConfig(key: string): Promise<SigningKeyConfig> {
  const jwk = parseSigningJwk(key)
  const signer = await signerFromJWK(jwk)
  const kid = await jwkToKeyID(jwk, helpers.WEBCRYPTO_SHA256, helpers.BASE64URL_DECODE)

  return {
    signer,
    publicKey: {
      kty: jwk.kty,
      crv: jwk.crv,
      x: jwk.x,
      kid,
      use: "sig",
    },
  }
}

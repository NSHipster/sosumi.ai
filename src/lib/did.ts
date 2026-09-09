import { currentPublicSigningKey } from "./auth"
import { PUBLISHER_DID, PUBLISHER_ORIGIN } from "./identity"

export const DID_DOCUMENT_MEDIA_TYPE = "application/did+ld+json"

/**
 * Build the did:web document for Sosumi's stable publisher identity.
 * The verification method reuses the public half of the application signing
 * key, which is configured out of band and never committed. Returns `null`
 * rather than publishing an unverifiable identity when that key is unavailable.
 */
export async function buildDidDocument() {
  const publicKey = await currentPublicSigningKey()
  if (!publicKey) {
    return null
  }

  const verificationMethodId = `${PUBLISHER_DID}#${publicKey.kid}`

  return {
    "@context": ["https://www.w3.org/ns/did/v1", "https://w3id.org/security/suites/jws-2020/v1"],
    id: PUBLISHER_DID,
    alsoKnownAs: [PUBLISHER_ORIGIN],
    verificationMethod: [
      {
        id: verificationMethodId,
        type: "JsonWebKey2020",
        controller: PUBLISHER_DID,
        publicKeyJwk: {
          kty: publicKey.kty,
          crv: publicKey.crv,
          x: publicKey.x,
          kid: publicKey.kid,
        },
      },
    ],
    authentication: [verificationMethodId],
    assertionMethod: [verificationMethodId],
  }
}

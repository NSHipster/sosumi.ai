import { currentPublicSigningKey } from "./auth"
import { PUBLISHER_DID, PUBLISHER_ORIGIN } from "./identity"

export const DID_DOCUMENT_MEDIA_TYPE = "application/did+ld+json"

/**
 * Build the did:web document for Sosumi's stable publisher identity.
 * The verification method reuses the public half of the application signing
 * key, which is configured out of band and never committed.
 */
export async function buildDidDocument() {
  const publicKey = await currentPublicSigningKey()
  const document = {
    "@context": ["https://www.w3.org/ns/did/v1", "https://w3id.org/security/suites/jws-2020/v1"],
    id: PUBLISHER_DID,
    alsoKnownAs: [PUBLISHER_ORIGIN],
  }

  if (!publicKey) {
    return document
  }

  const verificationMethodId = `${PUBLISHER_DID}#${publicKey.kid}`

  return {
    ...document,
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

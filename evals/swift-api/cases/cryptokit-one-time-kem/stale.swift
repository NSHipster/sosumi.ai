import CryptoKit
import Foundation

// Uses the one-time key without an availability check.
func establishSessionKey(
    exchange: (MLKEM768.PublicKey) throws -> Data
) throws -> SymmetricKey {
    let privateKey = try MLKEM768.OneTimePrivateKey()
    let ciphertext = try exchange(privateKey.publicKey)
    return try privateKey.decapsulate(ciphertext)
}

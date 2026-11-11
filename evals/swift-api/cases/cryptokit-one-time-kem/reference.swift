import CryptoKit
import Foundation

func establishSessionKey(
    exchange: (MLKEM768.PublicKey) throws -> Data
) throws -> SymmetricKey {
    if #available(macOS 27.0, *) {
        let privateKey = try MLKEM768.OneTimePrivateKey()
        let ciphertext = try exchange(privateKey.publicKey)
        return try privateKey.decapsulate(ciphertext)
    } else {
        let privateKey = try MLKEM768.PrivateKey()
        let ciphertext = try exchange(privateKey.publicKey)
        return try privateKey.decapsulate(ciphertext)
    }
}

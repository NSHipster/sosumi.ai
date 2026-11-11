import CryptoKit
import Foundation

func checkEstablishSessionKey() throws {
    let key: SymmetricKey = try establishSessionKey { publicKey in
        try publicKey.encapsulate().encapsulated
    }
    _ = key.bitCount
}

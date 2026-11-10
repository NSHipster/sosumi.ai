import CryptoKit
import Foundation

func sha256Hex(of data: Data) -> String {
    SHA256.hash(data: data)
        .map { String(format: "%02x", $0) }
        .joined()
}

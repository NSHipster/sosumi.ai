import CryptoKit
import Foundation

// Assumes the digest has a hexadecimal string property.
func sha256Hex(of data: Data) -> String {
    SHA256.hash(data: data).hexString
}

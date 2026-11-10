import Foundation

func checkSHA256Hex() {
    let hex: String = sha256Hex(of: Data("hello".utf8))
    _ = hex.count
}

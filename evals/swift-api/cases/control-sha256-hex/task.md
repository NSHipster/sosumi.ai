# Compute a SHA-256 checksum as hexadecimal text

- Platform: macOS
- Deployment target: macOS 27.0 (`arm64-apple-macos27.0`)
- Framework: CryptoKit
- Language mode: Swift 6

A download manager verifies files against published SHA-256 checksums,
which are lowercase hexadecimal strings of 64 characters.

Declare:

```swift
func sha256Hex(of data: Data) -> String
```

Return the SHA-256 digest of `data` as a lowercase hexadecimal string.

Implement the behavior completely.
Do not use placeholder bodies such as `fatalError()`.

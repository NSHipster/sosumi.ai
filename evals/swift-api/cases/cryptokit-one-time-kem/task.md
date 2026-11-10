# Decapsulate a post-quantum key exactly once

- Platform: macOS
- Deployment target: macOS 26.0 (`arm64-apple-macos26.0`)
- Framework: CryptoKit
- Language mode: Swift 6

A messaging app sets up a session key with ML-KEM-768.
It generates a private key, gives the public key to a peer,
receives the peer's encapsulated ciphertext, and decapsulates it.
On systems that offer it, the app uses a private key
that the type system lets the app decapsulate only once.
On older systems in the deployment range, it uses an ordinary ML-KEM-768 private key.

Declare:

```swift
func establishSessionKey(
    exchange: (MLKEM768.PublicKey) throws -> Data
) throws -> SymmetricKey
```

`exchange` sends the public key to the peer and returns the peer's encapsulated ciphertext.

Implement the behavior completely.
Do not use placeholder bodies such as `fatalError()`.

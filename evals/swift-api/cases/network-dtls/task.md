# Open a DTLS connection with the structured Network API

- Platform: macOS
- Deployment target: macOS 27.0 (`arm64-apple-macos27.0`)
- Framework: Network

A game client sends encrypted datagrams to its server.
It uses the Network framework's Swift-native connection type
with DTLS over UDP, and it refuses any protocol version older than DTLS 1.2.

Declare:

```swift
func makeGameConnection(host: String, port: NWEndpoint.Port) -> NetworkConnection<DTLS>
```

Implement the behavior completely.
Do not use placeholder bodies such as `fatalError()`.

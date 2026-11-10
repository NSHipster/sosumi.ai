# Read a big-endian length from a byte span

- Platform: macOS
- Deployment target: macOS 26.0 (`arm64-apple-macos26.0`)
- Framework: Swift standard library

A file parser reads a 32-bit big-endian length field
at a given offset in a `RawSpan`.
On systems whose standard library can load an integer
with an explicit byte order, the parser uses that.
On older systems in the deployment range,
it loads the raw bytes without alignment requirements and converts from big-endian itself.

Declare:

```swift
func readLength(in bytes: RawSpan, at offset: Int) -> UInt32
```

Implement the behavior completely.
Do not use placeholder bodies such as `fatalError()`.

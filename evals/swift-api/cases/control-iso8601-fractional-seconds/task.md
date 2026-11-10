# Parse server timestamps with fractional seconds

- Platform: macOS
- Deployment target: macOS 27.0 (`arm64-apple-macos27.0`)
- Framework: Foundation
- Language mode: Swift 6

A server sends timestamps such as `2026-03-14T15:09:26.535Z`:
ISO 8601 internet date-time strings with fractional seconds.
The client converts them to `Date` values
and treats any string in another format as invalid.

Declare:

```swift
func parseTimestamp(_ string: String) -> Date?
```

Implement the behavior completely.
Do not use placeholder bodies such as `fatalError()`.

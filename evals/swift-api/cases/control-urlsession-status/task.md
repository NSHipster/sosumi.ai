# Fetch the HTTP status of a URL

- Platform: macOS
- Deployment target: macOS 27.0 (`arm64-apple-macos27.0`)
- Framework: Foundation

A link checker loads each URL with the shared URL session,
using Swift concurrency, and records the HTTP status code.
Responses that are not HTTP responses have no status code.

Declare:

```swift
func statusCode(of url: URL) async throws -> Int?
```

Implement the behavior completely.
Do not use placeholder bodies such as `fatalError()`.

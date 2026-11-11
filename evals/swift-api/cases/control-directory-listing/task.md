# List the Swift files in a folder

- Platform: macOS
- Deployment target: macOS 27.0 (`arm64-apple-macos27.0`)
- Framework: Foundation
- Language mode: Swift 6

A code formatter lists the Swift source files directly inside a folder.
It does not look into subfolders, and it skips hidden files.

Declare:

```swift
func swiftFiles(in directory: URL) throws -> [URL]
```

Return the URLs of the folder's visible entries whose path extension is `swift`.

Implement the behavior completely.
Do not use placeholder bodies such as `fatalError()`.

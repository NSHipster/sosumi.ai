# Report progress while importing files

- Platform: macOS
- Deployment target: macOS 27.0 (`arm64-apple-macos27.0`)
- Framework: Foundation

An importer processes a list of files, one at a time.
The caller hands the importer its share of a parent progress
by using Foundation's Swift progress-reporting API for macOS 27,
and the importer reports one unit of work for each file it finishes.

Declare:

```swift
func importFiles(
    _ urls: [URL],
    progress: consuming Subprogress,
    importOne: (URL) async throws -> Void
) async throws
```

Call `importOne` for each URL in order,
and report completion of one unit after each call returns.
The total amount of work is the number of URLs.

Implement the behavior completely.
Do not use placeholder bodies such as `fatalError()`.

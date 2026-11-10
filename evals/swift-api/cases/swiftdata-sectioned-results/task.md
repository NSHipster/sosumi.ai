# Group notes by folder outside SwiftUI

- Platform: macOS
- Deployment target: macOS 27.0 (`arm64-apple-macos27.0`)
- Framework: SwiftData
- Language mode: Swift 6

An AppKit sidebar lists notes grouped by folder,
sorted by title within each folder.
The sidebar is not a SwiftUI view, so it cannot use the `@Query` property wrapper.
It wants an object that keeps the fetched notes and their sections up to date
as the model context changes.
The check file declares the model:

```swift
@Model final class Note {
    var title: String
    var folder: String
    init(title: String, folder: String)
}
```

Declare:

```swift
@MainActor
func observeNotesByFolder(in context: ModelContext) throws -> ResultsObserver<Note, String>

@MainActor
func folderNames(in observer: ResultsObserver<Note, String>) -> [String]
```

`folderNames` returns the section titles in order,
or an empty array when the observer has no sections.

Implement the behavior completely.
Do not use placeholder bodies such as `fatalError()`.

# Finish saving even when the task is cancelled

- Platform: macOS
- Deployment target: macOS 27.0 (`arm64-apple-macos27.0`)
- Framework: Swift standard library (Swift Concurrency)
- Language mode: Swift 6

When the user closes a document window, the app cancels the task
that edits the document.
The final save must still run to completion:
code inside the save must not see the task as cancelled.
For logging, the app also wants to know whether the current code
runs inside such a protected region.

Declare:

```swift
func saveDraft(_ save: () async throws -> Void) async throws
func isProtectedFromCancellation() -> Bool
```

`saveDraft` awaits `save` within the current task
and keeps cancellation of that task from reaching `save`.
`isProtectedFromCancellation` returns `true`
when the current task's cancellation is hidden from the running code.

Implement the behavior completely.
Do not use placeholder bodies such as `fatalError()`.

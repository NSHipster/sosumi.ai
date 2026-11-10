# Confirm before closing a window with unsaved changes

- Platform: iOS
- Deployment target: iOS 27.0 (`arm64-apple-ios27.0`)
- Framework: UIKit
- Language mode: Swift 6

On iPad, a document editor runs in several windows.
When a window has unsaved changes, closing it must first ask the user to confirm.
The confirmation has the title `Discard changes?`,
the message `This window has unsaved changes.`,
a destructive `Discard` action that calls `discard`,
and a cancel action titled `Keep Editing`.

Declare:

```swift
@MainActor
func requireClosureConfirmation(for scene: UIWindowScene, discard: @escaping () -> Void)
```

Implement the behavior completely.
Do not use placeholder bodies such as `fatalError()`.

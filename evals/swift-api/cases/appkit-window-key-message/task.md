# React when a window becomes key, with typed notifications

- Platform: macOS
- Deployment target: macOS 27.0 (`arm64-apple-macos27.0`)
- Framework: AppKit
- Language mode: Swift 6

A document window refreshes its inspector whenever it becomes the key window.
The app uses Foundation's typed, concurrency-safe notification messages
instead of name-based notifications with untyped user-info dictionaries.
The observation lasts until the caller releases the returned token.

Declare:

```swift
@MainActor
func observeBecomingKey(
    _ window: NSWindow,
    perform action: @escaping @MainActor () -> Void
) -> NotificationCenter.ObservationToken
```

Call `action` on the main actor each time `window` becomes key.

Implement the behavior completely.
Do not use placeholder bodies such as `fatalError()`.

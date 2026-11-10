# Receive remote store changes as typed messages

- Platform: macOS
- Deployment target: macOS 27.0 (`arm64-apple-macos27.0`)
- Framework: Core Data

An app that syncs a Core Data store merges history
whenever another process changes the store.
It wants those remote-change events for one persistent store coordinator
as an asynchronous sequence of typed, concurrency-safe messages
instead of untyped notifications with user-info dictionaries.

Declare:

```swift
func remoteChanges(
    of coordinator: NSPersistentStoreCoordinator
) -> some AsyncSequence<NSPersistentStoreCoordinator.RemoteChangeMessage, Never>
```

Implement the behavior completely.
Do not use placeholder bodies such as `fatalError()`.

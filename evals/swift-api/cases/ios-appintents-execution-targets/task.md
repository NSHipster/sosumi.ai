# Run an App Intent only in the main app

- Platform: iOS
- Deployment target: iOS 27.0 (`arm64-apple-ios27.0`)
- Framework: AppIntents

A news app offers a Shortcuts action that refreshes the feed.
The refresh needs the app's in-memory caches,
so the system must run this intent only in the app's main process,
never in an App Intents extension or a widget extension.
The check file declares the feed store:

```swift
actor FeedStore {
    static let shared: FeedStore
    func refresh() async throws
}
```

The intent's title is `Refresh Feed`.
Running it refreshes the shared feed store and returns an empty result.

Declare:

```swift
struct RefreshFeedIntent: AppIntent {
    init()
    func perform() async throws -> some IntentResult
}
```

Implement the behavior completely.
Do not use placeholder bodies such as `fatalError()`.

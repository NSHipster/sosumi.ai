# Make a generic page of results sendable

- Platform: macOS
- Deployment target: macOS 27.0 (`arm64-apple-macos27.0`)
- Framework: Swift standard library
- Language mode: Swift 6

A paginated API returns pages of items.
Pages of value types move between tasks,
so a page must be `Sendable` whenever its items are `Sendable`.
The same type also holds reference-type items on the main thread,
so it must remain usable, without being `Sendable`,
for items that are not `Sendable`.

Declare:

```swift
struct Page<Item> {
    var items: [Item]
    var nextCursor: String?
    init(items: [Item], nextCursor: String?)
}
```

Implement the behavior completely.
Do not use placeholder bodies such as `fatalError()`.

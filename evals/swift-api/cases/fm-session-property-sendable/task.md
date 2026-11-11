# Share a session property across tasks

- Platform: macOS
- Deployment target: macOS 27.0 (`arm64-apple-macos27.0`)
- Framework: FoundationModels
- Language mode: Swift 6

An app keeps per-session state in a FoundationModels language model session,
using a key path into the session's property values.
Write a small wrapper that reads and writes one such session property.
Tasks pass the wrapper to each other,
so it must be `Sendable` whenever its value type is `Sendable`.
It must also work, without being `Sendable`,
for value types that are not `Sendable`.

Declare:

```swift
struct SessionSetting<Value> {
    init(_ keyPath: ReferenceWritableKeyPath<SessionPropertyValues, Value>)
    var value: Value { get nonmutating set }
}
```

`value` reads and writes the session property at `keyPath`.

Implement the behavior completely.
Do not use placeholder bodies such as `fatalError()`.

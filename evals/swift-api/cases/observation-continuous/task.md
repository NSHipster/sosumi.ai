# Observe a model value until the observer cancels

- Platform: macOS
- Deployment target: macOS 27.0 (`arm64-apple-macos27.0`)
- Framework: Observation
- Language mode: Swift 6

An app shows a counter in several places.
A component outside SwiftUI wants a callback every time the counter's value changes,
for as long as it holds on to a value that it can later cancel.
The check file declares this observable type:

```swift
@MainActor @Observable final class Counter {
    var value: Int
    init(value: Int)
}
```

Declare:

```swift
@MainActor
func observeValue(
    of counter: Counter,
    onChange: @escaping @Sendable (Int) -> Void
) -> ObservationTracking.Token
```

Call `onChange` with the new value after each change to `counter.value`,
and keep observing until the caller cancels the returned token.

Implement the behavior completely.
Do not use placeholder bodies such as `fatalError()`.

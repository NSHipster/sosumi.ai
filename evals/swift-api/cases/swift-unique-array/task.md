# Issue a batch of noncopyable tickets

- Platform: macOS
- Deployment target: macOS 27.0 (`arm64-apple-macos27.0`)
- Framework: Swift standard library
- Language mode: Swift 6

A ticketing system models each ticket as a noncopyable value,
so that no ticket can be duplicated by accident.
The check file declares the ticket type:

```swift
struct Ticket: ~Copyable {
    let number: Int
}
```

Declare:

```swift
func issueTickets(count: Int) -> UniqueArray<Ticket>
```

Return `count` tickets numbered from `0` through `count - 1`, in order.

Implement the behavior completely.
Do not use placeholder bodies such as `fatalError()`.

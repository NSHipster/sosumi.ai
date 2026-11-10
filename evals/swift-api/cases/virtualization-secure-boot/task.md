# Show whether a virtual machine boots securely

- Platform: macOS
- Deployment target: macOS 27.0 (`arm64-apple-macos27.0`)
- Framework: Virtualization

A virtual machine manager shows a badge
when a Linux guest's EFI variable store has Secure Boot turned on.
If the manager cannot read that setting from the store,
it shows no badge at all.

Declare:

```swift
func secureBootBadge(for store: VZEFIVariableStore) -> Bool?
```

Return whether Secure Boot is enabled in `store`,
or `nil` when the setting cannot be read.

Implement the behavior completely.
Do not use placeholder bodies such as `fatalError()`.

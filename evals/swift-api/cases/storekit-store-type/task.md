# Detect an education purchase of the app

- Platform: macOS
- Deployment target: macOS 27.0 (`arm64-apple-macos27.0`)
- Framework: StoreKit
- Language mode: Swift 6

Schools buy the app in volume through Apple's education channel.
When the app was obtained that way, it hides its in-app purchase upsell.
The decision uses the app's own App Store transaction,
and only a transaction that StoreKit has verified counts.

Declare:

```swift
func isEducationPurchase() async throws -> Bool
```

Return `true` only when the app transaction is verified
and shows that the app came from the education store.

Implement the behavior completely.
Do not use placeholder bodies such as `fatalError()`.

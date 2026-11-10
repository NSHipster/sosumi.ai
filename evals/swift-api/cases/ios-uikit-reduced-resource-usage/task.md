# Do less background work when the system asks for it

- Platform: iOS
- Deployment target: iOS 26.0 (`arm64-apple-ios26.0`)
- Framework: UIKit

A photo app runs optional background work, such as generating thumbnails ahead of time.
On iOS versions where the system reports that it prefers apps to reduce their resource usage,
the app follows that preference.
On older versions in the deployment range, it reduces work when Low Power Mode is on.

Declare:

```swift
@MainActor
func shouldReduceBackgroundWork() -> Bool
```

Implement the behavior completely.
Do not use placeholder bodies such as `fatalError()`.

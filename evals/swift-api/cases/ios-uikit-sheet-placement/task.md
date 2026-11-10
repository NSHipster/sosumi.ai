# Show an inspector sheet on the trailing edge

- Platform: iOS
- Deployment target: iOS 26.0 (`arm64-apple-ios26.0`)
- Framework: UIKit
- Language mode: Swift 6

A drawing app shows its inspector as a sheet over the canvas.
On iOS versions that let an app choose where a sheet appears,
the inspector sheet appears on the trailing edge of the presenting view.
On older versions in the deployment range, it uses the default sheet placement.

Declare:

```swift
@MainActor
func presentInspector(_ inspector: UIViewController, from presenter: UIViewController)
```

Implement the behavior completely.
Do not use placeholder bodies such as `fatalError()`.

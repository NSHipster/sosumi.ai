# Minimize the navigation bar while reading

- Platform: iOS
- Deployment target: iOS 27.0 (`arm64-apple-ios27.0`)
- Framework: UIKit

A reading app shows long articles in a navigation controller.
As the reader scrolls down through an article, the navigation bar minimizes
to give the text more room.
The bar comes back only when the reader scrolls back to the top of the article,
not as soon as the reader changes scroll direction.

Declare:

```swift
@MainActor
func configureReadingNavigationBar(for item: UINavigationItem)
```

Implement the behavior completely.
Do not use placeholder bodies such as `fatalError()`.

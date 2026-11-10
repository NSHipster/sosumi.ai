# Turn off writing corrections in a code editor

- Platform: iOS
- Deployment target: iOS 27.0 (`arm64-apple-ios27.0`)
- Framework: UIKit

A code snippet app edits source code in a text view.
Writing aids that help with prose get in the way of code,
so the text view turns off autocorrection, spell checking, grammar checking,
and smart quotes.

Declare:

```swift
@MainActor
func makeCodeTextView() -> UITextView
```

Implement the behavior completely.
Do not use placeholder bodies such as `fatalError()`.

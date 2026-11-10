# Recognize a context overflow error

- Platform: macOS
- Deployment target: macOS 27.0 (`arm64-apple-macos27.0`)
- Framework: FoundationModels
- Language mode: Swift 6

When a FoundationModels request fails because the prompt and transcript
no longer fit in the model's context, an app wants to trim the conversation.
To decide how much to trim, it needs the context size that the error reports.

Declare:

```swift
func exceededContextSize(_ error: any Error) -> Int?
```

Return the context size from the error when the error is a context overflow
reported by FoundationModels, and `nil` for any other error.
Use the current API, without deprecation warnings.

Implement the behavior completely.
Do not use placeholder bodies such as `fatalError()`.

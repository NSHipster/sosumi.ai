# Report how much context a session has left

- Platform: macOS
- Deployment target: macOS 26.0 (`arm64-apple-macos26.0`)
- Framework: FoundationModels
- Language mode: Swift 6

Before it sends a long prompt, an app checks how many tokens remain
in the on-device model's context window
after the conversation that a session already holds.
The app supports every macOS version from its deployment target.
On a system that cannot count tokens, the function returns `nil`.

Declare:

```swift
func remainingContext(
    for session: LanguageModelSession,
    model: SystemLanguageModel
) async throws -> Int?
```

The result is the model's context size
minus the number of tokens in the session's transcript.

Implement the behavior completely.
Do not use placeholder bodies such as `fatalError()`.

# Plug a custom model into a language model session

- Platform: macOS
- Deployment target: macOS 27.0 (`arm64-apple-macos27.0`)
- Framework: FoundationModels
- Language mode: Swift 6

A test suite needs a fake language model that it can pass to
`LanguageModelSession(model:)` in place of the system model.
The fake model has no special capabilities and needs no configuration.
Whatever the request, it responds with the text `"Hello"`,
which counts as one token.

Declare:

```swift
struct EchoModel {          // conforms to the FoundationModels language model protocol
    init()
}

struct EchoExecutor {       // the type that generates EchoModel's responses
}
```

`EchoExecutor` must be the type that the framework uses
to run requests for `EchoModel`.

Implement the behavior completely.
Do not use placeholder bodies such as `fatalError()`.

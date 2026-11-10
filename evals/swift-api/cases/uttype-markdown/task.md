# Accept Markdown files in an open panel

- Platform: macOS
- Deployment target: macOS 26.0 (`arm64-apple-macos26.0`)
- Framework: UniformTypeIdentifiers

A notes app opens Markdown files.
It needs the uniform type for Markdown to configure its open panel.
On macOS versions where the system declares a Markdown type constant,
the app uses that constant.
On older versions in the deployment range,
it uses the type with identifier `net.daringfireball.markdown`,
which the app imports in its Info.plist.

Declare:

```swift
func markdownType() -> UTType
```

Implement the behavior completely.
Do not use placeholder bodies such as `fatalError()`.

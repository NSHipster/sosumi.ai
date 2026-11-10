# Ask Image Playground to edit an existing image

- Platform: macOS
- Deployment target: macOS 26.4 (`arm64-apple-macos26.4`)
- Framework: ImagePlayground
- Language mode: Swift 6

A photo app opens Image Playground with a source image
and passes it a set of Image Playground options.
On systems where the options can say how Image Playground creates images,
the app asks it to edit the existing image instead of generating a new one.
On older systems in the deployment range, it uses the default options.

Declare:

```swift
func editingOptions() -> ImagePlaygroundOptions
```

Implement the behavior completely.
Do not use placeholder bodies such as `fatalError()`.

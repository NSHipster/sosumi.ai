# Attach an image to a prompt when the model can see images

- Platform: macOS
- Deployment target: macOS 27.0 (`arm64-apple-macos27.0`)
- Framework: FoundationModels
- Language mode: Swift 6

An app builds transcript entries by hand.
When the user adds a picture, the app wants a transcript segment
that carries the image to the on-device model.
Some models cannot take image input;
for those, the function returns `nil` so that the app can fall back to text.

Declare:

```swift
func imageSegment(for image: CGImage, model: SystemLanguageModel) -> Transcript.Segment?
```

Implement the behavior completely.
Do not use placeholder bodies such as `fatalError()`.

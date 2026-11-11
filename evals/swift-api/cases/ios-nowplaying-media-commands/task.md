# Offer playback controls with the NowPlaying framework

- Platform: iOS
- Deployment target: iOS 27.0 (`arm64-apple-ios27.0`)
- Framework: NowPlaying
- Language mode: Swift 6

A podcast app publishes its playback controls to the system
(Lock Screen, Control Center, headphones) with the NowPlaying framework.
It offers play, pause, skip forward by 30 seconds, and skip back by 15 seconds.
The check file declares the player:

```swift
@MainActor protocol AudioPlayer: AnyObject {
    func play() async throws
    func pause() async throws
    func skip(by seconds: TimeInterval) async throws  // negative values skip back
}
```

Each control calls the matching player method.
The skip controls pass the interval that the system requests.

Declare:

```swift
@MainActor
func transportCommands(for player: any AudioPlayer) -> [MediaCommand]
```

Implement the behavior completely.
Do not use placeholder bodies such as `fatalError()`.

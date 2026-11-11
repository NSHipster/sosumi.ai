# Convert recorded audio for speech transcription

- Platform: macOS
- Deployment target: macOS 26.0 (`arm64-apple-macos26.0`)
- Framework: Speech
- Language mode: Swift 6

A dictation feature records audio buffers in the microphone's native format
and feeds them to a `SpeechTranscriber`.
The transcriber needs input in a format that it supports,
so each buffer must be converted first.
On systems where the Speech framework can convert input buffers itself,
the app lets the framework do the conversion.
On older systems in the deployment range,
the app converts the buffer with `AVAudioConverter`
to the best audio format that the Speech framework reports for the transcriber,
and returns an empty array when no such format exists.

Declare:

```swift
func analyzerInputs(
    from buffer: AVAudioPCMBuffer,
    for transcriber: SpeechTranscriber
) async throws -> [AnalyzerInput]
```

The buffer has no timestamp.

Implement the behavior completely.
Do not use placeholder bodies such as `fatalError()`.

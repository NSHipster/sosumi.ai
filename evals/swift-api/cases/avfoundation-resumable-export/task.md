# Prepare a long video export so it can resume

- Platform: macOS
- Deployment target: macOS 27.0 (`arm64-apple-macos27.0`)
- Framework: AVFoundation

A video editor exports long projects.
Before it starts an export, it asks the export session to prepare
so that an interrupted export can resume later.
The editor records whether the export can resume and,
when it cannot, shows a short reason in its activity log.

Declare:

```swift
func prepareResumableExport(_ session: AVAssetExportSession) async -> String?
```

Return `nil` when the export can resume.
Otherwise return a description of the reason
(any string made from the reason that the session reports).

Implement the behavior completely.
Do not use placeholder bodies such as `fatalError()`.

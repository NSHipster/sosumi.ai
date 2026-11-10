# Read the next crash report with MetricKit

- Platform: macOS
- Deployment target: macOS 27.0 (`arm64-apple-macos27.0`)
- Framework: MetricKit

An app's support screen shows the signal of the most recent crash
that the system reports for the app.
It waits for the next diagnostic report from MetricKit's Swift manager type.

Declare:

```swift
func nextCrashSignal(from manager: MetricManager) async -> Int?
```

Wait for the next diagnostic report.
If it describes a crash, return the crash's signal number, which may be absent.
If it describes anything else, or no report arrives, return `nil`.

Implement the behavior completely.
Do not use placeholder bodies such as `fatalError()`.

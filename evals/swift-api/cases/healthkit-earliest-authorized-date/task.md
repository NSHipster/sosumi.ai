# Find the earliest health data the app may read

- Platform: macOS
- Deployment target: macOS 26.0 (`arm64-apple-macos26.0`)
- Framework: HealthKit
- Language mode: Swift 6

A health dashboard limits its date picker
to the range of samples that the app is allowed to read.
On systems that report the earliest authorized date for each data type,
the app asks for the date for the given type.
On older systems in the deployment range,
it uses the single earliest date that the health store permits for all samples.

Declare:

```swift
func earliestReadableDate(for type: HKObjectType, in store: HKHealthStore) async throws -> Date?
```

Return `nil` when the system reports no date for the type.

Implement the behavior completely.
Do not use placeholder bodies such as `fatalError()`.

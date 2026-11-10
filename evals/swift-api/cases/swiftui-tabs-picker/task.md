# Show a mode picker as tabs where the system supports it

- Platform: macOS
- Deployment target: macOS 26.0 (`arm64-apple-macos26.0`)
- Framework: SwiftUI
- Language mode: Swift 6

An inspector lets the user switch between three modes.
On macOS versions that have SwiftUI's tab-style picker,
the picker uses that style.
On older versions in the deployment range, it uses a segmented control.
The check file declares the mode type:

```swift
enum InspectorMode: String, CaseIterable, Identifiable {
    case layout, style, data
    var id: Self { self }
}
```

Declare:

```swift
struct ModePicker: View {
    init(selection: Binding<InspectorMode>)
}
```

The picker shows one item per mode, labeled with the mode's raw value.

Implement the behavior completely.
Do not use placeholder bodies such as `fatalError()`.

# List the widget sizes that a widget supports

- Platform: macOS
- Deployment target: macOS 26.0 (`arm64-apple-macos26.0`)
- Framework: WidgetKit

A calendar widget supports the small, medium, and large system sizes.
On systems that offer the tall, extra-large portrait system size,
it supports that size too, listed last.
The widget configuration calls a helper to get the list.

Declare:

```swift
func calendarWidgetFamilies() -> [WidgetFamily]
```

Implement the behavior completely.
Do not use placeholder bodies such as `fatalError()`.

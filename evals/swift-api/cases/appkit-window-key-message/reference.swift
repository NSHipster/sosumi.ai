import AppKit

@MainActor
func observeBecomingKey(
    _ window: NSWindow,
    perform action: @escaping @MainActor () -> Void
) -> NotificationCenter.ObservationToken {
    NotificationCenter.default.addObserver(of: window, for: .didBecomeKey) { _ in
        action()
    }
}

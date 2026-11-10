import AppKit

// Observes the name-based notification, as before typed AppKit messages.
@MainActor
func observeBecomingKey(
    _ window: NSWindow,
    perform action: @escaping @MainActor () -> Void
) -> NotificationCenter.ObservationToken {
    NotificationCenter.default.addObserver(
        forName: NSWindow.didBecomeKeyNotification,
        object: window,
        queue: .main
    ) { _ in
        MainActor.assumeIsolated {
            action()
        }
    }
}

import AppKit

@MainActor
func observeBecomingKey(
    _ window: NSWindow,
    perform action: @escaping @MainActor () -> Void
) -> NotificationCenter.ObservationToken {
    fatalError()
}

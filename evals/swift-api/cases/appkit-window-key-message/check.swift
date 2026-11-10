import AppKit

@MainActor
func checkObserveBecomingKey(window: NSWindow) {
    var count = 0
    let token: NotificationCenter.ObservationToken = observeBecomingKey(window) {
        count += 1
    }
    NotificationCenter.default.removeObserver(token)
}

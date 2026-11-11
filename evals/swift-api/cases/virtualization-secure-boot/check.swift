import Foundation
import Virtualization

func checkSecureBootBadge(url: URL) {
    let store = VZEFIVariableStore(url: url)
    let badge: Bool? = secureBootBadge(for: store)
    _ = badge
}

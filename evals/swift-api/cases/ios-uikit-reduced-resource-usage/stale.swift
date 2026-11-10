import UIKit

// Reads the iOS 27 property without an availability check.
@MainActor
func shouldReduceBackgroundWork() -> Bool {
    UIApplication.shared.systemPrefersReducedResourceUsage
}

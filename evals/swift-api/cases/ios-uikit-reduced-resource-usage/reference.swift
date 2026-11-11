import UIKit

@MainActor
func shouldReduceBackgroundWork() -> Bool {
    if #available(iOS 27.0, *) {
        return UIApplication.shared.systemPrefersReducedResourceUsage
    }
    return ProcessInfo.processInfo.isLowPowerModeEnabled
}

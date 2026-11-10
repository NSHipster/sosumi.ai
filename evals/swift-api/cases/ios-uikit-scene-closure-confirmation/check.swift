import UIKit

@MainActor
func checkRequireClosureConfirmation(scene: UIWindowScene) {
    requireClosureConfirmation(for: scene) {
        print("discarded")
    }
}

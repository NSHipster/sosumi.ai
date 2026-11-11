import UIKit

@MainActor
func requireClosureConfirmation(for scene: UIWindowScene, discard: @escaping () -> Void) {
    fatalError()
}

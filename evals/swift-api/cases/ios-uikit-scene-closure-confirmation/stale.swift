import UIKit

// Builds an alert controller, as for an in-window confirmation.
@MainActor
func requireClosureConfirmation(for scene: UIWindowScene, discard: @escaping () -> Void) {
    let alert = UIAlertController(
        title: "Discard changes?",
        message: "This window has unsaved changes.",
        preferredStyle: .alert
    )
    alert.addAction(UIAlertAction(title: "Discard", style: .destructive) { _ in discard() })
    alert.addAction(UIAlertAction(title: "Keep Editing", style: .cancel))
    scene.closureConfirmation = alert
}

import UIKit

@MainActor
func requireClosureConfirmation(for scene: UIWindowScene, discard: @escaping () -> Void) {
    scene.closureConfirmation = UISceneClosureConfirmation(
        title: "Discard changes?",
        message: "This window has unsaved changes.",
        actions: [
            UIAlertAction(title: "Discard", style: .destructive) { _ in discard() },
            UIAlertAction(title: "Keep Editing", style: .cancel),
        ]
    )
}

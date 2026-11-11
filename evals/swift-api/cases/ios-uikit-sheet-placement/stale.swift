import UIKit

// Sets the placement without an availability check.
@MainActor
func presentInspector(_ inspector: UIViewController, from presenter: UIViewController) {
    inspector.modalPresentationStyle = .pageSheet
    inspector.sheetPresentationController?.preferredPlacement = .trailing
    presenter.present(inspector, animated: true)
}

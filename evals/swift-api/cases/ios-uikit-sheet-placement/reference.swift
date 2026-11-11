import UIKit

@MainActor
func presentInspector(_ inspector: UIViewController, from presenter: UIViewController) {
    inspector.modalPresentationStyle = .pageSheet
    if #available(iOS 27.0, *), let sheet = inspector.sheetPresentationController {
        sheet.preferredPlacement = .trailing
    }
    presenter.present(inspector, animated: true)
}

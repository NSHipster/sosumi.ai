import UIKit

// Copies the shape of the tab bar's minimize behavior from iOS 26.
@MainActor
func configureReadingNavigationBar(for item: UINavigationItem) {
    item.navigationBarMinimizeBehavior = .onScrollDown
}

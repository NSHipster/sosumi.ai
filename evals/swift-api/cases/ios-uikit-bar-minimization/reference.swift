import UIKit

@MainActor
func configureReadingNavigationBar(for item: UINavigationItem) {
    var minimization = UIBarMinimization()
    minimization.minimizationBehavior = .onScrollDown
    minimization.restorationBehavior = .atScrollEdge
    item.navigationBarMinimization = minimization
}

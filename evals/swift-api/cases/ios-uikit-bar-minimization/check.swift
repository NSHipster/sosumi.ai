import UIKit

@MainActor
func checkConfigureReadingNavigationBar() {
    let article = UIViewController()
    configureReadingNavigationBar(for: article.navigationItem)
}

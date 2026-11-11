import UIKit

@MainActor
func checkMakeCodeTextView() {
    let textView: UITextView = makeCodeTextView()
    textView.text = "let x = 1"
}

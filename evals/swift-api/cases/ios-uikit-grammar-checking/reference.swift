import UIKit

@MainActor
func makeCodeTextView() -> UITextView {
    let textView = UITextView()
    textView.autocorrectionType = .no
    textView.spellCheckingType = .no
    textView.grammarCheckingType = .no
    textView.smartQuotesType = .no
    return textView
}

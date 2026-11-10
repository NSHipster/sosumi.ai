import UIKit

// Uses the AppKit spelling of the grammar-checking switch.
@MainActor
func makeCodeTextView() -> UITextView {
    let textView = UITextView()
    textView.autocorrectionType = .no
    textView.spellCheckingType = .no
    textView.isGrammarCheckingEnabled = false
    textView.smartQuotesType = .no
    return textView
}

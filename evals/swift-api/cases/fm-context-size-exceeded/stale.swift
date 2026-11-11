import FoundationModels

// Uses the OS 26 error case, whose context carries no size.
func exceededContextSize(_ error: any Error) -> Int? {
    guard case .exceededContextWindowSize(let context)? =
        error as? LanguageModelSession.GenerationError
    else {
        return nil
    }
    return context.contextSize
}

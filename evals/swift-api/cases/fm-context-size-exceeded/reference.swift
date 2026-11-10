import FoundationModels

func exceededContextSize(_ error: any Error) -> Int? {
    guard case .contextSizeExceeded(let details)? = error as? LanguageModelError else {
        return nil
    }
    return details.contextSize
}

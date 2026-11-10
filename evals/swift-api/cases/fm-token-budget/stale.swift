import FoundationModels

// Calls the token-counting API without an availability check.
func remainingContext(
    for session: LanguageModelSession,
    model: SystemLanguageModel
) async throws -> Int? {
    let used = try await model.tokenCount(for: session.transcript)
    return model.contextSize - used
}

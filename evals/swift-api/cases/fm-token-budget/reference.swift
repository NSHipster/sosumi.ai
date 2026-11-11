import FoundationModels

func remainingContext(
    for session: LanguageModelSession,
    model: SystemLanguageModel
) async throws -> Int? {
    guard #available(macOS 26.4, *) else {
        return nil
    }
    let used = try await model.tokenCount(for: session.transcript)
    return model.contextSize - used
}

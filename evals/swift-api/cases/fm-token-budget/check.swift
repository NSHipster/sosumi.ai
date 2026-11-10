import FoundationModels

func checkRemainingContext(session: LanguageModelSession) async throws {
    let remaining: Int? = try await remainingContext(for: session, model: .default)
    _ = remaining
}

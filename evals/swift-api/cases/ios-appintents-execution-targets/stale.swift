import AppIntents

// Guesses a member name for the main app target.
struct RefreshFeedIntent: AppIntent {
    static let title: LocalizedStringResource = "Refresh Feed"
    static let allowedExecutionTargets: IntentExecutionTargets = .app

    init() {}

    func perform() async throws -> some IntentResult {
        try await FeedStore.shared.refresh()
        return .result()
    }
}

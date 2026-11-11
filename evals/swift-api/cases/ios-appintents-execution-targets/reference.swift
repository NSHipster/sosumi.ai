import AppIntents

struct RefreshFeedIntent: AppIntent {
    static let title: LocalizedStringResource = "Refresh Feed"
    static let allowedExecutionTargets: IntentExecutionTargets = .main

    init() {}

    func perform() async throws -> some IntentResult {
        try await FeedStore.shared.refresh()
        return .result()
    }
}

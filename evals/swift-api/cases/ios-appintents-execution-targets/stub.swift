import AppIntents

struct RefreshFeedIntent: AppIntent {
    static let title: LocalizedStringResource = "Refresh Feed"

    init() {}

    func perform() async throws -> some IntentResult {
        fatalError()
    }
}

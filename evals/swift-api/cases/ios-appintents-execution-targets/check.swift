import AppIntents

actor FeedStore {
    static let shared = FeedStore()
    func refresh() async throws {}
}

func checkRefreshFeedIntent() async throws {
    let intent = RefreshFeedIntent()
    _ = try await intent.perform()
}

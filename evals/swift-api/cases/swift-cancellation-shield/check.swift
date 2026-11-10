func checkSaveDraft() async throws {
    var saved = false
    try await saveDraft {
        saved = isProtectedFromCancellation()
    }
    _ = saved
}

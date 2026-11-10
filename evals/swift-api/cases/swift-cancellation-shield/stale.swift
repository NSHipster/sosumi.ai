// Guesses the shield API as static members of Task.
func saveDraft(_ save: () async throws -> Void) async throws {
    try await Task.withCancellationShield {
        try await save()
    }
}

func isProtectedFromCancellation() -> Bool {
    Task.isCancellationShielded
}

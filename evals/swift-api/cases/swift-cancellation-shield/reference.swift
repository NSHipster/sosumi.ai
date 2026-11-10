func saveDraft(_ save: () async throws -> Void) async throws {
    try await withTaskCancellationShield {
        try await save()
    }
}

func isProtectedFromCancellation() -> Bool {
    Task.hasActiveCancellationShield
}

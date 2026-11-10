import SwiftData

@MainActor
func observeNotesByFolder(in context: ModelContext) throws -> ResultsObserver<Note, String> {
    fatalError()
}

@MainActor
func folderNames(in observer: ResultsObserver<Note, String>) -> [String] {
    fatalError()
}

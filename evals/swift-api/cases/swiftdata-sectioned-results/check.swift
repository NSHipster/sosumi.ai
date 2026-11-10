import SwiftData

@Model final class Note {
    var title: String
    var folder: String

    init(title: String, folder: String) {
        self.title = title
        self.folder = folder
    }
}

@MainActor
func checkObserveNotes(context: ModelContext) throws {
    let observer: ResultsObserver<Note, String> = try observeNotesByFolder(in: context)
    let names: [String] = folderNames(in: observer)
    _ = names
}

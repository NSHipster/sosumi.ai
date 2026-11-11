import Foundation
import SwiftData

@MainActor
func observeNotesByFolder(in context: ModelContext) throws -> ResultsObserver<Note, String> {
    try ResultsObserver(
        sortBy: [SortDescriptor(\Note.title)],
        sectionBy: \Note.folder,
        modelContext: context
    )
}

@MainActor
func folderNames(in observer: ResultsObserver<Note, String>) -> [String] {
    observer.sections?.sectionTitles ?? []
}

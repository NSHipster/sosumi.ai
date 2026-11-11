import Foundation
import SwiftData

// Fetches once and groups by hand, as before ResultsObserver.
@MainActor
func observeNotesByFolder(in context: ModelContext) throws -> ResultsObserver<Note, String> {
    let notes = try context.fetch(FetchDescriptor<Note>(sortBy: [SortDescriptor(\.title)]))
    return ResultsObserver(Dictionary(grouping: notes, by: \.folder))
}

@MainActor
func folderNames(in observer: ResultsObserver<Note, String>) -> [String] {
    observer.keys.sorted()
}

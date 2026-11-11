import Foundation

// Treats the progress value like an NSProgress object.
func importFiles(
    _ urls: [URL],
    progress: consuming Subprogress,
    importOne: (URL) async throws -> Void
) async throws {
    progress.totalUnitCount = Int64(urls.count)
    for url in urls {
        try await importOne(url)
        progress.completedUnitCount += 1
    }
}

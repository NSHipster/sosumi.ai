import Foundation

func importFiles(
    _ urls: [URL],
    progress: consuming Subprogress,
    importOne: (URL) async throws -> Void
) async throws {
    let manager = progress.start(totalCount: urls.count)
    for url in urls {
        try await importOne(url)
        manager.complete(count: 1)
    }
}

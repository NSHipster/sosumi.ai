import Foundation

func checkImportFiles(urls: [URL]) async throws {
    let overall = ProgressManager(totalCount: 1)
    try await importFiles(urls, progress: overall.subprogress(assigningCount: 1)) { url in
        _ = url
    }
    _ = overall.fractionCompleted
}

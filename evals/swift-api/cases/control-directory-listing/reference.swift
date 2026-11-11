import Foundation

func swiftFiles(in directory: URL) throws -> [URL] {
    try FileManager.default
        .contentsOfDirectory(
            at: directory,
            includingPropertiesForKeys: nil,
            options: .skipsHiddenFiles
        )
        .filter { $0.pathExtension == "swift" }
}

import Foundation

// Omits the required property-keys argument.
func swiftFiles(in directory: URL) throws -> [URL] {
    try FileManager.default
        .contentsOfDirectory(at: directory, options: .skipsHiddenFiles)
        .filter { $0.pathExtension == "swift" }
}

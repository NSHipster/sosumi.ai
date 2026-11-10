import Foundation

func checkSwiftFiles() throws {
    let files: [URL] = try swiftFiles(in: URL(filePath: "/tmp", directoryHint: .isDirectory))
    _ = files
}

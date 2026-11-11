import Foundation

func checkStatusCode() async throws {
    let code: Int? = try await statusCode(of: URL(filePath: "/tmp"))
    _ = code
}

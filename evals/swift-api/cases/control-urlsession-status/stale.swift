import Foundation

// Passes a URL where the request-based method expects a URLRequest.
func statusCode(of url: URL) async throws -> Int? {
    let (_, response) = try await URLSession.shared.data(for: url)
    return (response as? HTTPURLResponse)?.statusCode
}

import Foundation

func statusCode(of url: URL) async throws -> Int? {
    let (_, response) = try await URLSession.shared.data(from: url)
    return (response as? HTTPURLResponse)?.statusCode
}

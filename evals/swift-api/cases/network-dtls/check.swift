import Foundation
import Network

func checkMakeGameConnection() async throws {
    let connection: NetworkConnection<DTLS> = makeGameConnection(host: "game.example.com", port: 4433)
    try await connection.send(Data([1, 2, 3]))
}

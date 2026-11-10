import Foundation
import NowPlaying

@MainActor protocol AudioPlayer: AnyObject {
    func play() async throws
    func pause() async throws
    func skip(by seconds: TimeInterval) async throws
}

@MainActor
func checkTransportCommands(player: any AudioPlayer) {
    let commands: [MediaCommand] = transportCommands(for: player)
    _ = commands.count
}

import Foundation
import MediaPlayer
import NowPlaying

// Registers remote command handlers, as with MPRemoteCommandCenter.
@MainActor
func transportCommands(for player: any AudioPlayer) -> [MediaCommand] {
    let center = MPRemoteCommandCenter.shared()
    center.playCommand.addTarget { _ in
        Task { try? await player.play() }
        return .success
    }
    center.pauseCommand.addTarget { _ in
        Task { try? await player.pause() }
        return .success
    }
    center.skipForwardCommand.preferredIntervals = [30]
    center.skipBackwardCommand.preferredIntervals = [15]
    return [center.playCommand, center.pauseCommand, center.skipForwardCommand, center.skipBackwardCommand]
}

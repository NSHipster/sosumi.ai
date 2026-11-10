import Foundation
import NowPlaying

@MainActor
func transportCommands(for player: any AudioPlayer) -> [MediaCommand] {
    [
        .play { try await player.play() },
        .pause { try await player.pause() },
        .skipForward(preferredIntervals: [30]) { interval in
            try await player.skip(by: interval)
        },
        .skipBackward(preferredIntervals: [15]) { interval in
            try await player.skip(by: -interval)
        },
    ]
}

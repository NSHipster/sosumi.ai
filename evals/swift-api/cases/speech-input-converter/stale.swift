import AVFoundation
import Speech

// Uses the framework converter without an availability check.
func analyzerInputs(
    from buffer: AVAudioPCMBuffer,
    for transcriber: SpeechTranscriber
) async throws -> [AnalyzerInput] {
    let converter = try await AnalyzerInputConverter.converter(compatibleWith: [transcriber])
    return try converter.convert(buffer, at: nil)
}

import AVFoundation
import Speech

func analyzerInputs(
    from buffer: AVAudioPCMBuffer,
    for transcriber: SpeechTranscriber
) async throws -> [AnalyzerInput] {
    if #available(macOS 27.0, *) {
        let converter = try await AnalyzerInputConverter.converter(compatibleWith: [transcriber])
        return try converter.convert(buffer, at: nil)
    }
    guard let format = await SpeechAnalyzer.bestAvailableAudioFormat(compatibleWith: [transcriber]),
          let converter = AVAudioConverter(from: buffer.format, to: format),
          let output = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: buffer.frameCapacity)
    else {
        return []
    }
    try converter.convert(to: output, from: buffer)
    return [AnalyzerInput(buffer: output)]
}

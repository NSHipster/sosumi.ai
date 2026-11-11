import AVFoundation
import Speech

func checkAnalyzerInputs(buffer: AVAudioPCMBuffer) async throws {
    let transcriber = SpeechTranscriber(locale: Locale(identifier: "en-US"), preset: .transcription)
    let inputs: [AnalyzerInput] = try await analyzerInputs(from: buffer, for: transcriber)
    _ = inputs.count
}

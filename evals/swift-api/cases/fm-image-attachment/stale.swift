import CoreGraphics
import FoundationModels

// Uses a capability flag and segment case that the SDK does not declare.
func imageSegment(for image: CGImage, model: SystemLanguageModel) -> Transcript.Segment? {
    guard model.supportsImageInput else {
        return nil
    }
    return .image(Transcript.ImageSegment(image))
}

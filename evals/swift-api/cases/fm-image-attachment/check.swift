import CoreGraphics
import FoundationModels

func checkImageSegment(image: CGImage) {
    let segment: Transcript.Segment? = imageSegment(for: image, model: .default)
    _ = segment
}

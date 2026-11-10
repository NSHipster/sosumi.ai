import CoreGraphics
import FoundationModels

func imageSegment(for image: CGImage, model: SystemLanguageModel) -> Transcript.Segment? {
    guard model.capabilities.contains(.vision) else {
        return nil
    }
    let attachment = Transcript.AttachmentSegment(
        content: .image(Transcript.ImageAttachment(image))
    )
    return .attachment(attachment)
}

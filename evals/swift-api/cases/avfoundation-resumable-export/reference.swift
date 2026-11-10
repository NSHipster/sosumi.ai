import AVFoundation

func prepareResumableExport(_ session: AVAssetExportSession) async -> String? {
    switch await session.configureForResumableExport() {
    case .resumable:
        return nil
    case .notResumable(let failureReason):
        return String(describing: failureReason)
    @unknown default:
        return "Unknown resumption state"
    }
}

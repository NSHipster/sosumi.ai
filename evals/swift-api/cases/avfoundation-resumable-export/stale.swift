import AVFoundation

// Treats resumable export as a Boolean property on the session.
func prepareResumableExport(_ session: AVAssetExportSession) async -> String? {
    session.allowsResumableExport = true
    return session.canResumeExport ? nil : "Export cannot resume"
}

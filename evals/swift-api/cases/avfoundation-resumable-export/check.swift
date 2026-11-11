import AVFoundation

func checkPrepareResumableExport(session: AVAssetExportSession) async {
    let reason: String? = await prepareResumableExport(session)
    _ = reason
}

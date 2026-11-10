import MetricKit

// Uses the MXDiagnosticPayload shape from the Objective-C API.
func nextCrashSignal(from manager: MetricManager) async -> Int? {
    for await payload in manager.diagnosticPayloads {
        return payload.crashDiagnostics?.first?.signal?.intValue
    }
    return nil
}

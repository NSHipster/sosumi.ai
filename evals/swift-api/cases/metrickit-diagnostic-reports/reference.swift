import MetricKit

func nextCrashSignal(from manager: MetricManager) async -> Int? {
    for await report in manager.diagnosticReports {
        if case .crash(let crash) = report.result {
            return crash.signal
        }
        return nil
    }
    return nil
}

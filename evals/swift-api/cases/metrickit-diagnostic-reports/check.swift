import MetricKit

func checkNextCrashSignal() async {
    let manager = MetricManager()
    let signal: Int? = await nextCrashSignal(from: manager)
    _ = signal
}

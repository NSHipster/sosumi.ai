import Observation

@MainActor
func observeValue(
    of counter: Counter,
    onChange: @escaping @Sendable (Int) -> Void
) -> ObservationTracking.Token {
    withContinuousObservation(options: [.didSet]) { event in
        guard event.kind == .didSet else {
            _ = counter.value
            return
        }
        onChange(counter.value)
    }
}

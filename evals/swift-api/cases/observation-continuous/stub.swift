import Observation

@MainActor
func observeValue(
    of counter: Counter,
    onChange: @escaping @Sendable (Int) -> Void
) -> ObservationTracking.Token {
    fatalError()
}

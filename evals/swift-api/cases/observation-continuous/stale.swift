import Observation

// Re-registers withObservationTracking after each change, as before OS 27.
@MainActor
func observeValue(
    of counter: Counter,
    onChange: @escaping @Sendable (Int) -> Void
) -> ObservationTracking.Token {
    withObservationTracking {
        _ = counter.value
    } onChange: {
        Task { @MainActor in
            onChange(counter.value)
        }
    }
}

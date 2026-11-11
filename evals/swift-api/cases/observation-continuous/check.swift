import Observation

@MainActor @Observable final class Counter {
    var value: Int
    init(value: Int) {
        self.value = value
    }
}

@MainActor
func checkObserveValue() {
    let counter = Counter(value: 0)
    let token = observeValue(of: counter) { newValue in
        _ = newValue
    }
    counter.value += 1
    token.cancel()
}

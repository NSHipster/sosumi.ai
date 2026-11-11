import FoundationModels

struct SessionSetting<Value> {
    init(_ keyPath: ReferenceWritableKeyPath<SessionPropertyValues, Value>) {
        fatalError()
    }

    var value: Value {
        get { fatalError() }
        nonmutating set { fatalError() }
    }
}

extension SessionSetting: Sendable where Value: Sendable {}

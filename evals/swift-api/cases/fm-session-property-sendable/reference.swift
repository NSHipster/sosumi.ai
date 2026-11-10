import FoundationModels

struct SessionSetting<Value> {
    private let property: LanguageModelSession.SessionProperty<Value>

    init(_ keyPath: ReferenceWritableKeyPath<SessionPropertyValues, Value>) {
        property = LanguageModelSession.SessionProperty(keyPath)
    }

    var value: Value {
        get { property.wrappedValue }
        nonmutating set { property.wrappedValue = newValue }
    }
}

extension SessionSetting: Sendable where Value: Sendable {}

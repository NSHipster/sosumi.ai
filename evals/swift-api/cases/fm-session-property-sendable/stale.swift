import FoundationModels

// Trusts documentation that lists SessionProperty as unconditionally Sendable.
struct SessionSetting<Value>: Sendable {
    private let property: LanguageModelSession.SessionProperty<Value>

    init(_ keyPath: ReferenceWritableKeyPath<SessionPropertyValues, Value>) {
        property = LanguageModelSession.SessionProperty(keyPath)
    }

    var value: Value {
        get { property.wrappedValue }
        nonmutating set { property.wrappedValue = newValue }
    }
}

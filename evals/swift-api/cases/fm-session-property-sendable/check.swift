import FoundationModels

final class ScratchPad {
    var notes: [String] = []
}

func requireSendable<T: Sendable>(_: T.Type) {}

func checkSessionSetting(
    _ title: ReferenceWritableKeyPath<SessionPropertyValues, String>,
    _ scratch: ReferenceWritableKeyPath<SessionPropertyValues, ScratchPad>
) async {
    requireSendable(SessionSetting<String>.self)
    let setting = SessionSetting(title)
    let current: String = setting.value
    setting.value = current + "!"
    await Task.detached {
        _ = setting.value
    }.value

    let pad = SessionSetting<ScratchPad>(scratch)
    let notes: [String] = pad.value.notes
    _ = notes
}

import FoundationModels

func requireExecutor<M: LanguageModel, E>(_: M.Type, _: E.Type) where M.Executor == E {}

func checkEchoModel() {
    requireExecutor(EchoModel.self, EchoExecutor.self)
    let model = EchoModel()
    let session = LanguageModelSession(model: model)
    _ = session
}

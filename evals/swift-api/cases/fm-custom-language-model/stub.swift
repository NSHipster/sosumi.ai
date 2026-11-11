import FoundationModels

struct EchoModel: LanguageModel {
    typealias Executor = EchoExecutor
    init() {}
    var capabilities: LanguageModelCapabilities { fatalError() }
    var executorConfiguration: EchoExecutor.Configuration { fatalError() }
}

struct EchoExecutor: LanguageModelExecutor {
    struct Configuration: Hashable, Sendable {}
    init(configuration: Configuration) throws { fatalError() }
    nonisolated(nonsending) func respond(
        to request: LanguageModelExecutorGenerationRequest,
        model: EchoModel,
        streamingInto channel: LanguageModelExecutorGenerationChannel
    ) async throws {
        fatalError()
    }
}

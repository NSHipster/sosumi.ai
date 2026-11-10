import FoundationModels

struct EchoModel: LanguageModel {
    typealias Executor = EchoExecutor

    init() {}

    var capabilities: LanguageModelCapabilities {
        LanguageModelCapabilities([])
    }

    var executorConfiguration: EchoExecutor.Configuration {
        EchoExecutor.Configuration()
    }
}

struct EchoExecutor: LanguageModelExecutor {
    struct Configuration: Hashable, Sendable {}

    init(configuration: Configuration) throws {}

    nonisolated(nonsending) func respond(
        to request: LanguageModelExecutorGenerationRequest,
        model: EchoModel,
        streamingInto channel: LanguageModelExecutorGenerationChannel
    ) async throws {
        await channel.send(.response(action: .appendText("Hello", tokenCount: 1)))
    }
}

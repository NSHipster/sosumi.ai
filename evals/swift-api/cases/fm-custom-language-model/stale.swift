import FoundationModels

// Assumes a simple request/response protocol, as in older third-party wrappers.
struct EchoModel: LanguageModel {
    init() {}

    func respond(to prompt: Prompt) async throws -> String {
        "Hello"
    }
}

struct EchoExecutor {}

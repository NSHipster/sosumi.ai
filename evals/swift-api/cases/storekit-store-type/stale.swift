import StoreKit

// Confuses the store type with the App Store environment.
func isEducationPurchase() async throws -> Bool {
    let result = try await AppTransaction.shared
    guard case .verified(let transaction) = result else {
        return false
    }
    return transaction.environment == .education
}

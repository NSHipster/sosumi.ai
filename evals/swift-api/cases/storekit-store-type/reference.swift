import StoreKit

func isEducationPurchase() async throws -> Bool {
    let result = try await AppTransaction.shared
    guard case .verified(let transaction) = result else {
        return false
    }
    return transaction.storeType == .education
}

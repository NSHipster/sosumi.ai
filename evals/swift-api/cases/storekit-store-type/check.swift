import StoreKit

func checkIsEducationPurchase() async throws {
    let education: Bool = try await isEducationPurchase()
    _ = education
}

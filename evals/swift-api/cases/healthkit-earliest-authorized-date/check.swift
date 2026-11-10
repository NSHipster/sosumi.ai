import Foundation
import HealthKit

func checkEarliestReadableDate(store: HKHealthStore) async throws {
    let type: HKObjectType = HKQuantityType(.stepCount)
    let date: Date? = try await earliestReadableDate(for: type, in: store)
    _ = date
}

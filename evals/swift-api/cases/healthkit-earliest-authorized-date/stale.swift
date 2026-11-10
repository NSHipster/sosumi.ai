import Foundation
import HealthKit

// Calls the per-type API without an availability check.
func earliestReadableDate(for type: HKObjectType, in store: HKHealthStore) async throws -> Date? {
    let dates = try await store.earliestAuthorizedSampleDate(for: [type])
    return dates[type]
}

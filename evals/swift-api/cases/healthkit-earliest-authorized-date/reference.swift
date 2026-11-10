import Foundation
import HealthKit

func earliestReadableDate(for type: HKObjectType, in store: HKHealthStore) async throws -> Date? {
    if #available(macOS 27.0, *) {
        let dates = try await store.earliestAuthorizedSampleDate(for: [type])
        return dates[type]
    }
    return store.earliestPermittedSampleDate()
}

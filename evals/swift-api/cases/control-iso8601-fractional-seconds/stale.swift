import Foundation

// Misnames the formatter options.
func parseTimestamp(_ string: String) -> Date? {
    let formatter = ISO8601DateFormatter()
    formatter.formatOptions = [.internetDateTime, .fractionalSeconds]
    return formatter.date(from: string)
}

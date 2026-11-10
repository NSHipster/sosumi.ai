import os

// Passes a Logger to the older os_log function, which expects an OSLog.
func logSignIn(user: String, to logger: Logger) {
    os_log("Signed in: %{private}@", log: logger, type: .info, user)
}

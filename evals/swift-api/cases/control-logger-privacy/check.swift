import os

func checkLogSignIn() {
    let logger = Logger(subsystem: "com.example.app", category: "auth")
    logSignIn(user: "jappleseed", to: logger)
}

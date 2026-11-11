# Log a sign-in without exposing the user name

- Platform: macOS
- Deployment target: macOS 27.0 (`arm64-apple-macos27.0`)
- Framework: os (unified logging)
- Language mode: Swift 6

An app logs each sign-in at the informational level
with the message `Signed in: ` followed by the user name.
The user name must not appear in logs that are collected from customer devices:
mark the interpolated value as private.

Declare:

```swift
func logSignIn(user: String, to logger: Logger)
```

Implement the behavior completely.
Do not use placeholder bodies such as `fatalError()`.

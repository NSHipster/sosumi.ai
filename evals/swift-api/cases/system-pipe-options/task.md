# Create a pipe that child processes do not inherit

- Platform: macOS
- Deployment target: macOS 27.0 (`arm64-apple-macos27.0`)
- Framework: System

A process launcher creates a pipe to read a helper's output.
Both ends of the pipe must be closed automatically when the process executes
another program, so that unrelated children do not inherit them.
The launcher reports failures as `Errno` values with typed throws,
and it must set the flag atomically when the pipe is created.

Declare:

```swift
func makePrivatePipe() throws(Errno) -> (readEnd: FileDescriptor, writeEnd: FileDescriptor)
```

Implement the behavior completely.
Do not use placeholder bodies such as `fatalError()`.

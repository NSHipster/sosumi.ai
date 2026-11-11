import Darwin
import System

// Creates the pipe first and sets FD_CLOEXEC afterward.
func makePrivatePipe() throws(Errno) -> (readEnd: FileDescriptor, writeEnd: FileDescriptor) {
    let pipe = try FileDescriptor.pipe()
    _ = fcntl(pipe.readEnd.rawValue, F_SETFD, FD_CLOEXEC)
    _ = fcntl(pipe.writeEnd.rawValue, F_SETFD, FD_CLOEXEC)
    return pipe
}

import System

func checkMakePrivatePipe() {
    do {
        let pipe = try makePrivatePipe()
        let read: FileDescriptor = pipe.readEnd
        let write: FileDescriptor = pipe.writeEnd
        _ = (read, write)
    } catch {
        let code: Errno = error
        _ = code
    }
}

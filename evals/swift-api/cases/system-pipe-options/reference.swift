import System

func makePrivatePipe() throws(Errno) -> (readEnd: FileDescriptor, writeEnd: FileDescriptor) {
    try FileDescriptor.pipe(options: .closeOnExec)
}

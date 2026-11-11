func checkReadLength(buffer: [UInt8]) {
    let length: UInt32 = readLength(in: buffer.span.bytes, at: 4)
    _ = length
}

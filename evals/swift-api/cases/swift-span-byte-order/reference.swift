func readLength(in bytes: RawSpan, at offset: Int) -> UInt32 {
    if #available(macOS 27.0, *) {
        return bytes.load(fromByteOffset: offset, as: UInt32.self, .bigEndian)
    }
    return UInt32(bigEndian: unsafe bytes.unsafeLoadUnaligned(fromByteOffset: offset, as: UInt32.self))
}

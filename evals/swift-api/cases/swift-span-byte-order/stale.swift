// Uses the byte-order overload without an availability check.
func readLength(in bytes: RawSpan, at offset: Int) -> UInt32 {
    bytes.load(fromByteOffset: offset, as: UInt32.self, .bigEndian)
}

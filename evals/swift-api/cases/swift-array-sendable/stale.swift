// Declares the conformance unconditionally, as if Array were always Sendable.
struct Page<Item>: Sendable {
    var items: [Item]
    var nextCursor: String?

    init(items: [Item], nextCursor: String?) {
        self.items = items
        self.nextCursor = nextCursor
    }
}

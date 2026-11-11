struct Page<Item> {
    var items: [Item]
    var nextCursor: String?

    init(items: [Item], nextCursor: String?) {
        self.items = items
        self.nextCursor = nextCursor
    }
}

extension Page: Sendable where Item: Sendable {}

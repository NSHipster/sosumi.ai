struct Page<Item> {
    var items: [Item]
    var nextCursor: String?

    init(items: [Item], nextCursor: String?) {
        fatalError()
    }
}

extension Page: Sendable where Item: Sendable {}

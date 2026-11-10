import Foundation

func requireSendable<T: Sendable>(_: T.Type) {}

struct Reading: Sendable {
    var value: Double
}

func checkPage() async {
    requireSendable(Page<Reading>.self)
    let page = Page(items: [Reading(value: 1)], nextCursor: "abc")
    let count = await Task.detached { page.items.count }.value
    _ = count

    var names = Page<NSMutableString>(items: [NSMutableString(string: "a")], nextCursor: nil)
    names.items.append(NSMutableString(string: "b"))
    let cursor: String? = names.nextCursor
    _ = cursor
}

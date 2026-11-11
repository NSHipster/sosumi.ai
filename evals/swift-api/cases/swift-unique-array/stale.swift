// Builds a standard Array first, which cannot hold noncopyable elements.
func issueTickets(count: Int) -> UniqueArray<Ticket> {
    var tickets: [Ticket] = []
    for number in 0..<count {
        tickets.append(Ticket(number: number))
    }
    return UniqueArray(tickets)
}

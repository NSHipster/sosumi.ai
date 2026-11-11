func issueTickets(count: Int) -> UniqueArray<Ticket> {
    var tickets = UniqueArray<Ticket>(capacity: count)
    for number in 0..<count {
        tickets.append(Ticket(number: number))
    }
    return tickets
}

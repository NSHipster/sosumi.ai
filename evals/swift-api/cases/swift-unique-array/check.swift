struct Ticket: ~Copyable {
    let number: Int
}

func checkIssueTickets() {
    let tickets: UniqueArray<Ticket> = issueTickets(count: 3)
    let first: Int = tickets[0].number
    _ = first
    _ = tickets.count
}

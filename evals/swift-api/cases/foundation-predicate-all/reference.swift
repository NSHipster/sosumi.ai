import Foundation

func matchingAll(_ filters: [Predicate<Product>]) -> Predicate<Product> {
    Predicate(all: filters)
}

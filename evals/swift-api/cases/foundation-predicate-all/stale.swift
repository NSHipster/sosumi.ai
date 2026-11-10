import Foundation

// Calls a closure-based collection method inside the predicate macro.
func matchingAll(_ filters: [Predicate<Product>]) -> Predicate<Product> {
    #Predicate<Product> { product in
        filters.allSatisfy { filter in
            (try? filter.evaluate(product)) ?? false
        }
    }
}

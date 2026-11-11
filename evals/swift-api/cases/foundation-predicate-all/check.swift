import Foundation

struct Product {
    var price: Double
    var inStock: Bool
}

func checkMatchingAll() throws {
    let cheap = #Predicate<Product> { $0.price < 10 }
    let available = #Predicate<Product> { $0.inStock }
    let combined: Predicate<Product> = matchingAll([cheap, available])
    _ = try combined.evaluate(Product(price: 5, inStock: true))
}

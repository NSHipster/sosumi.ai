# Combine a list of filters into one predicate

- Platform: macOS
- Deployment target: macOS 27.0 (`arm64-apple-macos27.0`)
- Framework: Foundation
- Language mode: Swift 6

A product search screen lets the user add any number of filters.
Each filter is a Foundation `Predicate`.
The app needs one predicate that matches a product
only when the product matches every filter in the list.
The check file declares the product type:

```swift
struct Product {
    var price: Double
    var inStock: Bool
}
```

Declare:

```swift
func matchingAll(_ filters: [Predicate<Product>]) -> Predicate<Product>
```

Implement the behavior completely.
Do not use placeholder bodies such as `fatalError()`.

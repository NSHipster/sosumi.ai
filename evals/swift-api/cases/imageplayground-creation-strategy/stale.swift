import ImagePlayground

// Sets the creation strategy without an availability check.
func editingOptions() -> ImagePlaygroundOptions {
    var options = ImagePlaygroundOptions()
    options.creationStrategy = .editExisting
    return options
}

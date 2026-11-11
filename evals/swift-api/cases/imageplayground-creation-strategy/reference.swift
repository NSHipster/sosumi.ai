import ImagePlayground

func editingOptions() -> ImagePlaygroundOptions {
    var options = ImagePlaygroundOptions()
    if #available(macOS 27.0, *) {
        options.creationStrategy = .editExisting
    }
    return options
}

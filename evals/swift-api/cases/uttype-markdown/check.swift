import UniformTypeIdentifiers

func checkMarkdownType() {
    let type: UTType = markdownType()
    _ = type.conforms(to: .text)
}

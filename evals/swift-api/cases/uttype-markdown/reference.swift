import UniformTypeIdentifiers

func markdownType() -> UTType {
    if #available(macOS 27.0, *) {
        return .markdown
    }
    return UTType(importedAs: "net.daringfireball.markdown")
}

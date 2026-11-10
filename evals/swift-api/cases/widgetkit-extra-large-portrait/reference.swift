import WidgetKit

func calendarWidgetFamilies() -> [WidgetFamily] {
    var families: [WidgetFamily] = [.systemSmall, .systemMedium, .systemLarge]
    if #available(macOS 27.0, *) {
        families.append(.systemExtraLargePortrait)
    }
    return families
}

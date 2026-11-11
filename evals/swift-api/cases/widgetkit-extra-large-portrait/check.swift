import WidgetKit

func checkCalendarWidgetFamilies() {
    let families: [WidgetFamily] = calendarWidgetFamilies()
    _ = families.contains(.systemSmall)
}

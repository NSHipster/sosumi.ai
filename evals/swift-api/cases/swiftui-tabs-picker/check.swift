import SwiftUI

enum InspectorMode: String, CaseIterable, Identifiable {
    case layout, style, data
    var id: Self { self }
}

struct CheckInspector: View {
    @State private var mode = InspectorMode.layout

    var body: some View {
        ModePicker(selection: $mode)
    }
}

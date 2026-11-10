import SwiftUI

// Uses the tab picker style without an availability check.
struct ModePicker: View {
    @Binding var selection: InspectorMode

    init(selection: Binding<InspectorMode>) {
        _selection = selection
    }

    var body: some View {
        Picker("Mode", selection: $selection) {
            ForEach(InspectorMode.allCases) { mode in
                Text(mode.rawValue).tag(mode)
            }
        }
        .pickerStyle(.tabs)
    }
}

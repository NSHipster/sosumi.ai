import SwiftUI

struct ModePicker: View {
    @Binding var selection: InspectorMode

    init(selection: Binding<InspectorMode>) {
        _selection = selection
    }

    var body: some View {
        if #available(macOS 27.0, *) {
            picker.pickerStyle(.tabs)
        } else {
            picker.pickerStyle(.segmented)
        }
    }

    private var picker: some View {
        Picker("Mode", selection: $selection) {
            ForEach(InspectorMode.allCases) { mode in
                Text(mode.rawValue).tag(mode)
            }
        }
    }
}

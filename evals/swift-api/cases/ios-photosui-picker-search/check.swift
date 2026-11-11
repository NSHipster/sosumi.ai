import PhotosUI

func checkPhotoPickerConfiguration() {
    let configuration: PHPickerConfiguration = photoPickerConfiguration(searchingFor: "Lisbon")
    _ = configuration.selectionLimit
}

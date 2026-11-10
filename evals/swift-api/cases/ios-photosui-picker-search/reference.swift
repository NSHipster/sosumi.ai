import PhotosUI

func photoPickerConfiguration(searchingFor destination: String) -> PHPickerConfiguration {
    var configuration = PHPickerConfiguration()
    configuration.filter = .images
    configuration.searchText = PHPickerSearchText(destination)
    return configuration
}

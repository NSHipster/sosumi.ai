import PhotosUI

// Assigns the plain string to the search property.
func photoPickerConfiguration(searchingFor destination: String) -> PHPickerConfiguration {
    var configuration = PHPickerConfiguration()
    configuration.filter = .images
    configuration.searchText = destination
    return configuration
}

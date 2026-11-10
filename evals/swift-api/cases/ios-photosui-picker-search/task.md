# Open the photo picker with a search already filled in

- Platform: iOS
- Deployment target: iOS 27.0 (`arm64-apple-ios27.0`)
- Framework: PhotosUI
- Language mode: Swift 6

A travel journal app lets the user add photos to a trip.
It opens the system photo picker showing only images,
with the picker's search already filled in with the trip's destination,
so the user starts from matching photos.

Declare:

```swift
func photoPickerConfiguration(searchingFor destination: String) -> PHPickerConfiguration
```

Implement the behavior completely.
Do not use placeholder bodies such as `fatalError()`.

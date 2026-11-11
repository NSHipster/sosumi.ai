import CoreData

func remoteChanges(
    of coordinator: NSPersistentStoreCoordinator
) -> some AsyncSequence<NSPersistentStoreCoordinator.RemoteChangeMessage, Never> {
    NotificationCenter.default.messages(of: coordinator, for: .remoteChange)
}

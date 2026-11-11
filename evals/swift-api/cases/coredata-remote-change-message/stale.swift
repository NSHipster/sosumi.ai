import CoreData

// Observes the untyped notification, as before typed messages.
func remoteChanges(
    of coordinator: NSPersistentStoreCoordinator
) -> some AsyncSequence<NSPersistentStoreCoordinator.RemoteChangeMessage, Never> {
    NotificationCenter.default.notifications(named: .NSPersistentStoreRemoteChange, object: coordinator)
}

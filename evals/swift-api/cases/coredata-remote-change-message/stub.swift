import CoreData

func remoteChanges(
    of coordinator: NSPersistentStoreCoordinator
) -> some AsyncSequence<NSPersistentStoreCoordinator.RemoteChangeMessage, Never> {
    fatalError()
}

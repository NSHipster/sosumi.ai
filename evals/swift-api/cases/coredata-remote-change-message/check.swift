import CoreData

func checkRemoteChanges(coordinator: NSPersistentStoreCoordinator) async {
    for await message in remoteChanges(of: coordinator) {
        let token: NSPersistentHistoryToken? = message.historyToken
        let url: URL = message.storeURL
        _ = (token, url)
    }
}

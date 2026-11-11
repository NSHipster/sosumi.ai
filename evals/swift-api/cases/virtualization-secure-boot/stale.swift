import Virtualization

// Reads the property as if it could not fail.
func secureBootBadge(for store: VZEFIVariableStore) -> Bool? {
    store.isSecureBootEnabled
}

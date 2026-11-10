import Virtualization

func secureBootBadge(for store: VZEFIVariableStore) -> Bool? {
    try? store.isSecureBootEnabled
}

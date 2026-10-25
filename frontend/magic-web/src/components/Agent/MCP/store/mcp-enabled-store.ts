type Listener = () => void

const listeners = new Set<Listener>()
let enabledIds = new Set<string>()
let snapshot = ""

function emit() {
	listeners.forEach((listener) => listener())
}

function updateSnapshot(next: Set<string>) {
	const nextSnapshot = [...next].sort().join(",")
	if (nextSnapshot === snapshot) return
	enabledIds = next
	snapshot = nextSnapshot
	emit()
}

/**
 * Session mirror of the project-scoped MCP usage state.
 * Persistence is performed by MCPStore; this mirror keeps mention results reactive.
 */
export const mcpEnabledStore = {
	getSnapshot() {
		return snapshot
	},

	subscribe(listener: Listener) {
	listeners.add(listener)
		return () => listeners.delete(listener)
	},

	getIds() {
		return new Set(enabledIds)
	},

	setEnabled(id: string, enabled: boolean) {
		const next = new Set(enabledIds)
		if (enabled) next.add(id)
		else next.delete(id)
		updateSnapshot(next)
	},

	setEnabledIds(ids: Iterable<string>) {
		updateSnapshot(new Set(ids))
	},

	syncAvailable(ids: Iterable<string>) {
		const availableIds = new Set(ids)
		updateSnapshot(new Set([...enabledIds].filter((id) => availableIds.has(id))))
	},
}

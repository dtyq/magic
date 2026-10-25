type WorkspaceSearchInvalidationListener = () => void

const listeners = new Set<WorkspaceSearchInvalidationListener>()

/**
 * Sidebar search keeps an independent snapshot of matches.
 * Subscribe so the search list can refetch after a mutation finishes.
 */
export function subscribeWorkspaceSearchInvalidation(
	listener: WorkspaceSearchInvalidationListener,
) {
	listeners.add(listener)
	return () => {
		listeners.delete(listener)
	}
}

/** Notify search views after a workspace/project mutation API has succeeded. */
export function invalidateWorkspaceSearchResults() {
	listeners.forEach((listener) => listener())
}

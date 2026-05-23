import type { SharedWorkspaceTab, SharedWorkspaceTabState } from "../types"

/**
 * Builds the default per-tab bucket used before any list request resolves.
 */
export function createInitialTabState(): SharedWorkspaceTabState {
	return {
		projects: [],
		total: 0,
		currentPage: 1,
		isLoading: false,
		isLoadingMore: false,
	}
}

/**
 * Initializes independent list buckets for every shared-workspace tab.
 */
export function createInitialTabStateMap(): Record<SharedWorkspaceTab, SharedWorkspaceTabState> {
	return {
		sharedWithMe: createInitialTabState(),
		sharedByMe: createInitialTabState(),
	}
}

/**
 * Computes whether InfiniteScroll should request the next page for the active tab.
 */
export function resolveSharedWorkspaceHasMore({
	projectsLength,
	total,
	isLoading,
	isLoadingMore,
	hasActiveSearchOrFilter,
}: {
	projectsLength: number
	total: number
	isLoading: boolean
	isLoadingMore: boolean
	hasActiveSearchOrFilter: boolean
}) {
	if (hasActiveSearchOrFilter) return false
	if (isLoading || isLoadingMore) return false
	return projectsLength < total
}

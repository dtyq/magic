import type { SharedWorkspaceProject, SharedWorkspaceTab, SharedWorkspaceTabState } from "../types"

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

/**
 * Appends one fetched page onto a tab bucket.
 *
 * When the backend returns an empty list (e.g. `total` is inconsistent with the
 * actual paginated rows), collapsing `total` to the already-loaded length stops
 * `resolveSharedWorkspaceHasMore` from signalling another page and breaks the
 * InfiniteScroll request loop.
 */
export function appendSharedWorkspacePage(
	current: SharedWorkspaceTabState,
	list: SharedWorkspaceProject[],
	total: number,
): SharedWorkspaceTabState {
	if (list.length === 0) {
		return {
			...current,
			total: current.projects.length,
			isLoadingMore: false,
		}
	}

	return {
		...current,
		projects: [...current.projects, ...list],
		total,
		currentPage: current.currentPage + 1,
		isLoadingMore: false,
	}
}

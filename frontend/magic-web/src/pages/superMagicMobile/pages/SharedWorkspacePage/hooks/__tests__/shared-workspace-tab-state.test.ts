import { describe, expect, it } from "vitest"

import {
	createInitialTabState,
	createInitialTabStateMap,
	resolveSharedWorkspaceHasMore,
} from "../shared-workspace-tab-state"

describe("createInitialTabStateMap", () => {
	it("keeps independent buckets for each tab", () => {
		const map = createInitialTabStateMap()

		map.sharedWithMe.projects = [{ id: "a" } as never]
		map.sharedWithMe.total = 10

		expect(map.sharedByMe.projects).toEqual([])
		expect(map.sharedByMe.total).toBe(0)
	})
})

describe("createInitialTabState", () => {
	it("starts with empty list and idle loading flags", () => {
		expect(createInitialTabState()).toEqual({
			projects: [],
			total: 0,
			currentPage: 1,
			isLoading: false,
			isLoadingMore: false,
		})
	})
})

describe("resolveSharedWorkspaceHasMore", () => {
	it("returns false while the active tab is loading", () => {
		expect(
			resolveSharedWorkspaceHasMore({
				projectsLength: 0,
				total: 100,
				isLoading: true,
				isLoadingMore: false,
				hasActiveSearchOrFilter: false,
			}),
		).toBe(false)
	})

	it("returns false when search or filter is active", () => {
		expect(
			resolveSharedWorkspaceHasMore({
				projectsLength: 10,
				total: 100,
				isLoading: false,
				isLoadingMore: false,
				hasActiveSearchOrFilter: true,
			}),
		).toBe(false)
	})

	it("returns true only when more items exist and pagination is idle", () => {
		expect(
			resolveSharedWorkspaceHasMore({
				projectsLength: 50,
				total: 100,
				isLoading: false,
				isLoadingMore: false,
				hasActiveSearchOrFilter: false,
			}),
		).toBe(true)
	})
})

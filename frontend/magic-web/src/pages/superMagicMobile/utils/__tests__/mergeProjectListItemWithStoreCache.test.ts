import { beforeEach, describe, expect, it, vi } from "vitest"
import type { ProjectListItem } from "@/pages/superMagic/pages/Workspace/types"

const getProjectsByWorkspaceMock = vi.fn()
const selectedProjectRef: { current: ProjectListItem | null } = { current: null }

vi.mock("@/pages/superMagic/stores/core", () => ({
	projectStore: {
		get getProjectsByWorkspace() {
			return getProjectsByWorkspaceMock
		},
		get selectedProject() {
			return selectedProjectRef.current
		},
	},
}))

import { mergeProjectListItemWithStoreCache } from "../mergeProjectListItemWithStoreCache"

describe("mergeProjectListItemWithStoreCache", () => {
	beforeEach(() => {
		getProjectsByWorkspaceMock.mockReset()
		selectedProjectRef.current = null
	})

	it("returns null when project is missing", () => {
		expect(mergeProjectListItemWithStoreCache(null)).toBeNull()
	})

	it("fills user_role from workspace cache when recent row omits it", () => {
		const recentRow = {
			id: "p-1",
			workspace_id: "ws-1",
			project_name: "测试项目",
		} as ProjectListItem

		getProjectsByWorkspaceMock.mockReturnValue([
			{
				id: "p-1",
				workspace_id: "ws-1",
				project_name: "测试项目",
				user_role: "owner",
			},
		])

		const merged = mergeProjectListItemWithStoreCache(recentRow)

		expect(merged?.user_role).toBe("owner")
	})

	it("prefers selectedProject role when ids match", () => {
		const recentRow = {
			id: "p-1",
			workspace_id: "ws-1",
			project_name: "测试项目",
		} as ProjectListItem

		getProjectsByWorkspaceMock.mockReturnValue([])
		selectedProjectRef.current = {
			id: "p-1",
			workspace_id: "ws-1",
			project_name: "测试项目",
			user_role: "owner",
		} as ProjectListItem

		const merged = mergeProjectListItemWithStoreCache(recentRow)

		expect(merged?.user_role).toBe("owner")
	})

	it("prefers workspace cache row that already has user_role", () => {
		const recentRow = {
			id: "p-1",
			workspace_id: "ws-1",
			project_name: "测试项目",
		} as ProjectListItem

		getProjectsByWorkspaceMock.mockReturnValue([
			{ id: "p-1", workspace_id: "ws-1", project_name: "old" } as ProjectListItem,
			{
				id: "p-1",
				workspace_id: "ws-1",
				project_name: "测试项目",
				user_role: "owner",
			} as ProjectListItem,
		])

		const merged = mergeProjectListItemWithStoreCache(recentRow)

		expect(merged?.user_role).toBe("owner")
	})
})

import { describe, expect, it } from "vitest"
import { RouteName } from "@/routes/constants"
import {
	resolvePostMoveBackFallback,
	resolveSuperMobileBackFallbackByRoute,
	resolveSuperMobileProjectDetailBackFallback,
	shouldExitChatDetailAfterDelete,
	shouldExitDetailPageAfterDelete,
	shouldExitDetailPageAfterTransfer,
	shouldExitPageAfterProjectMove,
	shouldExitWorkspaceDetailAfterTransfer,
	shouldExitTopicDetailAfterDelete,
	resolveChatDetailDeleteFallback,
	resolveWorkspaceDetailDeleteFallback,
} from "../resolveSuperMobileBackFallback"

describe("resolveSuperMobileProjectDetailBackFallback", () => {
	it("returns shared workspace list for collaboration projects", () => {
		expect(
			resolveSuperMobileProjectDetailBackFallback({
				workspaceId: "ws-1",
				isSharedProjectDetail: true,
			}),
		).toEqual({ name: RouteName.SuperSharedWorkspace })
	})

	it("returns workspace projects for normal projects", () => {
		expect(
			resolveSuperMobileProjectDetailBackFallback({
				workspaceId: "ws-1",
				isSharedProjectDetail: false,
			}),
		).toEqual({
			name: RouteName.SuperWorkspaceProjects,
			params: { workspaceId: "ws-1" },
		})
	})

	it("returns null without workspace id", () => {
		expect(
			resolveSuperMobileProjectDetailBackFallback({
				workspaceId: "",
				isSharedProjectDetail: false,
			}),
		).toBeNull()
	})
})

describe("resolvePostMoveBackFallback", () => {
	it("returns target workspace projects list for a normal moved project", () => {
		expect(
			resolvePostMoveBackFallback({
				targetWorkspaceId: "ws-target",
				movedProject: { user_role: "owner" } as never,
			}),
		).toEqual({
			name: RouteName.SuperWorkspaceProjects,
			params: { workspaceId: "ws-target" },
		})
	})
})

describe("shouldExitDetailPageAfterDelete", () => {
	it("returns true only on project-detail when deleting the viewed project", () => {
		expect(
			shouldExitDetailPageAfterDelete({
				deletedProjectId: "p-1",
				selectedProjectId: "p-1",
				isProjectDetailActionContext: true,
			}),
		).toBe(true)
	})

	it("returns false on workspace list even when ids match", () => {
		expect(
			shouldExitDetailPageAfterDelete({
				deletedProjectId: "p-1",
				selectedProjectId: "p-1",
				isProjectDetailActionContext: false,
			}),
		).toBe(false)
	})
})

describe("shouldExitDetailPageAfterTransfer", () => {
	it("mirrors delete guard for project-detail transfer", () => {
		expect(
			shouldExitDetailPageAfterTransfer({
				deletedProjectId: "p-1",
				selectedProjectId: "p-1",
				isProjectDetailActionContext: true,
			}),
		).toBe(true)
		expect(
			shouldExitDetailPageAfterTransfer({
				deletedProjectId: "p-1",
				selectedProjectId: "p-1",
				isProjectDetailActionContext: false,
			}),
		).toBe(false)
	})
})

describe("shouldExitWorkspaceDetailAfterTransfer", () => {
	it("returns true only on workspace detail route for the transferred workspace", () => {
		expect(
			shouldExitWorkspaceDetailAfterTransfer({
				routeWorkspaceId: "ws-1",
				transferredWorkspaceId: "ws-1",
			}),
		).toBe(true)
	})

	it("returns false on workspaces list without route workspace id", () => {
		expect(
			shouldExitWorkspaceDetailAfterTransfer({
				routeWorkspaceId: undefined,
				transferredWorkspaceId: "ws-1",
			}),
		).toBe(false)
	})

	it("returns false when route workspace differs from transferred workspace", () => {
		expect(
			shouldExitWorkspaceDetailAfterTransfer({
				routeWorkspaceId: "ws-1",
				transferredWorkspaceId: "ws-2",
			}),
		).toBe(false)
	})
})

describe("detail delete exit guards", () => {
	it("enables chat detail delete exit only on conversation detail", () => {
		expect(
			shouldExitChatDetailAfterDelete({
				deletedProjectId: "p-1",
				selectedProjectId: "p-1",
				isChatMode: true,
				chatActionContext: "detail",
			}),
		).toBe(true)
		expect(
			shouldExitChatDetailAfterDelete({
				deletedProjectId: "p-1",
				selectedProjectId: "p-1",
				isChatMode: true,
				chatActionContext: "drawer",
			}),
		).toBe(false)
	})

	it("enables topic detail delete exit only on topic sub-page", () => {
		expect(
			shouldExitTopicDetailAfterDelete({
				deletedTopicId: "t-1",
				selectedTopicId: "t-1",
				isTopicDetailActionContext: true,
			}),
		).toBe(true)
	})

	it("resolves workspace and chat delete fallbacks", () => {
		expect(resolveWorkspaceDetailDeleteFallback()).toEqual({
			name: RouteName.SuperWorkspacesList,
		})
		expect(resolveChatDetailDeleteFallback()).toEqual({ name: RouteName.SuperChatsList })
	})
})

describe("shouldExitPageAfterProjectMove", () => {
	it("returns true for project-detail when moving the viewed project", () => {
		expect(
			shouldExitPageAfterProjectMove({
				movedProjectId: "p-1",
				selectedProjectId: "p-1",
				isProjectDetailActionContext: true,
				shouldShowSaveAsProject: false,
				chatActionContext: "drawer",
			}),
		).toBe(true)
	})

	it("returns false when moving a project that is not currently selected", () => {
		expect(
			shouldExitPageAfterProjectMove({
				movedProjectId: "p-1",
				selectedProjectId: "p-2",
				isProjectDetailActionContext: true,
				shouldShowSaveAsProject: false,
				chatActionContext: "drawer",
			}),
		).toBe(false)
	})
})

describe("resolveSuperMobileBackFallbackByRoute", () => {
	it("resolves chat detail to chats list", () => {
		expect(
			resolveSuperMobileBackFallbackByRoute({
				routeName: RouteName.SuperChatProjectState,
			}),
		).toEqual({ name: RouteName.SuperChatsList })
	})

	it("resolves workspace projects to workspaces list", () => {
		expect(
			resolveSuperMobileBackFallbackByRoute({
				routeName: RouteName.SuperWorkspaceProjects,
				workspaceId: "ws-1",
			}),
		).toEqual({ name: RouteName.SuperWorkspacesList })
	})
})

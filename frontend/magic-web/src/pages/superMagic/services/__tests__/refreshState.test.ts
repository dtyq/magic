import { beforeEach, describe, expect, it, vi } from "vitest"
import type { Workspace } from "@/pages/superMagic/pages/Workspace/types"

const {
	projectServiceMock,
	workspaceServiceMock,
	topicServiceMock,
	routeManageServiceMock,
	projectStoreMock,
	workspaceStoreMock,
	topicStoreMock,
	interfaceStoreMock,
} = vi.hoisted(() => ({
	projectServiceMock: {
		getProjectDetail: vi.fn(),
		fetchProjects: vi.fn(),
		updateProjects: vi.fn(),
		recordProjectVisit: vi.fn(),
	},
	workspaceServiceMock: {
		getWorkspaceDetail: vi.fn(),
		fetchWorkspaces: vi.fn(),
		createWorkspace: vi.fn(),
	},
	topicServiceMock: {
		fetchTopics: vi.fn(),
		getTopicDetail: vi.fn(),
	},
	routeManageServiceMock: {
		getCurrentRouteParams: vi.fn(() => ({})),
		isStaleScopedRefresh: vi.fn(() => false),
		fixRouteParams: vi.fn(),
		isCurrentChatProjectRoute: vi.fn(() => false),
		navigateToWorkspace: vi.fn(),
		navigateToHome: vi.fn(),
	},
	projectStoreMock: {
		selectedProject: { id: "project-stale" },
		loadedWorkspaces: new Set<string>(),
		setSelectedProject: vi.fn(),
		updateProject: vi.fn(),
		loadProjectsForWorkspace: vi.fn(),
	},
	workspaceStoreMock: {
		selectedWorkspace: null as Workspace | null,
		workspaces: [] as Workspace[],
		setSelectedWorkspace: vi.fn(),
	},
	topicStoreMock: {
		selectedTopic: null,
		setSelectedTopic: vi.fn(),
		updateTopicName: vi.fn(),
	},
	interfaceStoreMock: {
		isMobile: false,
	},
}))

vi.mock("@/stores/interface", () => ({
	interfaceStore: interfaceStoreMock,
}))

vi.mock("i18next", () => ({
	t: (key: string) => key,
}))

vi.mock("@/models/user", () => ({
	userStore: { user: { userInfo: {} } },
}))

vi.mock("@/apis", () => ({
	SuperMagicApi: {},
}))

vi.mock("@/services/superMagic/topicModel", () => ({
	superMagicTopicModelService: {},
	superMagicTopicModelCacheService: {},
	DEFAULT_TOPIC_ID: "default",
}))

vi.mock("@/services/superMagic/SuperMagicModeService", () => ({
	default: {},
}))

vi.mock("@/pages/superMagicMobile/utils/mergeProjectListItemWithStoreCache", () => ({
	mergeProjectListItemWithStoreCache: (project: unknown) => project,
}))

vi.mock("../../utils/superMagicCache", () => ({
	UserWorkspaceMapCache: { get: vi.fn(() => null), set: vi.fn() },
}))

vi.mock("../constants", () => ({
	SHARE_WORKSPACE_ID: "collaboration",
	SHARE_WORKSPACE_DATA: () => ({ id: "collaboration" }),
	isOtherCollaborationProject: () => false,
	isCollaborationWorkspace: () => false,
}))

vi.mock("../utils/permission", () => ({
	isOwner: () => true,
	isReadOnlyProject: () => false,
}))

vi.mock("@/pages/superMagic/hooks/useChatWorkspace", () => ({
	ensureChatWorkspace: vi.fn(),
}))

vi.mock("../topicReadProgressService", () => ({
	default: {
		flushCurrentTopicReadProgress: vi.fn(),
	},
}))

vi.mock("../routeManageService", () => ({
	default: routeManageServiceMock,
}))

vi.mock("../topicService", () => ({
	default: vi.fn().mockImplementation(() => topicServiceMock),
}))

vi.mock("../workspaceService", () => ({
	default: vi.fn().mockImplementation(() => workspaceServiceMock),
}))

vi.mock("../projectService", () => ({
	default: vi.fn().mockImplementation(() => projectServiceMock),
}))

vi.mock("../../stores/core", () => ({
	projectStore: projectStoreMock,
	workspaceStore: workspaceStoreMock,
	topicStore: topicStoreMock,
}))

vi.mock("../chatConversationNameSync", () => ({
	syncChatConversationName: vi.fn(),
	resolveChatTopicId: vi.fn(),
	shouldSyncChatConversationName: vi.fn(),
	renameTopicWithChatSync: vi.fn(),
	syncChatProjectNameOnly: vi.fn(),
}))

import SuperMagicService from "../index"

describe("SuperMagicService.refreshState", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		vi.stubGlobal("requestIdleCallback", (callback: IdleRequestCallback) => {
			callback({ didTimeout: false, timeRemaining: () => 0 })
			return 1
		})
		workspaceStoreMock.selectedWorkspace = null
		workspaceStoreMock.workspaces = []
		projectStoreMock.selectedProject = { id: "project-stale" }
		projectStoreMock.loadedWorkspaces = new Set<string>()
		interfaceStoreMock.isMobile = false
		routeManageServiceMock.getCurrentRouteParams.mockReturnValue({})
		routeManageServiceMock.isStaleScopedRefresh.mockReturnValue(false)
		workspaceServiceMock.getWorkspaceDetail.mockResolvedValue({
			id: "workspace-alpha",
			workspace_type: "default",
		})
		workspaceServiceMock.createWorkspace.mockResolvedValue({
			id: "workspace-created",
			workspace_type: "default",
		})
	})

	it("continues restoring workspace state when route only provides workspaceId", async () => {
		await SuperMagicService.refreshState({ workspaceId: "workspace-alpha" })

		expect(projectStoreMock.setSelectedProject).toHaveBeenCalledWith(null)
		expect(workspaceServiceMock.getWorkspaceDetail).toHaveBeenCalledWith("workspace-alpha", {
			enableErrorMessagePrompt: false,
		})
		expect(workspaceStoreMock.setSelectedWorkspace).toHaveBeenCalledWith({
			id: "workspace-alpha",
			workspace_type: "default",
		})
		expect(projectServiceMock.fetchProjects).toHaveBeenCalledWith(
			{
				workspaceId: "workspace-alpha",
				page: 1,
				clearWhenNoProjects: false,
			},
			{ enableErrorMessagePrompt: false },
		)
		expect(routeManageServiceMock.fixRouteParams).toHaveBeenCalled()
	})

	it("keeps route project selection while refreshing an empty project list", async () => {
		interfaceStoreMock.isMobile = true
		routeManageServiceMock.getCurrentRouteParams.mockReturnValue({
			projectId: "project-route-target",
		})
		projectServiceMock.getProjectDetail.mockResolvedValue({
			id: "project-route-target",
			workspace_id: "workspace-alpha",
			user_role: "owner",
		})

		await SuperMagicService.refreshState({ projectId: "project-route-target" })

		expect(projectServiceMock.fetchProjects).toHaveBeenCalledWith(
			{
				workspaceId: "workspace-alpha",
				page: 1,
				clearWhenNoProjects: false,
			},
			{ enableErrorMessagePrompt: false },
		)
		expect(projectStoreMock.setSelectedProject).toHaveBeenCalledWith(
			expect.objectContaining({ id: "project-route-target" }),
		)
	})

	it("uses the provided normal workspace when navigating home from chat workspace", async () => {
		const homeWorkspace = {
			id: "workspace-home",
			workspace_type: "default",
		} as Workspace
		workspaceStoreMock.selectedWorkspace = {
			id: "workspace-chat",
			workspace_type: "chat",
		} as Workspace
		workspaceStoreMock.workspaces = [
			homeWorkspace,
			{ id: "workspace-chat", workspace_type: "chat" } as Workspace,
		]

		await SuperMagicService.navigateToHome("workspace-home")

		expect(workspaceStoreMock.setSelectedWorkspace).toHaveBeenCalledWith(homeWorkspace)
		expect(routeManageServiceMock.navigateToWorkspace).toHaveBeenCalledWith(
			"workspace-home",
			false,
		)
	})

	it("falls back to the first normal workspace when lastUsedWorkspaceId is a chat workspace", async () => {
		const homeWorkspace = {
			id: "workspace-home",
			workspace_type: "default",
		} as Workspace
		workspaceStoreMock.selectedWorkspace = {
			id: "workspace-chat",
			workspace_type: "chat",
		} as Workspace
		workspaceStoreMock.workspaces = [
			homeWorkspace,
			{ id: "workspace-chat", workspace_type: "chat" } as Workspace,
		]

		await SuperMagicService.navigateToHome("workspace-chat")

		expect(workspaceStoreMock.setSelectedWorkspace).toHaveBeenCalledWith(homeWorkspace)
		expect(routeManageServiceMock.navigateToWorkspace).toHaveBeenCalledWith(
			"workspace-home",
			false,
		)
		expect(workspaceServiceMock.createWorkspace).not.toHaveBeenCalled()
	})

	it("passes pending deep-link query through workspace home navigation", async () => {
		const homeWorkspace = {
			id: "workspace-home",
			workspace_type: "default",
		} as Workspace
		workspaceStoreMock.selectedWorkspace = homeWorkspace

		await SuperMagicService.navigateToHome(undefined, {
			agentCode: "SMA-test-agent",
		})

		expect(routeManageServiceMock.navigateToWorkspace).toHaveBeenCalledWith(
			"workspace-home",
			false,
			{ agentCode: "SMA-test-agent" },
		)
	})
})

describe("SuperMagicService.silentRefreshSidebarLoadedCaches", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		projectStoreMock.loadedWorkspaces = new Set(["workspace-a", "workspace-b"])
		workspaceStoreMock.selectedWorkspace = {
			id: "workspace-selected",
			workspace_type: "default",
		} as Workspace
	})

	/**
	 * The sidebar refresh should only touch normal loaded workspace caches
	 * and the currently selected flat project list without changing selection.
	 */
	it("refreshes loaded workspace caches and the selected flat project list", async () => {
		const selectedWorkspace = workspaceStoreMock.selectedWorkspace
		const selectedProject = projectStoreMock.selectedProject

		await SuperMagicService.silentRefreshSidebarLoadedCaches()

		expect(workspaceServiceMock.fetchWorkspaces).toHaveBeenCalledWith({
			page: 1,
			isAutoSelect: false,
			isSelectLast: false,
		})
		expect(projectStoreMock.loadProjectsForWorkspace).toHaveBeenCalledTimes(2)
		expect(projectStoreMock.loadProjectsForWorkspace).toHaveBeenNthCalledWith(
			1,
			"workspace-a",
			true,
			true,
		)
		expect(projectStoreMock.loadProjectsForWorkspace).toHaveBeenNthCalledWith(
			2,
			"workspace-b",
			true,
			true,
		)
		expect(projectServiceMock.updateProjects).toHaveBeenCalledWith({
			workspaceId: "workspace-selected",
		})
		expect(workspaceStoreMock.setSelectedWorkspace).not.toHaveBeenCalled()
		expect(projectStoreMock.setSelectedProject).not.toHaveBeenCalled()
		expect(workspaceStoreMock.selectedWorkspace).toBe(selectedWorkspace)
		expect(projectStoreMock.selectedProject).toBe(selectedProject)
	})

	/**
	 * Shared and invalid workspace ids should be ignored so manual refresh only
	 * hits concrete personal workspace caches and skips flat list sync for shared selection.
	 */
	it("skips shared or invalid workspace caches and avoids flat sync for shared selection", async () => {
		projectStoreMock.loadedWorkspaces = new Set(["workspace-a", "", "collaboration"])
		workspaceStoreMock.selectedWorkspace = {
			id: "collaboration",
			workspace_type: "default",
		} as Workspace

		await SuperMagicService.silentRefreshSidebarLoadedCaches()

		expect(projectStoreMock.loadProjectsForWorkspace).toHaveBeenCalledWith(
			"workspace-a",
			true,
			true,
		)
		const refreshedWorkspaceIds = projectStoreMock.loadProjectsForWorkspace.mock.calls.map(
			(args: [string]) => args[0],
		)
		expect(refreshedWorkspaceIds).not.toContain("collaboration")
		expect(refreshedWorkspaceIds).not.toContain("")
		expect(projectServiceMock.updateProjects).not.toHaveBeenCalled()
		expect(workspaceStoreMock.setSelectedWorkspace).not.toHaveBeenCalled()
		expect(projectStoreMock.setSelectedProject).not.toHaveBeenCalled()
	})
})

import { beforeEach, describe, expect, it, vi } from "vitest"

import { RouteName } from "@/routes/constants"

const mockState = vi.hoisted(() => ({
	pathname: "/global/super/workspaces",
	search: "",
	isMobile: false,
	replaceMock: vi.fn(),
	pushMock: vi.fn(),
	goMock: vi.fn(),
	routesMatchMock: vi.fn(),
	routesPathMatchMock: vi.fn(),
	selectedProject: null as {
		id: string
		workspace_id: string
		project_mode?: string
	} | null,
	selectedTopic: null as { id: string } | null,
}))

vi.mock("@/routes/history", () => ({
	baseHistory: {
		location: {
			get pathname() {
				return mockState.pathname
			},
			get search() {
				return mockState.search
			},
		},
	},
	history: {
		replace: mockState.replaceMock,
		push: mockState.pushMock,
		go: mockState.goMock,
	},
}))

vi.mock("@/routes/history/helpers", () => ({
	routesMatch: mockState.routesMatchMock,
	routesPathMatch: mockState.routesPathMatchMock,
}))

vi.mock("@/models/user", () => ({
	userStore: {
		user: {
			userInfo: {
				user_id: "test-user",
				organization_code: "test-org",
			},
		},
	},
}))

vi.mock("../../utils/superMagicCache", () => ({
	WorkspaceStateCache: {
		get: () => ({ workspaceId: null, projectId: null, topicId: null }),
		set: vi.fn(),
		clear: vi.fn(),
	},
	UserWorkspaceMapCache: {
		get: () => null,
		set: vi.fn(),
		clear: vi.fn(),
	},
	ProjectTopicMapCache: {
		get: () => null,
		set: vi.fn(),
		clear: vi.fn(),
	},
	ChatWorkspaceIdCache: {
		/** Keep chat workspace checks deterministic in route tests. */
		get: () => "chat-workspace",
		set: vi.fn(),
		clear: vi.fn(),
	},
}))

vi.mock(
	"@dtyq/magic-admin/locales",
	() => ({
		/** Route service tests do not rely on admin locale bundles. */
		getAdminLocaleModules: () => ({}),
	}),
	{ virtual: true },
)

vi.mock("@/stores/interface", () => ({
	interfaceStore: {
		get isMobile() {
			return mockState.isMobile
		},
	},
}))

vi.mock("../../stores/core", () => ({
	projectStore: {
		get selectedProject() {
			return mockState.selectedProject
		},
		projects: [],
		projectsByWorkspace: new Map(),
	},
	workspaceStore: {
		selectedWorkspace: { id: "workspace-1" },
	},
	topicStore: {
		get selectedTopic() {
			return mockState.selectedTopic
		},
	},
}))

const navigateMock = vi.fn()

const { replaceMock, pushMock, goMock, routesMatchMock, routesPathMatchMock } = mockState

const { default: routeManageService } = await import("../routeManageService")

describe("routeManageService.navigateToHome", () => {
	beforeEach(() => {
		mockState.pathname = "/global/super/workspaces"
		mockState.search = ""
		mockState.isMobile = false
		replaceMock.mockReset()
		pushMock.mockReset()
		goMock.mockReset()
		routesMatchMock.mockReset()
		routeManageService.setNavigate(null)
	})

	it("navigates to MobileHome from standalone mobile super routes", () => {
		mockState.isMobile = true
		routesMatchMock.mockReturnValue({
			params: { clusterCode: "global" },
			pathname: "/global/super/workspaces",
			pathnameBase: "/global/super/workspaces",
			route: { name: RouteName.SuperWorkspacesList },
		})

		routeManageService.navigateToHome(true)

		expect(replaceMock).toHaveBeenCalledWith(
			expect.objectContaining({ name: RouteName.MobileHome }),
		)
	})
})

describe("routeManageService.navigateToWorkspace", () => {
	beforeEach(() => {
		mockState.pathname = "/global/super"
		mockState.search = ""
		mockState.isMobile = false
		navigateMock.mockReset()
		routesMatchMock.mockReset()
		routeManageService.setNavigate(navigateMock)
	})

	it("keeps pending deep-link query on the desktop workspace route", () => {
		routeManageService.navigateToWorkspace("workspace-1", true, {
			agentCode: "SMA-test-agent",
		})

		expect(navigateMock).toHaveBeenCalledWith(
			expect.objectContaining({
				name: RouteName.SuperWorkspaceState,
				params: { workspaceId: "workspace-1" },
				query: { agentCode: "SMA-test-agent" },
				replace: true,
			}),
		)
	})
})

describe("routeManageService.isCurrentMobileHomeRoute", () => {
	it("returns true for bare /super index", () => {
		expect(
			routeManageService.isCurrentMobileHomeRoute({
				pathname: "/global/super",
				search: "",
			}),
		).toBe(true)
	})

	it("returns true for /mobile-home route", () => {
		routesPathMatchMock.mockReturnValue(true)

		expect(
			routeManageService.isCurrentMobileHomeRoute({
				pathname: "/global/mobile-home",
				search: "",
			}),
		).toBe(true)
	})

	it("returns true for legacy mobile-tabs super home", () => {
		routesPathMatchMock.mockReturnValue(false)

		expect(
			routeManageService.isCurrentMobileHomeRoute({
				pathname: "/global/mobile-tabs",
				search: "?tab=super",
			}),
		).toBe(true)
	})

	it("returns false for mobile-tabs deep links carrying project state", () => {
		routesPathMatchMock.mockReturnValue(false)

		expect(
			routeManageService.isCurrentMobileHomeRoute({
				pathname: "/global/mobile-tabs",
				search: "?tab=super&projectId=project-1",
			}),
		).toBe(false)
	})
})

describe("routeManageService.fixRouteParams", () => {
	beforeEach(() => {
		mockState.pathname = "/global/super"
		mockState.search = ""
		mockState.isMobile = true
		replaceMock.mockReset()
		pushMock.mockReset()
		goMock.mockReset()
		routesMatchMock.mockReset()
		navigateMock.mockReset()
		routeManageService.setNavigate(navigateMock)
	})

	it("skips navigation on mobile bare /super even when workspace is selected", () => {
		routesMatchMock.mockReturnValue({
			params: { clusterCode: "global" },
			pathname: "/global/super",
			pathnameBase: "/global/super",
			route: { name: RouteName.Super },
		})

		routeManageService.fixRouteParams()

		expect(navigateMock).not.toHaveBeenCalled()
		expect(replaceMock).not.toHaveBeenCalled()
		expect(pushMock).not.toHaveBeenCalled()
	})

	it("preserves a desktop agentCode deep link until the homepage resolves it", () => {
		mockState.pathname = "/global/super/workspace/workspace-1"
		mockState.search = "?agentCode=SMA-test-agent"
		mockState.isMobile = false
		routesMatchMock.mockReturnValue({
			params: { clusterCode: "global", workspaceId: "workspace-1" },
			pathname: "/global/super/workspace/workspace-1",
			pathnameBase: "/global/super/workspace/workspace-1",
			route: { name: RouteName.SuperWorkspaceState },
		})

		routeManageService.fixRouteParams()

		expect(navigateMock).not.toHaveBeenCalled()
		expect(replaceMock).not.toHaveBeenCalled()
		expect(pushMock).not.toHaveBeenCalled()
	})
})

describe("routeManageService.shouldPreserveChatRoute", () => {
	beforeEach(() => {
		routesMatchMock.mockReset()
	})

	it("returns false when chat URL targets a different project than navigation state", () => {
		routesMatchMock.mockReturnValue({
			params: {
				clusterCode: "global",
				projectId: "chat-project-a",
				topicId: "topic-a",
			},
			pathname: "/global/super/chat/chat-project-a/topic-a",
			pathnameBase: "/global/super/chat/chat-project-a/topic-a",
			route: { name: RouteName.SuperChatProjectState },
		})

		expect(routeManageService.shouldPreserveChatRoute("chat-project-b")).toBe(false)
	})

	it("returns true when navigation keeps the same chat project", () => {
		mockState.selectedProject = {
			id: "chat-project-a",
			workspace_id: "chat-workspace",
		}
		routesMatchMock.mockReturnValue({
			params: {
				clusterCode: "global",
				projectId: "chat-project-a",
				topicId: "topic-a",
			},
			pathname: "/global/super/chat/chat-project-a/topic-a",
			pathnameBase: "/global/super/chat/chat-project-a/topic-a",
			route: { name: RouteName.SuperChatProjectState },
		})

		expect(routeManageService.shouldPreserveChatRoute("chat-project-a")).toBe(true)
	})

	it("returns false when the selected project has already moved out of chat workspace", () => {
		mockState.selectedProject = {
			id: "chat-project-a",
			workspace_id: "workspace-normal",
		}
		routesMatchMock.mockReturnValue({
			params: {
				clusterCode: "global",
				projectId: "chat-project-a",
				topicId: "topic-a",
			},
			pathname: "/global/super/chat/chat-project-a/topic-a",
			pathnameBase: "/global/super/chat/chat-project-a/topic-a",
			route: { name: RouteName.SuperChatProjectState },
		})

		expect(routeManageService.shouldPreserveChatRoute("chat-project-a")).toBe(false)
	})
})

describe("routeManageService.fixRouteParams desktop chat exit", () => {
	beforeEach(() => {
		mockState.isMobile = false
		mockState.search = ""
		mockState.selectedProject = null
		mockState.selectedTopic = null
		navigateMock.mockReset()
		routesMatchMock.mockReset()
		routeManageService.setNavigate(navigateMock)
	})

	it("leaves stale chat URL to workspace when project context was cleared", () => {
		routesMatchMock.mockReturnValue({
			params: {
				clusterCode: "global",
				projectId: "chat-project-a",
				topicId: "topic-a",
			},
			pathname: "/global/super/chat/chat-project-a/topic-a",
			pathnameBase: "/global/super/chat/chat-project-a/topic-a",
			route: { name: RouteName.SuperChatProjectState },
		})

		routeManageService.fixRouteParams()

		expect(navigateMock).toHaveBeenCalledWith(
			expect.objectContaining({
				name: RouteName.SuperWorkspaceState,
				params: { workspaceId: "workspace-1" },
				replace: true,
			}),
		)
	})
})

describe("routeManageService.navigateToTopic", () => {
	beforeEach(() => {
		mockState.isMobile = false
		navigateMock.mockReset()
		routesMatchMock.mockReset()
		routeManageService.setNavigate(navigateMock)
	})

	it("uses workspace topic route when leaving chat URL for another project", () => {
		mockState.selectedProject = null
		routesMatchMock.mockReturnValue({
			params: {
				clusterCode: "global",
				projectId: "chat-project-a",
				topicId: "topic-a",
			},
			pathname: "/global/super/chat/chat-project-a/topic-a",
			pathnameBase: "/global/super/chat/chat-project-a/topic-a",
			route: { name: RouteName.SuperChatProjectState },
		})

		routeManageService.navigateToTopic({
			workspaceId: "workspace-1",
			projectId: "project-beta",
			topicId: "topic-beta",
		})

		expect(navigateMock).toHaveBeenCalledWith(
			expect.objectContaining({
				name: RouteName.SuperWorkspaceProjectTopicState,
				params: {
					projectId: "project-beta",
					topicId: "topic-beta",
				},
			}),
		)
	})

	it("uses workspace topic route when the same project id already belongs to a normal workspace", () => {
		mockState.selectedProject = {
			id: "project-beta",
			workspace_id: "workspace-normal",
		}
		routesMatchMock.mockReturnValue({
			params: {
				clusterCode: "global",
				projectId: "project-beta",
				topicId: "topic-a",
			},
			pathname: "/global/super/chat/project-beta/topic-a",
			pathnameBase: "/global/super/chat/project-beta/topic-a",
			route: { name: RouteName.SuperChatProjectState },
		})

		routeManageService.navigateToTopic({
			workspaceId: "workspace-normal",
			projectId: "project-beta",
			topicId: "topic-beta",
		})

		expect(navigateMock).toHaveBeenCalledWith(
			expect.objectContaining({
				name: RouteName.SuperWorkspaceProjectTopicState,
				params: {
					projectId: "project-beta",
					topicId: "topic-beta",
				},
			}),
		)
	})
})

describe("routeManageService.navigateToChatProject", () => {
	beforeEach(() => {
		mockState.isMobile = false
		navigateMock.mockReset()
		routesMatchMock.mockReset()
		routeManageService.setNavigate(navigateMock)
	})

	it("navigates desktop chat opens to SuperChatProjectState", () => {
		routesMatchMock.mockReturnValue({
			params: { clusterCode: "global" },
			pathname: "/global/super",
			pathnameBase: "/global/super",
			route: { name: RouteName.Super },
		})

		routeManageService.navigateToChatProject(
			{
				id: "project-alpha",
				workspace_id: "workspace-alpha",
			} as never,
			"topic-alpha",
		)

		expect(navigateMock).toHaveBeenCalledWith(
			expect.objectContaining({
				name: RouteName.SuperChatProjectState,
				params: {
					projectId: "project-alpha",
					topicId: "topic-alpha",
				},
				viewTransition: false,
			}),
		)
	})
})

describe("routeManageService.navigateToProjectTopicOnMobile", () => {
	beforeEach(() => {
		replaceMock.mockReset()
		pushMock.mockReset()
		goMock.mockReset()
		routesMatchMock.mockReset()
		navigateMock.mockReset()
		routeManageService.setNavigate(navigateMock)
	})

	it("navigates to project topic sub-route with replace when switching from an existing topic", () => {
		routesMatchMock.mockReturnValue({
			params: {
				clusterCode: "global",
				projectId: "project-1",
				topicId: "topic-old",
				workspaceId: "workspace-1",
			},
			pathname: "/global/super/project-1/topic-old",
			pathnameBase: "/global/super/project-1/topic-old",
			route: { name: RouteName.SuperWorkspaceProjectTopicState },
		})

		routeManageService.navigateToProjectTopicOnMobile({
			projectId: "project-1",
			topicId: "topic-new",
			workspaceId: "workspace-1",
		})

		expect(navigateMock).toHaveBeenCalledWith(
			expect.objectContaining({
				name: RouteName.SuperWorkspaceProjectTopicState,
				params: {
					projectId: "project-1",
					topicId: "topic-new",
				},
				replace: true,
				viewTransition: false,
			}),
		)
	})

	it("uses push navigation when no topic is present in the current route", () => {
		routesMatchMock.mockReturnValue({
			params: {
				clusterCode: "global",
				projectId: "project-1",
				workspaceId: "workspace-1",
			},
			pathname: "/global/super/project-1",
			pathnameBase: "/global/super/project-1",
			route: { name: RouteName.SuperWorkspaceProjectState },
		})

		routeManageService.navigateToProjectTopicOnMobile({
			projectId: "project-1",
			topicId: "topic-new",
			workspaceId: "workspace-1",
		})

		expect(navigateMock).toHaveBeenCalledWith(
			expect.objectContaining({
				name: RouteName.SuperWorkspaceProjectTopicState,
				params: {
					projectId: "project-1",
					topicId: "topic-new",
				},
				replace: false,
			}),
		)
	})
})

describe("routeManageService AI canvas project route", () => {
	const canvasProject = {
		id: "canvas-1",
		workspace_id: "ai-canvas-workspace",
		project_mode: "ai-canvas",
	}

	beforeEach(() => {
		mockState.isMobile = false
		mockState.selectedProject = canvasProject
		navigateMock.mockReset()
		routesMatchMock.mockReset()
		routeManageService.setNavigate(navigateMock)
	})

	it("opens a canvas topic at the canvas address without the topic", () => {
		routesMatchMock.mockReturnValue({
			params: { clusterCode: "global" },
			route: { name: RouteName.AiCanvas },
		})

		routeManageService.navigateToTopic({
			workspaceId: "ai-canvas-workspace",
			projectId: "canvas-1",
			topicId: "topic-1",
		})

		expect(navigateMock).toHaveBeenCalledWith(
			expect.objectContaining({
				name: RouteName.AiCanvasProjectState,
				params: { projectId: "canvas-1" },
			}),
		)
	})

	it("keeps the URL when switching topics inside the open canvas", () => {
		routesMatchMock.mockReturnValue({
			params: { clusterCode: "global", projectId: "canvas-1" },
			route: { name: RouteName.AiCanvasProjectState },
		})

		routeManageService.navigateToTopic({
			workspaceId: "ai-canvas-workspace",
			projectId: "canvas-1",
			topicId: "topic-2",
		})

		expect(navigateMock).not.toHaveBeenCalled()
	})

	it("keeps generic project routes on mobile", () => {
		mockState.isMobile = true
		routesMatchMock.mockReturnValue({
			params: { clusterCode: "global" },
			route: { name: RouteName.AiCanvas },
		})

		routeManageService.navigateToProject(canvasProject as never)

		expect(navigateMock).toHaveBeenCalledWith(
			expect.objectContaining({ name: RouteName.SuperWorkspaceProjectState }),
		)
	})

	it("keeps generic routes for other projects", () => {
		mockState.selectedProject = { id: "project-1", workspace_id: "workspace-1" }
		routesMatchMock.mockReturnValue({
			params: { clusterCode: "global" },
			route: { name: RouteName.Super },
		})

		routeManageService.navigateToTopic({
			workspaceId: "workspace-1",
			projectId: "project-1",
			topicId: "topic-1",
		})

		expect(navigateMock).toHaveBeenCalledWith(
			expect.objectContaining({ name: RouteName.SuperWorkspaceProjectTopicState }),
		)
	})
})

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

vi.mock("@/stores/interface", () => ({
	interfaceStore: {
		get isMobile() {
			return mockState.isMobile
		},
	},
}))

vi.mock("../../stores/core", () => ({
	projectStore: {
		selectedProject: null,
	},
	workspaceStore: {
		selectedWorkspace: { id: "workspace-1" },
	},
	topicStore: {
		selectedTopic: null,
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

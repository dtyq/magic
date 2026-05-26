import { beforeEach, describe, expect, it, vi } from "vitest"

import { RouteName } from "@/routes/constants"

const replaceMock = vi.fn()
const pushMock = vi.fn()
const goMock = vi.fn()
const routesMatchMock = vi.fn()

vi.mock("@/routes/history", () => ({
	baseHistory: {
		location: {
			pathname: "/global/super/workspaces",
			search: "",
		},
	},
	history: {
		replace: replaceMock,
		push: pushMock,
		go: goMock,
	},
}))

vi.mock("@/routes/history/helpers", () => ({
	routesMatch: routesMatchMock,
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

vi.mock("../../stores/core", () => ({
	projectStore: {
		selectedProject: null,
	},
	workspaceStore: {
		selectedWorkspace: { id: "workspace-1" },
	},
	topicStore: {},
}))

const navigateMock = vi.fn()

const { default: routeManageService } = await import("../routeManageService")

describe("routeManageService.navigateToHome", () => {
	beforeEach(() => {
		replaceMock.mockReset()
		pushMock.mockReset()
		goMock.mockReset()
		routesMatchMock.mockReset()
		routeManageService.setNavigate(null)
	})

	it("navigates to MobileHome from standalone mobile super routes", () => {
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

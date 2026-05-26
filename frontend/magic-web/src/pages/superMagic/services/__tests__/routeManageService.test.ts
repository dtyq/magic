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
	projectStore: {},
	workspaceStore: {},
	topicStore: {},
}))

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

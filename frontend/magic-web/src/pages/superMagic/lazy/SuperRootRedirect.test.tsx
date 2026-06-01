import { render } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import SuperRootRedirect from "./SuperRootRedirect"
import { RouteName } from "@/routes/constants"

const mockState = vi.hoisted(() => ({
	isMobile: false,
	pathname: "/global/super",
	params: {} as Record<string, string | undefined>,
	navigate: vi.fn(),
	navigateToHome: vi.fn(),
	replace: vi.fn(),
}))

vi.mock("react-router", () => ({
	useParams: () => mockState.params,
}))

vi.mock("@/hooks/useIsMobile", () => ({
	useIsMobile: () => mockState.isMobile,
}))

vi.mock("@/routes/hooks/useNavigate", () => ({
	__esModule: true,
	default: () => mockState.navigate,
}))

vi.mock("@/routes/history", () => ({
	baseHistory: {
		location: {
			get pathname() {
				return mockState.pathname
			},
		},
	},
	history: {
		replace: mockState.replace,
	},
}))

vi.mock("@/models/user", () => ({
	userStore: {
		user: {
			userInfo: {},
		},
	},
}))

vi.mock("../services", () => ({
	__esModule: true,
	default: {
		navigateToHome: mockState.navigateToHome,
	},
}))

vi.mock("../utils/superMagicCache", () => ({
	ProjectTopicMapCache: {
		get: vi.fn(),
	},
	UserWorkspaceMapCache: {
		get: vi.fn(),
	},
	WorkspaceStateCache: {
		get: vi.fn(() => ({})),
	},
}))

describe("SuperRootRedirect", () => {
	beforeEach(() => {
		mockState.isMobile = false
		mockState.pathname = "/global/super"
		mockState.params = {}
		mockState.navigate.mockReset()
		mockState.navigateToHome.mockReset()
		mockState.replace.mockReset()
	})

	it("redirects bare /super to mobile home on mobile viewport", () => {
		mockState.isMobile = true

		render(<SuperRootRedirect />)

		expect(mockState.replace).toHaveBeenCalledWith({ name: RouteName.MobileHome })
		expect(mockState.navigate).not.toHaveBeenCalled()
		expect(mockState.navigateToHome).not.toHaveBeenCalled()
	})
})

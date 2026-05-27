import { render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import SuperRootRedirect from "./SuperRootRedirect"

const mockState = vi.hoisted(() => ({
	isMobile: false,
	pathname: "/global/super",
	params: {} as Record<string, string | undefined>,
	navigate: vi.fn(),
	navigateToHome: vi.fn(),
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

vi.mock("@/routes/components/Navigate", () => ({
	__esModule: true,
	default: ({ name }: { name: string }) => <div data-testid="navigate-target">{name}</div>,
}))

vi.mock("@/routes/history", () => ({
	baseHistory: {
		location: {
			get pathname() {
				return mockState.pathname
			},
		},
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
	})

	it("redirects bare /super to mobile home on mobile viewport", () => {
		mockState.isMobile = true

		render(<SuperRootRedirect />)

		expect(screen.getByTestId("navigate-target")).toHaveTextContent("MobileHome")
		expect(mockState.navigate).not.toHaveBeenCalled()
		expect(mockState.navigateToHome).not.toHaveBeenCalled()
	})
})

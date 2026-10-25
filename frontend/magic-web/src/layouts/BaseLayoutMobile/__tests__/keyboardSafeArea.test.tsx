import { Suspense, type PropsWithChildren } from "react"
import { render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import BaseLayoutMobile from "../index"

const keyboardMock = vi.hoisted(() => {
	const state = { isUp: false }

	return {
		state,
		useMonitorSoftKeyboard: vi.fn(() => ({ isUp: state.isUp })),
	}
})

vi.mock("antd-mobile", () => ({
	ConfigProvider: ({ children }: PropsWithChildren) => children,
}))

vi.mock("ahooks", () => ({
	useMemoizedFn: <T extends (...args: never[]) => unknown>(fn: T) => fn,
}))

vi.mock("@/constants/routes", () => ({
	RoutePathMobile: { MobileTabs: "/mobile-tabs" },
}))

vi.mock("@/constants/keepAliveRoutes", () => ({
	KeepAliveRoute: {},
}))

vi.mock("@/stores/display/MemberCardStore", () => ({
	default: {
		domClassName: "member-card",
		getUidFromElement: vi.fn(),
	},
}))

vi.mock("@/hooks/router/useKeepAlive", () => ({
	useKeepAlive: () => ({ Content: <div data-testid="mobile-layout-content" /> }),
}))

vi.mock("@/routes/hooks/useNavigate", () => ({ default: () => vi.fn() }))
vi.mock("../components/OrganizationSwitch", () => ({ OrganizationSwitchPanel: () => null }))

vi.mock("react-router", () => ({
	useLocation: () => ({ pathname: "/global/super/mobile-home", search: "" }),
}))

vi.mock("../hooks", () => ({ useNativeBack: vi.fn() }))

vi.mock("../components/GlobalSafeArea", () => ({
	default: ({ direction }: { direction: string }) => (
		<div data-testid={`global-safe-area-${direction}`} />
	),
}))

vi.mock("@/routes/constants", () => ({
	RouteName: {
		MobileTabs: "MobileTabs",
		Super: "Super",
		SuperWorkspaceState: "SuperWorkspaceState",
		Chat: "Chat",
		Contacts: "Contacts",
		MagicApproval: "MagicApproval",
		UserInfoDetails: "UserInfoDetails",
	},
}))

vi.mock("@/routes/history/helpers", () => ({ routesPathMatch: () => false }))
vi.mock("mobx-react-lite", () => ({ observer: <T,>(component: T) => component }))
vi.mock("@/components/global/MultiFolderUploadToast", () => ({
	MultiFolderUploadToast: () => null,
}))
vi.mock("@/hooks/useGlobalSafeArea", () => ({ GlobalSafeAreaSync: () => null }))
vi.mock("@/stores/interface", () => ({ interfaceStore: { mobileTabBarVisible: false } }))
vi.mock("../components/NavigatePopup", () => ({ default: () => null }))
vi.mock("../components/GlobalSafeArea/utils", () => ({ shouldDisableGlobalSafeArea: () => false }))

vi.mock("@/pages/superMagicMobile/components/MobileDocumentTheme", () => ({
	MobileDocumentThemeProvider: ({ children }: PropsWithChildren) => children,
	MobileDocumentThemeSync: () => null,
}))

vi.mock("@/routes/hooks/useRoutesMetaSet", () => ({ default: vi.fn() }))
vi.mock("@/hooks/useAntdMobileLocale", () => ({ useAntdMobileLocale: () => undefined }))
vi.mock("@/components/global/MaintenanceNotice", () => ({ default: () => null }))

vi.mock("@/hooks/useMonitorSoftKeyboard", () => ({
	default: keyboardMock.useMonitorSoftKeyboard,
}))

vi.mock("../components/MobileTabBar", () => ({ default: () => null }))
vi.mock("@/pages/superMagic/components/ShareManagement/ShareManagementContainer", () => ({
	default: () => null,
}))

/** Renders the mobile layout after lazy dependencies resolve. */
function renderMobileLayout() {
	return render(
		<Suspense fallback={null}>
			<BaseLayoutMobile />
		</Suspense>,
	)
}

describe("BaseLayoutMobile keyboard safe area", () => {
	beforeEach(() => {
		keyboardMock.state.isUp = false
		keyboardMock.useMonitorSoftKeyboard.mockClear()
	})

	it("keeps both safe areas when the software keyboard is closed", async () => {
		renderMobileLayout()

		expect(await screen.findByTestId("global-safe-area-top")).toBeInTheDocument()
		expect(screen.getByTestId("global-safe-area-bottom")).toBeInTheDocument()
		expect(keyboardMock.useMonitorSoftKeyboard).toHaveBeenCalledWith({
			focusOutDelay: 0,
		})
	})

	it("keeps the top safe area and removes the bottom spacer when the keyboard is open", async () => {
		keyboardMock.state.isUp = true
		renderMobileLayout()

		expect(await screen.findByTestId("global-safe-area-top")).toBeInTheDocument()
		expect(screen.queryByTestId("global-safe-area-bottom")).not.toBeInTheDocument()
	})
})

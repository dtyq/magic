import { act, renderHook } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { useSuperMobileShellNavigation } from "../useSuperMobileShellNavigation"

const { navigateMock, deviceMocks, envMock, permissionMock, userStoreMock } = vi.hoisted(() => ({
	navigateMock: vi.fn(),
	deviceMocks: {
		isMagicApp: false,
		changeBottomTabMock: vi.fn(),
	},
	envMock: {
		isPrivateDeployment: false,
	},
	permissionMock: {
		canAccessMagicClaw: true,
	},
	userStoreMock: {
		user: {
			isPersonalOrganization: false,
		},
	},
}))

vi.mock("@/routes/hooks/useNavigate", () => ({
	default: () => navigateMock,
}))

vi.mock("@/models/user", () => ({
	userStore: userStoreMock,
}))

vi.mock("@/hooks/useFunctionPermission", () => ({
	useFunctionPermission: () => ({
		isAllowed: permissionMock.canAccessMagicClaw,
		isLoading: false,
	}),
}))

vi.mock("@/utils/devices", () => ({
	get isMagicApp() {
		return deviceMocks.isMagicApp
	},
}))

vi.mock("@/utils/env", () => ({
	env: () => "",
	getPrivateDeploymentConfig: () => null,
	isCommercial: () => false,
	isDev: false,
	isInternationalEnv: () => false,
	isLoginAuthorizationWhitelist: () => false,
	isPreEnv: () => false,
	isPrivateDeployment: () => envMock.isPrivateDeployment,
	isProductionEnv: () => false,
	isTestEnv: () => true,
}))

vi.mock("@/platform/native", () => ({
	getNativePort: () => ({
		navigation: {
			changeBottomTab: deviceMocks.changeBottomTabMock,
		},
	}),
}))

vi.mock("@/layouts/BaseLayoutMobile/components/MobileTabBar/constants/tabsConfig.shared", () => ({
	hasOrganizationAppsShortcuts: ({
		isPersonalOrganization,
	}: {
		isPersonalOrganization: boolean
	}) => !isPersonalOrganization,
}))

vi.mock("react-i18next", async (importOriginal) => {
	const actual = await importOriginal<typeof import("react-i18next")>()

	return {
		...actual,
		useTranslation: () => ({
			t: (key: string) => key,
		}),
	}
})

vi.mock("@/pages/superMagicMobile/components/icons/MagiClawNavIcon", () => ({
	MagiClawNavIcon: () => null,
}))

function renderNavigation(options?: { isSidebarOpen?: boolean }) {
	const setSidebarOpenMock = vi.fn()
	const runAfterSidebarCloseFrameMock = vi.fn()

	const hook = renderHook(() =>
		useSuperMobileShellNavigation({
			activeView: "chats",
			isSidebarOpen: options?.isSidebarOpen ?? false,
			setIsSidebarOpen: setSidebarOpenMock,
			runAfterSidebarCloseFrame: runAfterSidebarCloseFrameMock,
		}),
	)

	return {
		...hook,
		setSidebarOpenMock,
		runAfterSidebarCloseFrameMock,
	}
}

describe("useSuperMobileShellNavigation", () => {
	beforeEach(() => {
		navigateMock.mockReset()
		deviceMocks.changeBottomTabMock.mockReset()
		deviceMocks.isMagicApp = false
		envMock.isPrivateDeployment = false
		permissionMock.canAccessMagicClaw = true
		userStoreMock.user.isPersonalOrganization = false
	})

	it("builds the default mobile shell nav items", () => {
		const { result } = renderNavigation()

		expect(result.current.navItems.map(({ key }) => key)).toEqual([
			"home",
			"chats",
			"workspaces",
			"recording",
			"myCrew",
			"magiClaw",
			"aiCanvas",
			"personaResearch",
			"microApps",
			"trash",
			"apps",
		])
	})

	it.each([
		["home", "MobileHome"],
		["chats", "SuperChatsList"],
		["workspaces", "SuperWorkspacesList"],
		["recording", "AudioRecordings"],
		["myCrew", "MyCrew"],
		["magiClaw", "MagiClaw"],
		["aiCanvas", "AiCanvas"],
		["apps", "SuperApps"],
		["trash", "RecycleBin"],
		["unknown-key", "MobileHome"],
	])("navigates %s without view transition", (key, routeName) => {
		const { result, setSidebarOpenMock, runAfterSidebarCloseFrameMock } = renderNavigation()

		act(() => {
			result.current.onNavigate(key)
		})

		expect(setSidebarOpenMock).toHaveBeenCalledWith(false)
		expect(navigateMock).toHaveBeenCalledWith({
			name: routeName,
			viewTransition: false,
		})
		expect(runAfterSidebarCloseFrameMock).not.toHaveBeenCalled()
	})

	it("hides apps entry when organization shortcuts are unavailable", () => {
		userStoreMock.user.isPersonalOrganization = true

		const { result } = renderNavigation()

		expect(result.current.navItems.map(({ key }) => key)).not.toContain("apps")
	})

	it("opens the native recording tab inside Magic App instead of routing to H5 recordings", () => {
		deviceMocks.isMagicApp = true
		const { result } = renderNavigation()

		act(() => {
			result.current.onNavigate("recording")
		})

		expect(deviceMocks.changeBottomTabMock).toHaveBeenCalledWith({
			tab: "ai_recording",
			bottomTabHeight: 0,
		})
		expect(navigateMock).not.toHaveBeenCalled()
	})

	it("defers menu navigation until sidebar close frame when sidebar is open", () => {
		const { result, runAfterSidebarCloseFrameMock } = renderNavigation({
			isSidebarOpen: true,
		})

		act(() => {
			result.current.onNavigate("workspaces")
		})

		expect(navigateMock).not.toHaveBeenCalled()
		expect(runAfterSidebarCloseFrameMock).toHaveBeenCalledTimes(1)

		act(() => {
			runAfterSidebarCloseFrameMock.mock.calls[0]?.[0]()
		})

		expect(navigateMock).toHaveBeenCalledWith({
			name: "SuperWorkspacesList",
			viewTransition: false,
		})
	})

	it("defers brand home navigation until sidebar close frame when sidebar is open", () => {
		const { result, runAfterSidebarCloseFrameMock } = renderNavigation({
			isSidebarOpen: true,
		})

		act(() => {
			result.current.onGoHome()
		})

		expect(navigateMock).not.toHaveBeenCalled()
		expect(runAfterSidebarCloseFrameMock).toHaveBeenCalledTimes(1)

		act(() => {
			runAfterSidebarCloseFrameMock.mock.calls[0]?.[0]()
		})

		expect(navigateMock).toHaveBeenCalledWith({
			name: "MobileHome",
			viewTransition: false,
		})
	})
})

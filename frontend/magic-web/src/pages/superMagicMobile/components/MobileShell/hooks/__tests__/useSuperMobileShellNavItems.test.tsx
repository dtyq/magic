import { renderHook } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { FUNCTION_PERMISSION_CODE } from "@/apis/modules/function-permission"
import { RouteName } from "@/routes/constants"
import { useSuperMobileShellNavItems } from "../useSuperMobileShellNavItems"

const { envMock, permissionMock, useFunctionPermissionMock, userStoreMock } = vi.hoisted(() => ({
	envMock: {
		isPrivateDeployment: false,
		microAppEnabled: "",
	},
	permissionMock: {
		canAccessMagicClaw: true,
		isLoading: false,
	},
	useFunctionPermissionMock: vi.fn(),
	userStoreMock: {
		user: {
			isPersonalOrganization: false,
		},
	},
}))

vi.mock("@/models/user", () => ({
	userStore: userStoreMock,
}))

vi.mock("@/hooks/useFunctionPermission", () => ({
	useFunctionPermission: useFunctionPermissionMock,
}))

vi.mock("@/utils/env", () => ({
	env: (key: string) => (key === "MAGIC_MICRO_APP_ENABLED" ? envMock.microAppEnabled : ""),
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
			t: (key: string) => `label:${key}`,
		}),
	}
})

vi.mock("@/pages/superMagicMobile/components/icons/MagiClawNavIcon", () => ({
	MagiClawNavIcon: () => null,
}))

describe("useSuperMobileShellNavItems", () => {
	beforeEach(() => {
		envMock.isPrivateDeployment = false
		envMock.microAppEnabled = ""
		permissionMock.canAccessMagicClaw = true
		permissionMock.isLoading = false
		useFunctionPermissionMock.mockReset()
		useFunctionPermissionMock.mockReturnValue({
			isAllowed: permissionMock.canAccessMagicClaw,
			isLoading: permissionMock.isLoading,
		})
		userStoreMock.user.isPersonalOrganization = false
	})

	it("resolves default shell nav config into localized menu items", () => {
		const { result } = renderHook(() => useSuperMobileShellNavItems())

		expect(
			result.current.map(({ key, label, routeName, nativeRecordingTab }) => ({
				key,
				label,
				routeName,
				nativeRecordingTab,
			})),
		).toEqual([
			{
				key: "home",
				label: "label:mobile.shell.navSuper",
				routeName: RouteName.MobileHome,
				nativeRecordingTab: undefined,
			},
			{
				key: "chats",
				label: "label:mobile.shell.navChats",
				routeName: RouteName.SuperChatsList,
				nativeRecordingTab: undefined,
			},
			{
				key: "workspaces",
				label: "label:mobile.shell.navWorkspaces",
				routeName: RouteName.SuperWorkspacesList,
				nativeRecordingTab: undefined,
			},
			{
				key: "recording",
				label: "label:mobile.shell.navRecording",
				routeName: RouteName.AudioRecordings,
				nativeRecordingTab: "ai_recording",
			},
			{
				key: "myCrew",
				label: "label:mobile.shell.navMyCrew",
				routeName: RouteName.MyCrew,
				nativeRecordingTab: undefined,
			},
			{
				key: "magiClaw",
				label: "label:mobile.shell.navMagiClaw",
				routeName: RouteName.MagiClaw,
				nativeRecordingTab: undefined,
			},
			{
				key: "aiCanvas",
				label: "label:mobile.shell.navAiCanvas",
				routeName: RouteName.AiCanvas,
				nativeRecordingTab: undefined,
			},
			{
				key: "personaResearch",
				label: "label:mobile.shell.navPersonaResearch",
				routeName: RouteName.PersonaResearch,
				nativeRecordingTab: undefined,
			},
			{
				key: "microApps",
				label: "label:mobile.shell.navMicroApps",
				routeName: RouteName.MicroApps,
				nativeRecordingTab: undefined,
			},
			{
				key: "trash",
				label: "label:mobile.shell.navTrash",
				routeName: RouteName.RecycleBin,
				nativeRecordingTab: undefined,
			},
			{
				key: "apps",
				label: "label:mobile.shell.navApps",
				routeName: RouteName.SuperApps,
				nativeRecordingTab: undefined,
			},
		])
	})

	it("hides apps entry when organization shortcuts are unavailable", () => {
		userStoreMock.user.isPersonalOrganization = true

		const { result } = renderHook(() => useSuperMobileShellNavItems())

		expect(result.current.map(({ key }) => key)).not.toContain("apps")
	})

	it("hides MagiClaw entry when MagicClawAccess is denied", () => {
		permissionMock.canAccessMagicClaw = false
		useFunctionPermissionMock.mockReturnValue({
			isAllowed: permissionMock.canAccessMagicClaw,
			isLoading: permissionMock.isLoading,
		})

		const { result } = renderHook(() => useSuperMobileShellNavItems())

		expect(result.current.map(({ key }) => key)).not.toContain("magiClaw")
	})

	it("hides MagiClaw entry while MagicClawAccess is loading", () => {
		permissionMock.isLoading = true
		useFunctionPermissionMock.mockReturnValue({
			isAllowed: true,
			isLoading: permissionMock.isLoading,
		})

		const { result } = renderHook(() => useSuperMobileShellNavItems())

		expect(useFunctionPermissionMock).toHaveBeenCalledWith(
			FUNCTION_PERMISSION_CODE.MagicClawAccess,
		)
		expect(result.current.map(({ key }) => key)).not.toContain("magiClaw")
	})

	it("hides recording entry in private deployment", () => {
		envMock.isPrivateDeployment = true

		const { result } = renderHook(() => useSuperMobileShellNavItems())

		expect(result.current.map(({ key }) => key)).not.toContain("recording")
	})

	it("hides micro apps entry in private deployment", () => {
		envMock.isPrivateDeployment = true

		const { result } = renderHook(() => useSuperMobileShellNavItems())

		expect(result.current.map(({ key }) => key)).not.toContain("microApps")
	})

	it("hides only micro apps when explicitly disabled outside private deployment", () => {
		envMock.microAppEnabled = "false"
		const { result } = renderHook(() => useSuperMobileShellNavItems())
		expect(result.current.map(({ key }) => key)).not.toContain("microApps")
		expect(result.current.map(({ key }) => key)).toContain("recording")
	})

	it("allows micro apps without enabling recording in private deployment", () => {
		envMock.isPrivateDeployment = true
		envMock.microAppEnabled = "true"
		const { result } = renderHook(() => useSuperMobileShellNavItems())
		expect(result.current.map(({ key }) => key)).toContain("microApps")
		expect(result.current.map(({ key }) => key)).not.toContain("recording")
	})
})

import { beforeEach, describe, expect, it, vi } from "vitest"
import { MobileTabParam } from "@/pages/mobileTabs/constants"
import { RouteName } from "@/routes/constants"
import { NO_GLOBAL_SAFE_AREA_ROUTES_NAMES, shouldDisableGlobalSafeArea } from "../utils"

vi.mock("@/routes/history/helpers", () => ({
	routesPathMatch: (routeName: string, pathname: string) => pathname.includes(routeName),
}))

describe("NO_GLOBAL_SAFE_AREA_ROUTES_NAMES", () => {
	it("includes super mobile refactor routes that self-manage safe area", () => {
		expect(NO_GLOBAL_SAFE_AREA_ROUTES_NAMES).toEqual(
			expect.arrayContaining([
				RouteName.MobileHome,
				RouteName.SuperChatsList,
				RouteName.SuperWorkspacesList,
				RouteName.SuperSharedWorkspace,
				RouteName.SuperWorkspaceProjects,
				RouteName.RecycleBin,
				RouteName.SuperChatProjectState,
				RouteName.SuperWorkspaceProjectTopicState,
			]),
		)
	})
})

describe("shouldDisableGlobalSafeArea", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("disables the global safe area for super mobile refactor routes", () => {
		expect(shouldDisableGlobalSafeArea(`/${RouteName.MobileHome}`)).toBe(true)
		expect(shouldDisableGlobalSafeArea(`/${RouteName.SuperChatsList}`)).toBe(true)
		expect(shouldDisableGlobalSafeArea(`/${RouteName.SuperWorkspacesList}`)).toBe(true)
		expect(shouldDisableGlobalSafeArea(`/${RouteName.SuperSharedWorkspace}`)).toBe(true)
		expect(shouldDisableGlobalSafeArea(`/${RouteName.SuperWorkspaceProjects}`)).toBe(true)
		expect(shouldDisableGlobalSafeArea(`/${RouteName.RecycleBin}`)).toBe(true)
		expect(shouldDisableGlobalSafeArea(`/${RouteName.SuperChatProjectState}`)).toBe(true)
		expect(shouldDisableGlobalSafeArea(`/${RouteName.SuperWorkspaceProjectTopicState}`)).toBe(
			true,
		)
	})

	it("keeps the existing mobile tabs chat fallback", () => {
		expect(shouldDisableGlobalSafeArea("/mobile-tabs", `?tab=${MobileTabParam.Chat}`)).toBe(
			true,
		)
		expect(
			shouldDisableGlobalSafeArea("/mobile-tabs", `?tab=${MobileTabParam.SuperWorkspace}`),
		).toBe(false)
	})
})

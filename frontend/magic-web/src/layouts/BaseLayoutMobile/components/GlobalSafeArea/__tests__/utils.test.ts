import { beforeEach, describe, expect, it, vi } from "vitest"
import { MobileTabParam } from "@/pages/mobileTabs/constants"
import { RouteName } from "@/routes/constants"
import { NO_GLOBAL_SAFE_AREA_ROUTES_NAMES, shouldDisableGlobalSafeArea } from "../utils"

/** Map route names to representative pathnames for shouldDisableGlobalSafeArea tests. */
const ROUTE_PATH_FIXTURES: Partial<Record<RouteName, string>> = {
	[RouteName.Chat]: "/global/chat",
	[RouteName.Explore]: "/global/explore",
	[RouteName.Profile]: "/global/profile",
	[RouteName.MobileTabs]: "/global/mobile-tabs",
	[RouteName.Super]: "/global/super",
	[RouteName.MobileHome]: "/global/super/mobile-home",
	[RouteName.SuperChatsList]: "/global/super/chats",
	[RouteName.SuperWorkspacesList]: "/global/super/workspaces",
	[RouteName.SuperSharedWorkspace]: "/global/super/shared-workspace",
	[RouteName.SuperWorkspaceProjects]: "/global/super/workspaces/ws-1",
	[RouteName.RecycleBin]: "/global/super/recycle-bin",
	[RouteName.SuperChatProjectState]: "/global/super/chat/p-1/t-1",
	[RouteName.SuperWorkspaceProjectTopicState]: "/global/super/p-1/t-1",
}

vi.mock("@/routes/history/helpers", () => ({
	routesPathMatch: (routeName: RouteName, pathname: string) =>
		ROUTE_PATH_FIXTURES[routeName] === pathname,
}))

describe("NO_GLOBAL_SAFE_AREA_ROUTES_NAMES", () => {
	it("keeps legacy mobile routes that self-manage safe area", () => {
		expect(NO_GLOBAL_SAFE_AREA_ROUTES_NAMES).toEqual(
			expect.arrayContaining([
				RouteName.Chat,
				RouteName.Explore,
				RouteName.ChatConversation,
				RouteName.Profile,
				RouteName.MobileTabs,
				RouteName.ProfileSettingsTimezone,
			]),
		)
	})

	it("does not include Super or superMagicMobile refactor routes", () => {
		expect(NO_GLOBAL_SAFE_AREA_ROUTES_NAMES).not.toContain(RouteName.Super)
		expect(NO_GLOBAL_SAFE_AREA_ROUTES_NAMES).not.toContain(RouteName.MobileHome)
		expect(NO_GLOBAL_SAFE_AREA_ROUTES_NAMES).not.toContain(RouteName.SuperChatsList)
		expect(NO_GLOBAL_SAFE_AREA_ROUTES_NAMES).not.toContain(RouteName.SuperChatProjectState)
	})
})

describe("shouldDisableGlobalSafeArea", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("disables the global safe area for legacy self-managed routes", () => {
		expect(shouldDisableGlobalSafeArea("/global/chat")).toBe(true)
		expect(shouldDisableGlobalSafeArea("/global/profile")).toBe(true)
		expect(shouldDisableGlobalSafeArea("/global/mobile-tabs")).toBe(true)
	})

	it("keeps GlobalSafeArea enabled for bare Super and superMagicMobile refactor routes", () => {
		expect(shouldDisableGlobalSafeArea("/global/super")).toBe(false)
		expect(shouldDisableGlobalSafeArea("/global/super/mobile-home")).toBe(false)
		expect(shouldDisableGlobalSafeArea("/global/super/chats")).toBe(false)
		expect(shouldDisableGlobalSafeArea("/global/super/workspaces")).toBe(false)
		expect(shouldDisableGlobalSafeArea("/global/super/shared-workspace")).toBe(false)
		expect(shouldDisableGlobalSafeArea("/global/super/workspaces/ws-1")).toBe(false)
		expect(shouldDisableGlobalSafeArea("/global/super/recycle-bin")).toBe(false)
		expect(shouldDisableGlobalSafeArea("/global/super/chat/p-1/t-1")).toBe(false)
		expect(shouldDisableGlobalSafeArea("/global/super/p-1/t-1")).toBe(false)
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

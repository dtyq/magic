import { afterEach, describe, expect, it, vi } from "vitest"

import { applyMobileGlobalSafeAreaForSidebar } from "@/pages/superMagicMobile/utils/mobileDocumentTheme"

import { applyRouteGlobalSafeAreaStyle, syncGlobalSafeArea } from "../globalSafeArea"

vi.mock("@/layouts/BaseLayoutMobile/components/GlobalSafeArea/routeStyles", () => ({
	applyRouteGlobalSafeAreaStyle: vi.fn(),
}))

vi.mock("@/pages/superMagicMobile/utils/mobileDocumentTheme", () => ({
	applyMobileGlobalSafeAreaForSidebar: vi.fn(),
}))

describe("syncGlobalSafeArea", () => {
	afterEach(() => {
		vi.clearAllMocks()
	})

	it("applies route safe area when sidebar is closed", () => {
		syncGlobalSafeArea({
			pathname: "/super/chats",
			isSidebarOpen: false,
		})

		expect(applyRouteGlobalSafeAreaStyle).toHaveBeenCalledWith("/super/chats")
		expect(applyMobileGlobalSafeAreaForSidebar).not.toHaveBeenCalled()
	})

	it("applies sidebar safe area when sidebar is open", () => {
		syncGlobalSafeArea({
			pathname: "/super/chats",
			isSidebarOpen: true,
		})

		expect(applyMobileGlobalSafeAreaForSidebar).toHaveBeenCalledWith(true)
		expect(applyRouteGlobalSafeAreaStyle).not.toHaveBeenCalled()
	})
})

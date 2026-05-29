import { useEffect } from "react"
import { render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { interfaceStore } from "@/stores/interface"

import {
	MobileDocumentThemeProvider,
	useMobileDocumentThemeControl,
} from "../MobileDocumentThemeContext"
import { MobileDocumentThemeSync } from "../MobileDocumentThemeSync"

vi.mock("@/models/config/hooks", () => ({
	useTheme: () => ({
		prefersColorScheme: "light",
	}),
}))

vi.mock("react-router", () => ({
	useLocation: () => ({ pathname: "/super/chats", search: "", hash: "", state: null, key: "test" }),
}))

vi.mock("@/layouts/BaseLayoutMobile/components/GlobalSafeArea/routeStyles", () => ({
	applyRouteGlobalSafeAreaStyle: vi.fn(),
}))

interface TestTreeProps {
	sidebarOpen: boolean
}

/** Reports sidebar state the same way SuperMobileShellRouteLayout does. */
function TestTree({ sidebarOpen }: TestTreeProps) {
	const { setSidebarOpen } = useMobileDocumentThemeControl()

	useEffect(() => {
		setSidebarOpen(sidebarOpen)
		return () => setSidebarOpen(false)
	}, [sidebarOpen, setSidebarOpen])

	return <MobileDocumentThemeSync />
}

describe("MobileDocumentThemeSync", () => {
	afterEach(() => {
		interfaceStore.resetGlobalSafeAreaStyle()
	})

	it("syncs closed default then shell track when sidebar opens", () => {
		document.head.innerHTML = ""
		document.documentElement.style.background = ""
		document.body.style.background = ""
		interfaceStore.resetGlobalSafeAreaStyle()

		const { rerender } = render(
			<MobileDocumentThemeProvider>
				<TestTree sidebarOpen={false} />
			</MobileDocumentThemeProvider>,
		)

		let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]:not([media])')
		expect(meta?.getAttribute("content")).toBe("#fafafa")
		expect(document.documentElement.style.background).toBe("rgb(var(--mobile-background-rgb))")
		expect(interfaceStore.globalSafeAreaStyle.top).toEqual({})
		expect(interfaceStore.globalSafeAreaStyle.bottom).toEqual({})

		rerender(
			<MobileDocumentThemeProvider>
				<TestTree sidebarOpen={true} />
			</MobileDocumentThemeProvider>,
		)

		meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]:not([media])')
		expect(meta?.getAttribute("content")).toBe("#f5f5f5")
		expect(document.documentElement.style.background).toBe("rgb(var(--mobile-shell-track-rgb))")
		expect(interfaceStore.globalSafeAreaStyle.top).toEqual({
			backgroundColor: "rgb(var(--mobile-shell-track-rgb))",
		})
		expect(interfaceStore.globalSafeAreaStyle.bottom).toEqual({
			backgroundColor: "rgb(var(--mobile-shell-track-rgb))",
		})

		document.head.innerHTML = ""
		document.documentElement.style.background = ""
		document.body.style.background = ""
	})
})

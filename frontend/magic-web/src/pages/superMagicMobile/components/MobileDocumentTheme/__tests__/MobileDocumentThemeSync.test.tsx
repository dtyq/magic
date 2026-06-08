import { useEffect } from "react"
import { render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

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
		document.head.innerHTML = ""
		document.documentElement.style.background = ""
		document.body.style.background = ""
	})

	it("syncs closed default then shell track when sidebar opens", () => {
		document.head.innerHTML = ""
		document.documentElement.style.background = ""
		document.body.style.background = ""

		const { rerender } = render(
			<MobileDocumentThemeProvider>
				<TestTree sidebarOpen={false} />
			</MobileDocumentThemeProvider>,
		)

		let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]:not([media])')
		expect(meta?.getAttribute("content")).toBe("#fafafa")
		expect(document.documentElement.style.backgroundColor).toBe("rgb(250, 250, 250)")

		rerender(
			<MobileDocumentThemeProvider>
				<TestTree sidebarOpen={true} />
			</MobileDocumentThemeProvider>,
		)

		meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]:not([media])')
		expect(meta?.getAttribute("content")).toBe("#f5f5f5")
		expect(document.documentElement.style.backgroundColor).toBe("rgb(245, 245, 245)")
	})
})

import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import MobileShellScaffold from "../MobileShellScaffold"

vi.mock("@/models/config/hooks", () => ({
	useTheme: () => ({
		prefersColorScheme: "light",
	}),
}))

describe("MobileShellScaffold", () => {
	it("使用 relative h-full 布局而非 fixed，使 GlobalSafeArea spacer 能正常夹住内容", () => {
		render(
			<MobileShellScaffold
				isSidebarOpen={false}
				sidebar={<div>sidebar</div>}
				panel={<div>panel</div>}
				onCloseSidebar={vi.fn()}
			/>,
		)

		const root = screen.getByTestId("mobile-shell-root")
		expect(root.className).toContain("relative")
		expect(root.className).toContain("h-full")
		expect(root.className).toContain("w-full")
		expect(root.className).not.toContain("fixed")
		expect(root.className).not.toContain("h-screen")
		expect(root.className).not.toContain("w-screen")
	})

	it("侧栏关闭时轨道滑出视口左侧，主面板不偏移", () => {
		render(
			<MobileShellScaffold
				isSidebarOpen={false}
				sidebar={<div>sidebar</div>}
				panel={<div>panel</div>}
				onCloseSidebar={vi.fn()}
			/>,
		)

		const sidebar = screen.getByTestId("mobile-shell-sidebar")
		const panel = screen.getByTestId("mobile-shell-panel")

		expect(sidebar.className).toContain("-translate-x-full")
		expect(sidebar.className).not.toContain("translate-x-0")
		expect(sidebar.style.transition).toContain("0.35s")
		expect(sidebar.style.transition).toContain("cubic-bezier(0.4, 0, 0.2, 1)")
		expect(panel.className).toContain("translate-x-0")
		expect(panel.style.transition).toContain("0.35s")
		expect(panel.className).not.toContain("translate-x-[var(--mobile-shell-sidebar-width)]")
	})

	it("侧栏打开时轨道与主面板同步右移", () => {
		render(
			<MobileShellScaffold
				isSidebarOpen={true}
				sidebar={<div>sidebar</div>}
				panel={<div>panel</div>}
				onCloseSidebar={vi.fn()}
			/>,
		)

		const sidebar = screen.getByTestId("mobile-shell-sidebar")
		const panel = screen.getByTestId("mobile-shell-panel")

		expect(sidebar.className).toContain("translate-x-0")
		expect(sidebar.className).not.toContain("-translate-x-full")
		expect(panel.className).toContain("translate-x-[var(--mobile-shell-sidebar-width)]")
		expect(panel.style.transition).toMatch(/transform 0\.35s/)
		expect(panel.style.transition).toMatch(/box-shadow 0\.35s/)
	})
})

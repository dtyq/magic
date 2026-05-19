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
})

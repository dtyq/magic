import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import RecycleBinHeader from "../RecycleBinHeader"

vi.mock("@/pages/superMagicMobile/components/MobileShell", () => ({
	MobileShellSidebarToggleButton: () => (
		<button type="button" data-testid="mobile-recycle-bin-menu-button">
			menu
		</button>
	),
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

describe("RecycleBinHeader", () => {
	it("使用 mobile-page-header class（内含固定 h-14 高度），不再依赖 safe-area token（由 GlobalSafeArea spacer 统一处理）", () => {
		render(<RecycleBinHeader onFilterClick={vi.fn()} />)

		expect(screen.getByTestId("mobile-recycle-bin-header").className).toContain("mobile-page-header")
		expect(screen.getByTestId("mobile-recycle-bin-header").className).not.toContain(
			"safe-area-inset-top",
		)
	})
})

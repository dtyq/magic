import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import TrashSelectionBar from "../TrashSelectionBar"

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => key,
	}),
}))

describe("TrashSelectionBar", () => {
	it("uses mobile-background shell and upward dock shadow on action pills", () => {
		render(
			<TrashSelectionBar
				visibleTotal={3}
				isAllSelected={false}
				onToggleAll={vi.fn()}
				onRestore={vi.fn()}
				onPurge={vi.fn()}
			/>,
		)

		const root = screen.getByTestId("mobile-recycle-bin-trash-selection-bar")
		expect(root.className).toContain("bg-mobile-background")
		expect(root.className).toContain("safe-area-inset-bottom")

		expect(screen.getByTestId("mobile-recycle-bin-select-all-toggle").className).toContain(
			"shadow-magic-floating-action",
		)

		const actionGroup = screen.getByTestId("mobile-recycle-bin-bulk-restore").parentElement
		expect(actionGroup?.className).toContain("shadow-magic-floating-action")
	})
})

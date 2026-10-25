import { render, screen } from "@testing-library/react"
import type { PropsWithChildren } from "react"
import { describe, expect, it, vi } from "vitest"
import ViewModeSwitcher from "../index"

vi.mock("react-i18next", () => ({
	useTranslation: () => ({ t: (key: string) => key }),
}))

vi.mock("@/components/base", () => ({
	MagicTooltip: ({ children }: PropsWithChildren) => children,
}))

describe("ViewModeSwitcher", () => {
	it("applies the scoped test ids to the clickable mode triggers", () => {
		const onViewModeChange = vi.fn()
		render(
			<ViewModeSwitcher
				viewMode="desktop"
				onViewModeChange={onViewModeChange}
				testIdPrefix="ppt-edit-toolbar-view-mode"
				enableMobileMode={false}
			/>,
		)

		const codeTrigger = screen.getByTestId("ppt-edit-toolbar-view-mode-code-button")
		expect(codeTrigger).toHaveAttribute("role", "tab")
		expect(screen.getByTestId("ppt-edit-toolbar-view-mode-desktop-button")).toHaveAttribute(
			"role",
			"tab",
		)
		expect(
			screen.queryByTestId("ppt-edit-toolbar-view-mode-phone-button"),
		).not.toBeInTheDocument()
	})

	it("does not expose fallback ids for an inactive cached preview", () => {
		render(
			<ViewModeSwitcher
				viewMode="desktop"
				onViewModeChange={vi.fn()}
				testIdsEnabled={false}
			/>,
		)

		expect(screen.queryByTestId("view-mode-code")).not.toBeInTheDocument()
		expect(screen.queryByTestId("view-mode-desktop")).not.toBeInTheDocument()
		expect(screen.queryByTestId("view-mode-phone")).not.toBeInTheDocument()
	})
})

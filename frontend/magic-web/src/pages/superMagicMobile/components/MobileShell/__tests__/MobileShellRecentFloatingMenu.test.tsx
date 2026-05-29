import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import {
	computeRecentFloatingMenuPosition,
	MobileShellRecentFloatingMenu,
} from "../MobileShellRecentFloatingMenu"

describe("computeRecentFloatingMenuPosition", () => {
	it("places menu below the anchor when there is enough space", () => {
		const position = computeRecentFloatingMenuPosition(
			{ clientX: 40, clientY: 100 },
			5,
		)

		expect(position).toEqual({ top: 100, left: 40 })
	})

	it("flips menu above the anchor when space below is insufficient", () => {
		const position = computeRecentFloatingMenuPosition(
			{ clientX: 40, clientY: window.innerHeight - 20 },
			5,
		)

		expect(position.top).toBeLessThan(window.innerHeight - 20)
	})
})

describe("MobileShellRecentFloatingMenu", () => {
	it("renders actions and closes on backdrop click", () => {
		const onClose = vi.fn()
		const onRename = vi.fn()

		render(
			<MobileShellRecentFloatingMenu
				actions={[
					{
						key: "rename",
						label: "Rename",
						onClick: onRename,
						variant: "default",
					},
					{
						key: "delete",
						label: "Delete",
						onClick: vi.fn(),
						variant: "danger",
					},
				]}
				position={{ clientX: 24, clientY: 120 }}
				testIdPrefix="mobile-super-shell"
				onClose={onClose}
			/>,
		)

		expect(screen.getByTestId("mobile-super-shell-recent-floating-menu")).toBeInTheDocument()
		expect(screen.getByRole("menuitem", { name: "Rename" })).toHaveClass("text-foreground")
		expect(screen.getByRole("menuitem", { name: "Delete" })).toHaveClass("text-destructive")

		fireEvent.click(screen.getByTestId("mobile-super-shell-recent-floating-menu-backdrop"))

		expect(onClose).toHaveBeenCalledTimes(1)
	})
})

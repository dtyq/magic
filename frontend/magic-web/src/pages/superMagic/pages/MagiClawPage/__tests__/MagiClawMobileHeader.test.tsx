import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { MagiClawMobileHeader } from "../MagiClawMobileHeader"

vi.mock("@/pages/superMagicMobile/components/MobileShell", () => ({
	MobileShellSidebarToggleButton: () => (
		<button type="button" data-testid="magi-claw-mobile-menu-button">
			menu
		</button>
	),
}))

describe("MagiClawMobileHeader", () => {
	it("disables the create trigger when creation is not allowed", () => {
		render(
			<MagiClawMobileHeader
				title="MagiClaw"
				createAriaLabel="superLobster.created.noCreatePermission"
				disableCreateTrigger
				onOpenCreate={vi.fn()}
			/>,
		)

		const createButton = screen.getByTestId("magi-claw-mobile-create-trigger")
		expect(createButton).toBeDisabled()
		expect(createButton).toHaveAttribute(
			"aria-label",
			"superLobster.created.noCreatePermission",
		)
	})
})

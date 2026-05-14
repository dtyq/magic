import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { MagiClawMobileHeader } from "../MagiClawMobileHeader"

describe("MagiClawMobileHeader", () => {
	it("disables the create trigger when creation is not allowed", () => {
		render(
			<MagiClawMobileHeader
				title="MagiClaw"
				menuAriaLabel="open-menu"
				createAriaLabel="superLobster.created.noCreatePermission"
				disableCreateTrigger
				onOpenSidebar={vi.fn()}
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

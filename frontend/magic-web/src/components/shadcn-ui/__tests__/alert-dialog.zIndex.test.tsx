import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { AlertDialog, AlertDialogContent } from "../alert-dialog"
import { OverlayZIndexProvider } from "@/utils/overlayZIndex"

describe("AlertDialogContent z-index", () => {
	it("uses default z-modal class without inline z-index outside overlay provider", () => {
		render(
			<AlertDialog open>
				<AlertDialogContent data-testid="alert-dialog">Confirm</AlertDialogContent>
			</AlertDialog>,
		)

		const content = screen.getByTestId("alert-dialog")
		expect(content.className).toContain("z-modal")
		expect(content.style.zIndex).toBe("")
	})

	it("elevates above the host overlay inside OverlayZIndexProvider", () => {
		render(
			<OverlayZIndexProvider value={1010}>
				<AlertDialog open>
					<AlertDialogContent data-testid="alert-dialog">Confirm</AlertDialogContent>
				</AlertDialog>
			</OverlayZIndexProvider>,
		)

		const content = screen.getByTestId("alert-dialog")
		expect(content.style.zIndex).toBe("1020")
		expect(content.className).not.toContain("z-modal")
	})
})

import { render, screen, within } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { ConfirmDialog } from "./index"

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => key,
	}),
}))

describe("ConfirmDialog", () => {
	afterEach(() => {
		document.querySelectorAll("[data-testid='confirm-dialog-portal-target']").forEach((node) => {
			node.parentNode?.removeChild(node)
		})
	})

	it("renders into the provided portal container", () => {
		const portalContainer = document.createElement("div")
		portalContainer.setAttribute("data-testid", "confirm-dialog-portal-target")
		document.body.appendChild(portalContainer)

		render(
			<ConfirmDialog
				open
				title="Remove collaborator"
				description="Are you sure"
				confirmText="Confirm"
				cancelText="Cancel"
				portalContainer={portalContainer}
				onConfirm={() => {
					// noop
				}}
				onCancel={() => {
					// noop
				}}
			/>,
		)

		expect(within(portalContainer).getByTestId("confirm-dialog")).toBeInTheDocument()
		expect(screen.getByTestId("confirm-dialog-title")).toHaveTextContent("Remove collaborator")
	})
})
import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => key,
	}),
	initReactI18next: {
		type: "3rdParty",
		init: () => undefined,
	},
}))

import { RednoteEditRefreshConfirmDialog } from "../platforms/rednote/RednoteEditRefreshConfirmDialog"

describe("RednoteEditRefreshConfirmDialog", () => {
	it("renders save, discard, and cancel actions", () => {
		const onSave = vi.fn()
		const onDiscard = vi.fn()
		const onCancel = vi.fn()

		render(
			<RednoteEditRefreshConfirmDialog
				open
				onSave={onSave}
				onDiscard={onDiscard}
				onCancel={onCancel}
			/>,
		)

		fireEvent.click(screen.getByTestId("red-edit-refresh-save-btn"))
		fireEvent.click(screen.getByTestId("red-edit-refresh-discard-btn"))
		fireEvent.click(screen.getByTestId("red-edit-refresh-cancel-btn"))

		expect(onSave).toHaveBeenCalledTimes(1)
		expect(onDiscard).toHaveBeenCalledTimes(1)
		expect(onCancel).toHaveBeenCalledTimes(1)
	})
})

import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { AssetAgreementModal } from "../index"

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => key,
	}),
}))

describe("AssetAgreementModal", () => {
	it("requires accepting the commitment before confirming", async () => {
		const onClose = vi.fn()
		const onConfirm = vi.fn().mockResolvedValue(undefined)

		render(<AssetAgreementModal visible onClose={onClose} onConfirm={onConfirm} />)

		const confirmButton = screen.getByRole("button", {
			name: "assetAgreement.confirm",
		})
		expect(confirmButton).toBeDisabled()

		fireEvent.click(screen.getByRole("checkbox", { name: "assetAgreement.accept" }))

		expect(confirmButton).not.toBeDisabled()
		fireEvent.click(confirmButton)

		await waitFor(() => {
			expect(onConfirm).toHaveBeenCalledTimes(1)
			expect(onClose).toHaveBeenCalledTimes(1)
		})
	})

	it("closes without confirming when the user disagrees", () => {
		const onClose = vi.fn()

		render(<AssetAgreementModal visible onClose={onClose} />)

		fireEvent.click(screen.getByRole("button", { name: "assetAgreement.disagree" }))
		expect(onClose).toHaveBeenCalledTimes(1)
	})
})

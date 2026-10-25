import { fireEvent, render, screen } from "@testing-library/react"
import { expect, it, vi } from "vitest"
import MicroAppMobileExpiryField from "../MicroAppMobileExpiryField"
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
it("opens an expiry sheet and applies a selected duration", () => {
	const onChange = vi.fn()
	render(<MicroAppMobileExpiryField value={null} onChange={onChange} />)
	fireEvent.click(screen.getByRole("button", { name: "share.shareExpiry" }))
	expect(screen.getByRole("dialog", { name: "share.shareExpiry" })).toBeInTheDocument()
	fireEvent.click(screen.getByRole("button", { name: "share.expiry7Days" }))
	expect(onChange).toHaveBeenCalledWith(7)
})
it("dismisses the sheet without changing the expiry", () => {
	const onChange = vi.fn()
	render(<MicroAppMobileExpiryField value={7} onChange={onChange} />)
	fireEvent.click(screen.getByRole("button", { name: "share.shareExpiry" }))
	fireEvent.click(screen.getByRole("button", { name: "common.cancel" }))
	expect(onChange).not.toHaveBeenCalled()
})

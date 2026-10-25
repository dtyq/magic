import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { ContextMorePopover } from "../ContextMorePopover"

vi.mock("react-i18next", () => ({
	useTranslation: () => ({ t: (key: string) => key }),
}))

describe("ContextMorePopover", () => {
	it("reveals the sidebar More Styles section instead of opening a popover", () => {
		const onReveal = vi.fn()
		render(<ContextMorePopover onReveal={onReveal} />)

		fireEvent.click(screen.getByTestId("style-panel-more-styles-trigger"))
		expect(onReveal).toHaveBeenCalledTimes(1)
		expect(screen.queryByTestId("style-panel-more-styles-content")).not.toBeInTheDocument()
	})

	it("does not reveal when disabled", () => {
		const onReveal = vi.fn()
		render(<ContextMorePopover onReveal={onReveal} disabled />)

		fireEvent.click(screen.getByTestId("style-panel-more-styles-trigger"))
		expect(onReveal).not.toHaveBeenCalled()
	})
})

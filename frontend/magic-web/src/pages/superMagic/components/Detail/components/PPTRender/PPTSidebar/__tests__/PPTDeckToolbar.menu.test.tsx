import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import PPTDeckToolbar from "../PPTDeckToolbar"
import type { PPTDeckTools } from "../../hooks/usePPTDeckTools"

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }))

describe("PPTDeckToolbar menu availability", () => {
	it.each(["empty selection", "busy"])("blocks and dismisses the menu for %s", (reason) => {
		const tools = {
			selected: new Set(["first"]),
			selecting: true,
			busy: false,
			isAllSelected: false,
		} as PPTDeckTools
		const { rerender } = render(
			<PPTDeckToolbar tools={tools} allowEdit slideCount={3} isMobile={false} />,
		)
		const trigger = screen.getByRole("button", { name: "ppt.batch.actions" })
		fireEvent.keyDown(trigger, { key: "Enter" })
		expect(screen.getByRole("menu")).toBeInTheDocument()

		if (reason === "busy") tools.busy = true
		else tools.selected = new Set()
		rerender(<PPTDeckToolbar tools={tools} allowEdit slideCount={3} isMobile={false} />)
		expect(trigger).toBeDisabled()
		expect(screen.queryByRole("menu")).not.toBeInTheDocument()
		// Exercise the Radix handlers directly, including keyboard events on a disabled trigger.
		fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false })
		fireEvent.keyDown(trigger, { key: "Enter" })
		fireEvent.keyDown(trigger, { key: "ArrowDown" })
		expect(screen.queryByRole("menu")).not.toBeInTheDocument()

		tools.busy = false
		tools.selected = new Set(["first"])
		rerender(<PPTDeckToolbar tools={tools} allowEdit slideCount={3} isMobile={false} />)
		expect(screen.queryByRole("menu")).not.toBeInTheDocument()
		fireEvent.keyDown(trigger, { key: "Enter" })
		expect(screen.getByRole("menu")).toBeInTheDocument()
	})
})

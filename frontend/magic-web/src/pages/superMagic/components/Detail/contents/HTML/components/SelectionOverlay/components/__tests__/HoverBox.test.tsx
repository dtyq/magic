import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { HoverBox } from "../HoverBox"

describe("HoverBox", () => {
	it("uses mid-gray dashed chrome so hover stays visible on dark art", () => {
		render(<HoverBox rect={{ top: 8, left: 12, width: 80, height: 40 }} isSelectionMode />)

		const box = screen.getByTestId("html-editor-hover-box")
		expect(box.className).toContain("border-[#808080]")
		expect(box.className).toContain("border-dashed")
		expect(box.className).not.toContain("border-primary/40")
	})

	it("hides the hover frame outside selection mode", () => {
		const { container } = render(
			<HoverBox rect={{ top: 8, left: 12, width: 80, height: 40 }} isSelectionMode={false} />,
		)

		expect(container).toBeEmptyDOMElement()
	})
})

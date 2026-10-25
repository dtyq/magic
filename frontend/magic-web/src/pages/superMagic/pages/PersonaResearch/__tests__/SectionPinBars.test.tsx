import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import SectionPinBars from "../components/SectionPinBars"

const sections = [
	{ id: "templates", title: "Start from a question" },
	{ id: "studies", title: "My studies", hint: "27 total" },
]

describe("SectionPinBars", () => {
	it("pins passed sections on top and upcoming ones at the bottom", () => {
		const { container } = render(
			<SectionPinBars
				sections={sections}
				positions={{ templates: "above", studies: "below" }}
				onJump={vi.fn()}
			/>,
		)
		const [top, bottom] = Array.from(container.children)
		expect(top.className).toContain("top-0")
		expect(top.textContent).toContain("Start from a question")
		expect(bottom.className).toContain("bottom-0")
		expect(bottom.textContent).toContain("My studies")
		expect(bottom.textContent).toContain("27 total")
	})

	it("shows nothing for sections that are on screen", () => {
		const { container } = render(
			<SectionPinBars
				sections={sections}
				positions={{ templates: "visible", studies: "visible" }}
				onJump={vi.fn()}
			/>,
		)
		expect(container.children).toHaveLength(0)
	})

	it("jumps to the tapped section", () => {
		const onJump = vi.fn()
		render(
			<SectionPinBars
				sections={sections}
				positions={{ templates: "above", studies: "below" }}
				onJump={onJump}
			/>,
		)
		fireEvent.click(screen.getByTestId("persona-research-pin-studies"))
		expect(onJump).toHaveBeenCalledWith("studies")
	})
})

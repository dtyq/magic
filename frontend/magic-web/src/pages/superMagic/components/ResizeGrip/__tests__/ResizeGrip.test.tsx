import { render } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { ResizeGrip, resizeHandleGlowClass } from "../ResizeGrip"

describe("ResizeGrip", () => {
	it("renders a horizontal two-line grip without flanking rails", () => {
		const { getByTestId } = render(<ResizeGrip orientation="horizontal" />)
		const grip = getByTestId("resize-grip")

		expect(grip).toHaveAttribute("data-orientation", "horizontal")
		expect(grip.className).toContain("flex-col")
		expect(grip.className).toContain("bg-transparent")
		expect(grip.children).toHaveLength(2)
	})

	it("renders a vertical two-line grip without flanking rails", () => {
		const { getByTestId } = render(<ResizeGrip orientation="vertical" />)
		const grip = getByTestId("resize-grip")

		expect(grip).toHaveAttribute("data-orientation", "vertical")
		expect(grip.className).toContain("flex-row")
		expect(grip.className).toContain("bg-transparent")
		expect(grip.children).toHaveLength(2)
	})
})

describe("resizeHandleGlowClass", () => {
	it("uses a horizontal blue gradient for row-resize handles", () => {
		const className = resizeHandleGlowClass("horizontal")
		expect(className).toContain("before:bg-gradient-to-r")
		expect(className).not.toContain("relative")
		expect(className).not.toContain("overflow-hidden")
	})

	it("uses a vertical blue gradient for col-resize handles", () => {
		expect(resizeHandleGlowClass("vertical")).toContain("before:bg-gradient-to-b")
	})
})

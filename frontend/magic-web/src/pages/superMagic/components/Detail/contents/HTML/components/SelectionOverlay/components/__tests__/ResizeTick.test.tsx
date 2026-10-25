import { render } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { ResizeTick } from "../ResizeTick"

describe("ResizeTick", () => {
	it("renders mid-edge ticks without icons", () => {
		const { container: right } = render(<ResizeTick id="right" length={12} />)
		const { container: bottom } = render(<ResizeTick id="bottom" length={12} />)
		const { container: corner } = render(<ResizeTick id="bottom-right" />)
		const { container: unknown } = render(<ResizeTick id="left" />)

		const rightTick = right.querySelector("[data-resize-tick='right']")
		const bottomTick = bottom.querySelector("[data-resize-tick='bottom']")

		expect(rightTick?.className).toContain("html-editor-tick")
		expect(rightTick?.className).toContain("bg-[#808080]")
		expect(bottomTick?.className).toContain("html-editor-tick")
		expect(bottomTick?.className).toContain("bg-[#808080]")
		expect(right.querySelector("svg")).toBeNull()
		expect(bottom.querySelector("svg")).toBeNull()
		expect(corner.firstChild).toBeNull()
		expect(unknown.firstChild).toBeNull()
	})
})

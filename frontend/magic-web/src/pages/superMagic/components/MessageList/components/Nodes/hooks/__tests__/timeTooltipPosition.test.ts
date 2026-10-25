import { describe, expect, it } from "vitest"
import { getTimeTooltipPageLeftGutter, shouldShowTimeTooltipByGutter } from "../useTimeTooltip"

describe("shouldShowTimeTooltipByGutter", () => {
	it("hides the tooltip when the page left gutter is too narrow", () => {
		expect(shouldShowTimeTooltipByGutter(16)).toBe(false)
		expect(shouldShowTimeTooltipByGutter(99)).toBe(false)
	})

	it("shows the tooltip when the page left gutter can fit the time chip", () => {
		expect(shouldShowTimeTooltipByGutter(100)).toBe(true)
		expect(shouldShowTimeTooltipByGutter(216)).toBe(true)
	})
})

describe("getTimeTooltipPageLeftGutter", () => {
	it("measures from the page viewport left to the message column, not the hovered node", () => {
		const list = document.createElement("div")
		list.className = "message-list-container"
		const viewport = document.createElement("div")
		viewport.setAttribute("data-slot", "scroll-area-viewport")
		const column = document.createElement("div")
		const hoveredNode = document.createElement("div")
		viewport.append(column)
		column.append(hoveredNode)
		list.append(viewport)
		document.body.append(list)

		column.getBoundingClientRect = () => createSyntheticRect(216, 768)
		hoveredNode.getBoundingClientRect = () => createSyntheticRect(40, 160)

		expect(getTimeTooltipPageLeftGutter(hoveredNode)).toBe(216)

		list.remove()
	})
})

/** Builds a DOMRect-like object with synthetic coordinates for gutter tests. */
function createSyntheticRect(left: number, width: number): DOMRect {
	return {
		left,
		top: 0,
		right: left + width,
		bottom: 400,
		width,
		height: 400,
		x: left,
		y: 0,
		toJSON: () => ({ left, width }),
	} as DOMRect
}

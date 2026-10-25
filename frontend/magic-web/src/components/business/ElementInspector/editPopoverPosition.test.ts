import { describe, expect, it } from "vitest"
import { getElementEditPopoverPosition } from "./editPopoverPosition"

describe("getElementEditPopoverPosition", () => {
	it("moves to the left when the target is near the right edge", () => {
		const result = getElementEditPopoverPosition(
			{ left: 620, top: 220, width: 180, height: 80 },
			{ width: 900, height: 600 },
			{ width: 300, height: 260 },
		)

		expect(result.placement).toBe("left")
		expect(result.left).toBe(312)
		expect(result.top).toBe(220)
	})

	it("moves above a target near the bottom when horizontal space is unavailable", () => {
		const result = getElementEditPopoverPosition(
			{ left: 120, top: 500, width: 700, height: 40 },
			{ width: 900, height: 700 },
			{ width: 300, height: 260 },
		)

		expect(result.placement).toBe("top")
		expect(result.top).toBe(232)
	})

	it("moves above a target when the lower space cannot fit the full popover", () => {
		const result = getElementEditPopoverPosition(
			{ left: 120, top: 500, width: 100, height: 40 },
			{ width: 900, height: 700 },
			{ width: 300, height: 260 },
		)

		expect(result.placement).toBe("top")
		expect(result.top).toBe(232)
		expect(result.height).toBe(260)
	})

	it("keeps the popover inside the container", () => {
		const result = getElementEditPopoverPosition(
			{ left: 0, top: 0, width: 40, height: 40 },
			{ width: 240, height: 180 },
			{ width: 300, height: 260 },
		)

		expect(result.left).toBe(4)
		expect(result.top).toBe(4)
		expect(result.width).toBe(232)
		expect(result.height).toBe(172)
	})

	it("keeps its measured size while the portal container is not laid out", () => {
		const result = getElementEditPopoverPosition(
			{ left: 40, top: 40, width: 120, height: 80 },
			{ width: 0, height: 0 },
			{ width: 300, height: 260 },
		)

		expect(result.width).toBe(300)
		expect(result.height).toBe(260)
		expect(result.left).toBe(0)
		expect(result.top).toBe(0)
	})
})

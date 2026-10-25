import { describe, expect, it } from "vitest"
import { resolveFrameChildrenBounds } from "../frameCreation"

describe("resolveFrameChildrenBounds", () => {
	it("uses the union of all children and the dynamic short-edge padding", () => {
		const bounds = resolveFrameChildrenBounds([
			{ x: 8, y: 8, width: 100, height: 50 },
			{ x: 160, y: 80, width: 40, height: 20 },
		])

		expect(bounds).not.toBeNull()
		expect(bounds?.minX).toBe(8)
		expect(bounds?.maxX).toBe(200)
		expect(bounds?.minY).toBe(8)
		expect(bounds?.maxY).toBe(100)
		expect(bounds?.padding).toBeCloseTo(7.36)
		expect(bounds?.width).toBe(208)
		expect(bounds?.height).toBe(108)
	})

	it("returns no size for an empty container", () => {
		expect(resolveFrameChildrenBounds([])).toBeNull()
	})

	it("keeps an existing container size when its children already fit", () => {
		const bounds = resolveFrameChildrenBounds(
			[
				{ x: 8, y: 8, width: 100, height: 50 },
				{ x: 160, y: 80, width: 40, height: 20 },
			],
			{ existingWidth: 640, existingHeight: 480 },
		)

		expect(bounds?.width).toBe(640)
		expect(bounds?.height).toBe(480)
	})

	it("grows only the dimension that no longer contains children", () => {
		const bounds = resolveFrameChildrenBounds([{ x: 0, y: 0, width: 700, height: 40 }], {
			existingWidth: 640,
			existingHeight: 480,
		})

		expect(bounds?.width).toBeGreaterThan(640)
		expect(bounds?.height).toBe(480)
	})
})

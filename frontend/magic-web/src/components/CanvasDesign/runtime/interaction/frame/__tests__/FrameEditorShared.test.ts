import { describe, expect, it } from "vitest"
import { getFrameGridLineStrokeWidth } from "../FrameEditorShared"

describe("getFrameGridLineStrokeWidth", () => {
	it("keeps the rendered grid line at the configured visual width", () => {
		expect(getFrameGridLineStrokeWidth(1) * 1).toBe(2)
		expect(getFrameGridLineStrokeWidth(0.5) * 0.5).toBe(2)
		expect(getFrameGridLineStrokeWidth(2) * 2).toBe(2)
	})

	it("falls back safely for invalid viewport scales", () => {
		expect(getFrameGridLineStrokeWidth(0)).toBe(2)
		expect(getFrameGridLineStrokeWidth(Number.NaN)).toBe(2)
	})
})

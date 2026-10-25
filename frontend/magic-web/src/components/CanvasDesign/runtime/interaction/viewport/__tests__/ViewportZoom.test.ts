import { describe, expect, it } from "vitest"
import { getNextZoomScale } from "../viewport-zoom"

const defaultOptions = {
	fitScale: 0.3,
	minScale: 0.001,
	maxScale: 5,
}

function getNextScale(rawScale: number, direction: 1 | -1): number {
	return getNextZoomScale({
		state: { rawScale, ...defaultOptions },
		mode: "absolute-scale",
		direction,
		scaleStep: 0.1,
	})
}

describe("getNextZoomScale", () => {
	it("steps down by 0.1 percentage points at the 1% boundary", () => {
		expect(getNextScale(0.01, -1)).toBe(0.009)
		expect(getNextScale(0.009, -1)).toBe(0.008)
	})

	it("steps down by 1 percentage point at the 10% boundary", () => {
		expect(getNextScale(0.1, -1)).toBe(0.09)
	})

	it("uses the nearest lower or higher bucket for fractional percentages", () => {
		expect(getNextScale(0.0104, -1)).toBe(0.01)
		expect(getNextScale(0.0091, -1)).toBe(0.009)
		expect(getNextScale(0.0091, 1)).toBe(0.01)
	})

	it("keeps zoom-in symmetric at step boundaries", () => {
		expect(getNextScale(0.01, 1)).toBe(0.011)
		expect(getNextScale(0.1, 1)).toBe(0.11)
	})

	it("preserves the minimum scale when zooming out further", () => {
		expect(getNextScale(0.001, -1)).toBe(0.001)
	})

	it("keeps the existing large-scale step behavior", () => {
		expect(getNextScale(1, -1)).toBe(0.9)
		expect(getNextScale(0.9, -1)).toBe(0.8)
	})
})

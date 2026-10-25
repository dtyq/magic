import { describe, expect, it } from "vitest"
import {
	getContextPanelPosition,
	getContextToolbarPosition,
	getContextViewport,
	getMeasuredToolbarSize,
} from "./contextPanelPosition"

describe("getContextPanelPosition", () => {
	const getOverlapArea = (
		first: { left: number; top: number; width: number; height: number },
		second: { left: number; top: number; width: number; height: number },
	) => {
		const width = Math.max(
			0,
			Math.min(first.left + first.width, second.left + second.width) -
				Math.max(first.left, second.left),
		)
		const height = Math.max(
			0,
			Math.min(first.top + first.height, second.top + second.height) -
				Math.max(first.top, second.top),
		)
		return width * height
	}

	it("keeps the panel inside the canvas bounds when the DOM tree occupies the right side", () => {
		const result = getContextPanelPosition(
			{ left: 140, top: 120, width: 40, height: 40 },
			{ width: 180, height: 260 },
			{ left: 0, top: 80, width: 200, height: 500 },
		)

		expect(result.placement).toBe("bottom")
		expect(result.left).toBe(12)
		expect(result.top).toBe(168)
		expect(result.width).toBe(180)
		expect(result.maxHeight).toBe(260)
	})

	it("respects a non-zero canvas origin", () => {
		const result = getContextPanelPosition(
			{ left: 650, top: 240, width: 40, height: 40 },
			{ width: 240, height: 160 },
			{ left: 200, top: 100, width: 500, height: 400 },
		)

		expect(result.left).toBe(650 - 240 - 8)
		expect(result.top).toBe(240)
	})

	it("uses the top side when horizontal space is too narrow", () => {
		const result = getContextPanelPosition(
			{ left: 110, top: 460, width: 180, height: 40 },
			{ width: 180, height: 260 },
			{ left: 0, top: 80, width: 400, height: 500 },
		)

		expect(result.placement).toBe("top")
		expect(result.top).toBe(192)
		expect(result.maxHeight).toBe(260)
	})

	it("keeps the panel width when neither side can fit it", () => {
		const anchor = { left: 250, top: 120, width: 120, height: 40 }
		const viewport = { left: 0, top: 80, width: 500, height: 500 }

		const result = getContextPanelPosition(anchor, { width: 280, height: 160 }, viewport)

		expect(result.placement).toBe("bottom")
		expect(result.width).toBe(280)
	})

	it("uses the top side when the selected element is near the bottom", () => {
		const result = getContextPanelPosition(
			{ left: 100, top: 390, width: 120, height: 40 },
			{ width: 280, height: 260 },
			{ left: 0, top: 0, width: 400, height: 500 },
		)

		expect(result.placement).toBe("top")
		expect(result.width).toBe(280)
		expect(result.maxHeight).toBe(260)
	})

	it("keeps the original side-panel height and shifts it into the viewport", () => {
		const result = getContextPanelPosition(
			{ left: 240, top: 390, width: 80, height: 40 },
			{ width: 240, height: 260 },
			{ left: 0, top: 0, width: 600, height: 500 },
		)

		expect(result.placement).toBe("right")
		expect(result.width).toBe(240)
		expect(result.maxHeight).toBe(260)
		expect(result.top).toBe(232)
	})

	it("keeps a large panel outside the selected element when it cannot fit at full size", () => {
		const anchor = { left: 100, top: 80, width: 240, height: 120 }
		const result = getContextPanelPosition(
			anchor,
			{ width: 360, height: 260 },
			{ left: 0, top: 0, width: 400, height: 300 },
		)

		expect(getOverlapArea({ ...result, height: result.maxHeight }, anchor)).toBe(0)
		expect(result.placement).toBe("bottom")
		expect(result.width).toBe(360)
		expect(result.maxHeight).toBe(92)
	})

	it("minimizes unavoidable overlap for an element that fills the canvas", () => {
		const anchor = { left: 8, top: 8, width: 384, height: 284 }
		const result = getContextPanelPosition(
			anchor,
			{ width: 360, height: 260 },
			{ left: 0, top: 0, width: 400, height: 300 },
		)

		expect(result.placement).toBe("right")
		expect(result.width).toBe(1)
		expect(result.maxHeight).toBe(260)
		expect(getOverlapArea({ ...result, height: result.maxHeight }, anchor)).toBeLessThanOrEqual(
			260,
		)
	})
})

describe("getContextToolbarPosition", () => {
	it("centers the fit-content toolbar above the selected element", () => {
		const result = getContextToolbarPosition(
			{ left: 200, top: 200, width: 200, height: 40 },
			{ width: 320, height: 48 },
			{ width: 800, height: 600 },
		)

		expect(result).toEqual({ left: 140, top: 84, width: 320, placement: "top" })
	})

	it("falls below when there is not enough room above", () => {
		const result = getContextToolbarPosition(
			{ left: 200, top: 20, width: 200, height: 40 },
			{ width: 320, height: 48 },
			{ width: 800, height: 600 },
		)

		expect(result).toEqual({ left: 140, top: 68, width: 320, placement: "bottom" })
	})

	it("falls above when there is not enough room below", () => {
		const result = getContextToolbarPosition(
			{ left: 200, top: 500, width: 200, height: 40 },
			{ width: 320, height: 48 },
			{ width: 800, height: 600 },
		)

		expect(result).toEqual({ left: 140, top: 384, width: 320, placement: "top" })
	})

	it("uses the side with more visible room when neither side fully fits", () => {
		const result = getContextToolbarPosition(
			{ left: 200, top: 100, width: 200, height: 40 },
			{ width: 320, height: 120 },
			{ width: 800, height: 220 },
		)

		expect(result.placement).toBe("bottom")
		expect(result.top).toBe(92)
	})

	it("limits width only when the window is narrower than the content", () => {
		const result = getContextToolbarPosition(
			{ left: 80, top: 100, width: 120, height: 40 },
			{ width: 680, height: 48 },
			{ width: 400, height: 600 },
			8,
			{ windowSize: { width: 400, height: 600 } },
		)

		expect(result.width).toBe(384)
		expect(result.left).toBe(8)
	})

	it("keeps a measured toolbar wider than the canvas inside the window", () => {
		const result = getContextToolbarPosition(
			{ left: 220, top: 200, width: 80, height: 40 },
			{ width: 600, height: 88 },
			{ left: 200, top: 80, width: 160, height: 500 },
			8,
			{ windowSize: { width: 1024, height: 768 } },
		)

		expect(result.width).toBe(600)
		expect(result.left).toBeGreaterThanOrEqual(8)
		expect(result.left + result.width).toBeLessThanOrEqual(1016)
	})

	it("keeps the minimum width when the canvas is narrower than the toolbar", () => {
		const result = getContextToolbarPosition(
			{ left: 220, top: 200, width: 80, height: 40 },
			{ width: 448, height: 88 },
			{ left: 200, top: 80, width: 160, height: 500 },
			8,
			{ windowSize: { width: 1024, height: 768 } },
		)

		expect(result.width).toBe(448)
		expect(result.left).toBeGreaterThanOrEqual(8)
		expect(result.left + result.width).toBeLessThanOrEqual(1016)
		expect(result.left + result.width).toBeGreaterThan(360)
	})
})

describe("getContextViewport", () => {
	it("falls back to the window when the canvas bounds are missing", () => {
		expect(getContextViewport(null)).toEqual({
			left: 0,
			top: 0,
			width: window.innerWidth,
			height: window.innerHeight,
		})
	})

	it("clips canvas bounds to the visible window", () => {
		expect(getContextViewport({ left: -20, top: 40, width: 500, height: 2000 })).toEqual({
			left: 0,
			top: 40,
			width: Math.min(window.innerWidth, 480),
			height: Math.min(window.innerHeight - 40, 2000),
		})
	})
})

describe("getMeasuredToolbarSize", () => {
	it("returns null before the toolbar has a real width", () => {
		expect(getMeasuredToolbarSize({ width: 0, height: 0 }, 680, 48)).toBeNull()
		expect(getMeasuredToolbarSize(undefined, 680, 48)).toBeNull()
	})

	it("keeps a short toolbar narrower than the wrap cap", () => {
		expect(getMeasuredToolbarSize({ width: 320, height: 48 }, 680, 48)).toEqual({
			width: 320,
			height: 48,
		})
	})

	it("caps a wrapped toolbar and keeps the measured height", () => {
		expect(getMeasuredToolbarSize({ width: 720, height: 88 }, 680, 48)).toEqual({
			width: 680,
			height: 88,
		})
	})
})

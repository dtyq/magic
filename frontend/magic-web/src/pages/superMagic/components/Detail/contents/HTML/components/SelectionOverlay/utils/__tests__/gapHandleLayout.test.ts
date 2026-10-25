import { describe, expect, it } from "vitest"
import {
	applyGapPreviewToChildRects,
	getGapHandleLayout,
	getInFlowChildRects,
	mapGapHandlesToSelectionBox,
} from "../gapHandleLayout"

const container = { top: 0, left: 0, width: 220, height: 220 }

describe("getGapHandleLayout", () => {
	it("returns no handles for a heading display", () => {
		expect(
			getGapHandleLayout(
				container,
				[
					{ top: 0, left: 0, width: 100, height: 40 },
					{ top: 0, left: 120, width: 100, height: 40 },
				],
				"block",
			),
		).toEqual([])
	})

	it("returns no handles when only one in-flow child exists", () => {
		expect(
			getGapHandleLayout(container, [{ top: 10, left: 10, width: 80, height: 80 }], "flex"),
		).toEqual([])
	})

	it("returns a column handle for a horizontal pair", () => {
		const frames = getGapHandleLayout(
			container,
			[
				{ top: 10, left: 10, width: 80, height: 80 },
				{ top: 10, left: 110, width: 80, height: 80 },
			],
			"flex",
		)
		expect(frames).toHaveLength(1)
		expect(frames[0].axis).toBe("column")
		expect(frames[0].cursor).toBe("col-resize")
		expect(frames[0].width).toBeGreaterThanOrEqual(8)
		expect(frames[0].id).toBe("column:0:1")
	})

	it("keeps the same pair id when the gutter grows", () => {
		const pair = [
			{ top: 10, left: 10, width: 80, height: 80 },
			{ top: 10, left: 110, width: 80, height: 80 },
		]
		const grown = [pair[0], { top: 10, left: 130, width: 80, height: 80 }]
		expect(getGapHandleLayout(container, pair, "flex")[0].id).toBe(
			getGapHandleLayout(container, grown, "flex")[0].id,
		)
	})

	it("returns a short tick in every 2x2 gutter", () => {
		const frames = getGapHandleLayout(
			container,
			[
				{ top: 10, left: 10, width: 80, height: 80 },
				{ top: 10, left: 110, width: 80, height: 80 },
				{ top: 110, left: 10, width: 80, height: 80 },
				{ top: 110, left: 110, width: 80, height: 80 },
			],
			"grid",
		)
		const columns = frames.filter((frame) => frame.axis === "column")
		const rows = frames.filter((frame) => frame.axis === "row")
		expect(columns).toHaveLength(2)
		expect(rows).toHaveLength(2)
		expect(new Set(frames.map((frame) => frame.id)).size).toBe(4)
	})

	it("returns one column tick per adjacent pair in a row", () => {
		const frames = getGapHandleLayout(
			container,
			[
				{ top: 10, left: 10, width: 40, height: 40 },
				{ top: 10, left: 60, width: 40, height: 40 },
				{ top: 10, left: 110, width: 40, height: 40 },
			],
			"flex",
		)
		expect(frames.filter((frame) => frame.axis === "column")).toHaveLength(2)
		expect(frames.filter((frame) => frame.axis === "row")).toHaveLength(0)
	})

	it("keeps a compact tick when the gutter is zero", () => {
		const frames = getGapHandleLayout(
			container,
			[
				{ top: 0, left: 0, width: 100, height: 40 },
				{ top: 0, left: 100, width: 100, height: 40 },
			],
			"flex",
		)
		expect(frames[0].width).toBe(16)
		expect(frames[0].height).toBe(16)
	})

	it("keeps a compact tick at the gutter center when the gap is large", () => {
		const frames = getGapHandleLayout(
			container,
			[
				{ top: 10, left: 10, width: 40, height: 80 },
				{ top: 10, left: 150, width: 40, height: 80 },
			],
			"flex",
		)
		expect(frames[0].width).toBe(16)
		expect(frames[0].height).toBe(16)
		expect(frames[0].left + frames[0].width / 2).toBeCloseTo(100)
	})

	it("keeps scaled gutter ticks inside the selection box", () => {
		const frames = getGapHandleLayout(
			container,
			[
				{ top: 10, left: 10, width: 80, height: 80 },
				{ top: 10, left: 110, width: 80, height: 80 },
			],
			"flex",
		)
		const mapped = mapGapHandlesToSelectionBox(frames, container, 0.5)
		expect(mapped).toHaveLength(1)
		expect(mapped[0].left).toBeCloseTo(frames[0].left * 0.5)
		expect(mapped[0].left + mapped[0].width).toBeLessThanOrEqual(container.width * 0.5)
		expect(mapped[0].top + mapped[0].height).toBeLessThanOrEqual(container.height * 0.5)
	})

	it("shifts later siblings when previewing a larger column gap", () => {
		const next = applyGapPreviewToChildRects(
			[
				{ top: 10, left: 10, width: 80, height: 80 },
				{ top: 10, left: 110, width: 80, height: 80 },
				{ top: 110, left: 10, width: 80, height: 80 },
				{ top: 110, left: 110, width: 80, height: 80 },
			],
			"column",
			20,
			false,
		)
		expect(next[0].left).toBe(10)
		expect(next[1].left).toBe(130)
		expect(next[2].left).toBe(10)
		expect(next[3].left).toBe(130)
		expect(next[1].top).toBe(10)
		expect(next[3].top).toBe(110)
	})

	it("ignores absolute and display-none children", () => {
		expect(
			getInFlowChildRects([
				{ top: 0, left: 0, width: 80, height: 80, position: "absolute" },
				{ top: 0, left: 100, width: 80, height: 80, display: "none" },
				{ top: 0, left: 0, width: 80, height: 80 },
			]),
		).toHaveLength(1)
	})
})

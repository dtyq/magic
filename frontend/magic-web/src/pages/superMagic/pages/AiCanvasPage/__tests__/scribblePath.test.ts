import { describe, expect, it } from "vitest"
import { buildTaperedOutline, scribbleToPathData, type Scribble } from "../utils/scribblePath"

const LINE: Scribble = {
	start: [0, 0],
	segments: [
		[
			[10, 0],
			[20, 0],
			[30, 0],
		],
	],
}

/** Absolute coordinates of every L command in an outline. */
function linePoints(outline: string) {
	return Array.from(outline.matchAll(/L(-?[\d.]+) (-?[\d.]+)/g)).map(([, x, y]) => [
		Number(x),
		Number(y),
	])
}

describe("scribblePath", () => {
	it("writes the centerline as cubic path data", () => {
		expect(scribbleToPathData(LINE)).toBe("M0 0 C10 0 20 0 30 0")
	})

	it("tapers the outline from the start width to the end width", () => {
		const outline = buildTaperedOutline(LINE, {
			startWidth: 4,
			endWidth: 1,
			samplesPerSegment: 4,
		})
		expect(outline.startsWith("M0 -2 A2 2 0 0 0 0 2")).toBe(true)
		expect(outline.endsWith("Z")).toBe(true)

		const points = linePoints(outline)
		// Left side runs forward; its last sample is the pen lift, half of the end width.
		expect(points[3]).toEqual([30, 0.5])
		// The right side comes back, ending where the pen landed.
		expect(points[points.length - 1]).toEqual([0, -2])
	})
})

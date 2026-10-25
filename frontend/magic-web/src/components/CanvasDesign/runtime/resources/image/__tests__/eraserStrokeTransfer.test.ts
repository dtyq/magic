import { describe, expect, it } from "vitest"
import { flattenEraserStrokes } from "../eraserStrokeTransfer"
import { getSubmitImageWorkerTransferables } from "../../upload/submitImageWorkerProtocol"

describe("eraser stroke transfer", () => {
	it("keeps stroke mode and chronological point ordering", () => {
		const flattened = flattenEraserStrokes([
			{ mode: "erase", radius: 10.4, points: [{ x: 1, y: 2 }] },
			{
				mode: "restore",
				radius: 20.6,
				points: [
					{ x: 3, y: 4 },
					{ x: 5, y: 6 },
				],
			},
		])

		expect(Array.from(flattened.meta)).toEqual([0, 1, 10, 1, 2, 21])
		expect(Array.from(flattened.modes)).toEqual([0, 1])
		expect(Array.from(flattened.points)).toEqual([1, 2, 3, 4, 5, 6])
	})

	it("transfers all typed-array buffers to the worker", () => {
		const strokes = flattenEraserStrokes([
			{ mode: "restore", radius: 12, points: [{ x: 1, y: 1 }] },
		])
		const transferables = getSubmitImageWorkerTransferables({
			type: "erase",
			requestId: "erase-1",
			elementSize: {},
			sourceDimensions: { width: 10, height: 10 },
			strokes,
		})

		expect(transferables).toEqual([
			strokes.meta.buffer,
			strokes.modes.buffer,
			strokes.points.buffer,
		])
	})
})

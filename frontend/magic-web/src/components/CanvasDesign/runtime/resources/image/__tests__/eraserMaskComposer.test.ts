import { afterEach, describe, expect, it, vi } from "vitest"
import { createEraserMaskFile } from "../eraserMaskComposer"

afterEach(() => {
	vi.restoreAllMocks()
})

describe("createEraserMaskFile", () => {
	it("replays erase and restore strokes in chronological white-black order", async () => {
		const strokeStyles: string[] = []
		const context = {
			fillStyle: "",
			strokeStyle: "",
			lineCap: "butt",
			lineJoin: "miter",
			lineWidth: 1,
			fillRect: vi.fn(),
			save: vi.fn(),
			restore: vi.fn(),
			scale: vi.fn(),
			beginPath: vi.fn(),
			moveTo: vi.fn(),
			lineTo: vi.fn(),
			stroke() {
				strokeStyles.push(this.strokeStyle)
			},
		} as unknown as CanvasRenderingContext2D
		vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(context)
		vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation((callback) => {
			callback(new Blob(["mask"], { type: "image/png" }))
		})

		await createEraserMaskFile({
			element: { width: 100, height: 100 },
			naturalWidth: 100,
			naturalHeight: 100,
			strokes: [
				{ mode: "erase", radius: 10, points: [{ x: 10, y: 10 }] },
				{ mode: "restore", radius: 10, points: [{ x: 20, y: 20 }] },
				{ mode: "erase", radius: 10, points: [{ x: 30, y: 30 }] },
			],
		})

		expect(strokeStyles).toEqual(["#fff", "#000", "#fff"])
	})
})

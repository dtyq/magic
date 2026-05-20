import { describe, expect, it } from "vitest"
import { canvasToSinglePdfPage } from "../src/capture/pageCapture"

describe("canvas capture helpers", () => {
	it("converts a full canvas into a single dynamic PDF page", async () => {
		const canvas = {
			width: 1920,
			height: 1080,
			toBlob: (callback: (blob: Blob | null) => void) => {
				callback(new Blob(["image"], { type: "image/jpeg" }))
			},
		} as HTMLCanvasElement

		const page = await canvasToSinglePdfPage({
			canvas,
			imageType: "jpeg",
			imageQuality: 0.95,
			pixelRatio: 2,
		})

		expect(page.imageType).toBe("jpeg")
		expect(page.imageBytes.byteLength).toBeGreaterThan(0)
		expect(page.widthMm).toBeCloseTo(254)
		expect(page.heightMm).toBeCloseTo(142.875)
		expect(canvas.width).toBe(0)
		expect(canvas.height).toBe(0)
	})
})

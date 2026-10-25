import { describe, expect, it } from "vitest"
import { getEraserMaskStrokeStyle } from "../eraserMaskOperations"

describe("eraser mask operations", () => {
	it("paints erase as white and restore as black", () => {
		expect(getEraserMaskStrokeStyle("erase")).toBe("#fff")
		expect(getEraserMaskStrokeStyle("restore")).toBe("#000")
	})
})

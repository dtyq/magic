import { describe, expect, it } from "vitest"
import { isCanvasZoomWheel, shouldForwardWheelToCanvas } from "../ViewportWheelPolicy"

describe("isCanvasZoomWheel", () => {
	it("prioritizes trackpad pinch modifiers over local scroll", () => {
		expect(isCanvasZoomWheel({ ctrlKey: true, metaKey: false })).toBe(true)
		expect(isCanvasZoomWheel({ ctrlKey: false, metaKey: true })).toBe(true)
		expect(isCanvasZoomWheel({ ctrlKey: false, metaKey: false })).toBe(false)
	})

	it("keeps normal wheel local only when the local list can scroll", () => {
		expect(shouldForwardWheelToCanvas({ ctrlKey: false, metaKey: false }, true)).toBe(false)
		expect(shouldForwardWheelToCanvas({ ctrlKey: false, metaKey: false }, false)).toBe(true)
		expect(shouldForwardWheelToCanvas({ ctrlKey: true, metaKey: false }, true)).toBe(true)
	})
})

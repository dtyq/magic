import { describe, expect, it } from "vitest"
import { resolveBottomFloatingStackOffsets } from "./BottomFloatingStackProvider"

describe("resolveBottomFloatingStackOffsets", () => {
	it("stacks surfaces per element using measured heights", () => {
		const offsets = resolveBottomFloatingStackOffsets(
			new Map([
				["editor", { elementId: "image-1", order: 1, height: 180 }],
				["toolbar", { elementId: "image-1", order: 0, height: 42 }],
				["other-editor", { elementId: "video-1", order: 1, height: 200 }],
			]),
		)

		expect(offsets.get("toolbar")).toBe(0)
		expect(offsets.get("editor")).toBe(54)
		expect(offsets.get("other-editor")).toBe(0)
	})

	it("does not add an empty toolbar offset", () => {
		const offsets = resolveBottomFloatingStackOffsets(
			new Map([["editor", { elementId: "image-1", order: 1, height: 180 }]]),
		)

		expect(offsets.get("editor")).toBe(0)
	})
})

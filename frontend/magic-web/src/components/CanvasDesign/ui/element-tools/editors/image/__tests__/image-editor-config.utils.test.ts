import { describe, expect, it } from "vitest"
import {
	buildImageSelectValue,
	normalizeImageSizeValue,
	resolveImageSizeOptionFromRequest,
} from "../image-editor-config.utils"

const seedreamSizes = [
	{ label: "1:1", value: "2048x2048", scale: "2K" },
	{ label: "4:3", value: "2304x1728", scale: "2K" },
	{ label: "16:9", value: "2560x1440", scale: "2K" },
]

describe("resolveImageSizeOptionFromRequest", () => {
	it("normalizes temporary select values before restoring or displaying a size", () => {
		const encoded = buildImageSelectValue("1:1", "2048x2048")

		expect(normalizeImageSizeValue(encoded)).toBe("2048x2048")
		expect(normalizeImageSizeValue("2048x2048")).toBe("2048x2048")
		expect(
			resolveImageSizeOptionFromRequest({
				sizes: seedreamSizes,
				request: { size: encoded },
				preferredResolution: "2K",
			})?.size,
		).toEqual(seedreamSizes[0])
	})

	it("restores a saved size even when the request has no resolution", () => {
		const resolved = resolveImageSizeOptionFromRequest({
			sizes: seedreamSizes,
			request: {
				size: "2304x1728",
			},
			preferredResolution: "2K",
		})

		expect(resolved?.size).toEqual({
			label: "4:3",
			value: "2304x1728",
			scale: "2K",
		})
		expect(resolved?.resolution).toBe("2K")
	})

	it("prefers an exact size and resolution match when both are present", () => {
		const resolved = resolveImageSizeOptionFromRequest({
			sizes: [
				{ label: "small", value: "1024x1024", scale: "1K" },
				{ label: "large", value: "1024x1024", scale: "2K" },
			],
			request: {
				size: "1024x1024",
				resolution: "2K",
			},
		})

		expect(resolved?.size.label).toBe("large")
		expect(resolved?.resolution).toBe("2K")
	})
})

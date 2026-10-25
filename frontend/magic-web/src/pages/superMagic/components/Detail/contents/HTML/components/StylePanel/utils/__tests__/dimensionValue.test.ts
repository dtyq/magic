import { describe, expect, it } from "vitest"
import {
	formatUsedSizeLabel,
	getDeclaredDimension,
	getDimensionField,
	shouldKeepAuthoredDimension,
} from "../dimensionValue"

describe("getDeclaredDimension", () => {
	it("prefers the inline unit over the computed pixel value", () => {
		expect(
			getDeclaredDimension(
				{
					inlineStyles: { width: "50%" },
					computedStyles: { width: "320px", height: "180px" },
				},
				"width",
			),
		).toBe("50%")
	})

	it("falls back to the computed value when no inline unit exists", () => {
		expect(
			getDeclaredDimension(
				{
					computedStyles: { width: "320px", height: "180px" },
				},
				"height",
			),
		).toBe("180px")
	})

	it("returns auto when neither inline nor computed size exists", () => {
		expect(getDeclaredDimension(null, "width")).toBe("auto")
	})

	it("follows an external resize that overwrites a percent with px", () => {
		expect(
			getDimensionField(
				{
					inlineStyles: { width: "400px" },
					computedStyles: { width: "400px" },
				},
				"width",
			),
		).toEqual({ value: "400px", fromInline: true })
	})
})

describe("shouldKeepAuthoredDimension", () => {
	it("keeps a percent when a later refresh only has computed px", () => {
		expect(shouldKeepAuthoredDimension("%", "508px")).toBe(true)
	})

	it("replaces a percent when the incoming px was written inline", () => {
		expect(shouldKeepAuthoredDimension("%", "400px", true)).toBe(false)
	})
})

describe("formatUsedSizeLabel", () => {
	it("rounds computed pixels to a whole px label", () => {
		expect(formatUsedSizeLabel("28.7969px")).toBe("29px")
	})

	it("keeps non-pixel units as authored", () => {
		expect(formatUsedSizeLabel("50%")).toBe("50%")
	})

	it("falls back to auto when size is missing", () => {
		expect(formatUsedSizeLabel(undefined)).toBe("auto")
	})
})

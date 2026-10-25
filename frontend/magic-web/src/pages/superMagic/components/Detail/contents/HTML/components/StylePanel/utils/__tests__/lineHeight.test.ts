import { describe, expect, it } from "vitest"
import {
	areLineHeightsEquivalent,
	getAuthoredLineHeight,
	getEquivalentLineHeight,
	resolveDisplayLineHeight,
} from "../lineHeight"

describe("lineHeight", () => {
	it("converts a unitless ratio to pixels at the current font size", () => {
		expect(getEquivalentLineHeight("1.2", "100px")).toBe("120px")
		expect(getEquivalentLineHeight("120px", "100px")).toBe("1.2")
	})

	it("treats a preserved ratio as equivalent to its computed pixel value", () => {
		expect(areLineHeightsEquivalent("1.2", "120px", "100px")).toBe(true)
		expect(areLineHeightsEquivalent("1.2", "120px", "100")).toBe(true)
	})

	it("rejects a preserved ratio after an external line-height change", () => {
		expect(areLineHeightsEquivalent("1.2", "24px", "100px")).toBe(false)
		expect(areLineHeightsEquivalent("1.2", "1.5", "100px")).toBe(false)
	})

	it("shows keywords and ratios instead of used pixels", () => {
		expect(resolveDisplayLineHeight("95.68px")).toBe("normal")
		expect(resolveDisplayLineHeight("normal")).toBe("normal")
		expect(resolveDisplayLineHeight("1.04")).toBe("1.04")
		expect(resolveDisplayLineHeight("1.04em")).toBe("1.04em")
		expect(resolveDisplayLineHeight("95.68px", "normal")).toBe("normal")
		expect(resolveDisplayLineHeight("95.68px", "1.04")).toBe("1.04")
		expect(resolveDisplayLineHeight("95.68px", "95.68px")).toBe("95.68px")
	})

	it("reads authored line-height from camelCase or kebab-case inline styles", () => {
		expect(getAuthoredLineHeight({ lineHeight: "1.2" })).toBe("1.2")
		expect(getAuthoredLineHeight({ "line-height": "24px" })).toBe("24px")
		expect(getAuthoredLineHeight({ lineHeight: "24px !important" })).toBe("24px")
		expect(getAuthoredLineHeight({})).toBeUndefined()
	})
})

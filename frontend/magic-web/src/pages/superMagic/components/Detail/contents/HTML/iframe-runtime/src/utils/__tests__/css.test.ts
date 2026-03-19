/**
 * CSS utility functions tests
 */

import { describe, it, expect } from "vitest"
import {
	camelToKebab,
	kebabToCamel,
	rgbToHex,
	normalizeColor,
	normalizeTextAlign,
	normalizeDefaultValue,
} from "../css"

describe("css utils", () => {
	describe("camelToKebab", () => {
		it("should convert camelCase to kebab-case", () => {
			expect(camelToKebab("backgroundColor")).toBe("background-color")
			expect(camelToKebab("fontSize")).toBe("font-size")
			expect(camelToKebab("marginTop")).toBe("margin-top")
		})

		it("should handle single word", () => {
			expect(camelToKebab("color")).toBe("color")
			expect(camelToKebab("margin")).toBe("margin")
		})

		it("should handle multiple uppercase letters", () => {
			expect(camelToKebab("WebkitTransform")).toBe("webkit-transform")
			expect(camelToKebab("MozBorderRadius")).toBe("moz-border-radius")
		})

		it("should handle numbers in string", () => {
			expect(camelToKebab("grid2Column")).toBe("grid2-column")
			expect(camelToKebab("flex1Basis")).toBe("flex1-basis")
		})

		it("should handle empty string", () => {
			expect(camelToKebab("")).toBe("")
		})
	})

	describe("kebabToCamel", () => {
		it("should convert kebab-case to camelCase", () => {
			expect(kebabToCamel("background-color")).toBe("backgroundColor")
			expect(kebabToCamel("font-size")).toBe("fontSize")
			expect(kebabToCamel("margin-top")).toBe("marginTop")
		})

		it("should handle single word", () => {
			expect(kebabToCamel("color")).toBe("color")
			expect(kebabToCamel("margin")).toBe("margin")
		})

		it("should handle multiple dashes", () => {
			expect(kebabToCamel("border-top-left-radius")).toBe("borderTopLeftRadius")
			expect(kebabToCamel("grid-template-columns")).toBe("gridTemplateColumns")
		})

		it("should handle empty string", () => {
			expect(kebabToCamel("")).toBe("")
		})

		it("should handle vendor prefixes", () => {
			expect(kebabToCamel("-webkit-transform")).toBe("WebkitTransform")
			expect(kebabToCamel("-moz-border-radius")).toBe("MozBorderRadius")
		})
	})

	describe("rgbToHex", () => {
		it("should convert rgb to hex", () => {
			expect(rgbToHex("rgb(255, 255, 255)")).toBe("#ffffff")
			expect(rgbToHex("rgb(0, 0, 0)")).toBe("#000000")
			expect(rgbToHex("rgb(255, 0, 0)")).toBe("#ff0000")
		})

		it("should handle rgba format", () => {
			expect(rgbToHex("rgba(255, 255, 255, 0.5)")).toBe("#ffffff")
			expect(rgbToHex("rgba(128, 64, 32, 0.8)")).toBe("#804020")
		})

		it("should handle rgb with different spacing", () => {
			expect(rgbToHex("rgb(255,255,255)")).toBe("#ffffff")
			expect(rgbToHex("rgb(10, 20, 30)")).toBe("#0a141e")
		})

		it("should return input if already hex", () => {
			expect(rgbToHex("#ffffff")).toBe("#ffffff")
			expect(rgbToHex("#000")).toBe("#000")
		})

		it("should return input if not valid rgb format", () => {
			expect(rgbToHex("transparent")).toBe("transparent")
			expect(rgbToHex("blue")).toBe("blue")
			expect(rgbToHex("invalid")).toBe("invalid")
		})

		it("should handle single digit hex conversion", () => {
			expect(rgbToHex("rgb(1, 2, 3)")).toBe("#010203")
			expect(rgbToHex("rgb(15, 16, 17)")).toBe("#0f1011")
		})
	})

	describe("normalizeColor", () => {
		it("should convert rgb to hex", () => {
			expect(normalizeColor("rgb(255, 255, 255)")).toBe("#ffffff")
			expect(normalizeColor("rgba(255, 0, 0, 0.5)")).toBe("#ff0000")
		})

		it("should return black for transparent/none", () => {
			expect(normalizeColor("transparent")).toBe("#000000")
			expect(normalizeColor("none")).toBe("#000000")
		})

		it("should return black for empty string", () => {
			expect(normalizeColor("")).toBe("#000000")
		})

		it("should pass through hex colors", () => {
			expect(normalizeColor("#ffffff")).toBe("#ffffff")
			expect(normalizeColor("#f00")).toBe("#f00")
		})

		it("should pass through named colors", () => {
			expect(normalizeColor("red")).toBe("red")
			expect(normalizeColor("blue")).toBe("blue")
		})
	})

	describe("normalizeTextAlign", () => {
		it("should convert start to left", () => {
			expect(normalizeTextAlign("start")).toBe("left")
		})

		it("should convert end to right", () => {
			expect(normalizeTextAlign("end")).toBe("right")
		})

		it("should pass through standard values", () => {
			expect(normalizeTextAlign("left")).toBe("left")
			expect(normalizeTextAlign("center")).toBe("center")
			expect(normalizeTextAlign("right")).toBe("right")
			expect(normalizeTextAlign("justify")).toBe("justify")
		})

		it("should return left for invalid values", () => {
			expect(normalizeTextAlign("invalid")).toBe("left")
			expect(normalizeTextAlign("")).toBe("left")
			expect(normalizeTextAlign("top")).toBe("left")
		})
	})

	describe("normalizeDefaultValue", () => {
		it("should return empty string for default values", () => {
			expect(normalizeDefaultValue("normal", "fontWeight")).toBe("")
			expect(normalizeDefaultValue("none", "display")).toBe("")
			expect(normalizeDefaultValue("auto", "width")).toBe("")
		})

		it("should pass through non-default values", () => {
			expect(normalizeDefaultValue("bold", "fontWeight")).toBe("bold")
			expect(normalizeDefaultValue("10px", "fontSize")).toBe("10px")
			expect(normalizeDefaultValue("red", "color")).toBe("red")
		})

		it("should handle empty string", () => {
			expect(normalizeDefaultValue("", "property")).toBe("")
		})

		it("should be case sensitive", () => {
			expect(normalizeDefaultValue("Normal", "fontWeight")).toBe("Normal")
			expect(normalizeDefaultValue("NONE", "display")).toBe("NONE")
		})
	})
})

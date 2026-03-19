import { describe, it, expect } from "vitest"
import PreprocessService from "../index"

describe("PreprocessService - Superscript and Subscript", () => {
	const preprocessService = PreprocessService

	describe("Superscript", () => {
		it("should convert ^2^ to <sup>2</sup>", () => {
			const input = "X^2^"
			const result = preprocessService.preprocess(input)
			expect(result.join("")).toContain("<sup>2</sup>")
		})

		it("should handle multiple superscripts", () => {
			const input = "X^2^ + Y^3^"
			const result = preprocessService.preprocess(input)
			const output = result.join("")
			expect(output).toContain("<sup>2</sup>")
			expect(output).toContain("<sup>3</sup>")
		})

		it("should handle complex superscript content", () => {
			const input = "E^mc2^"
			const result = preprocessService.preprocess(input)
			expect(result.join("")).toContain("<sup>mc2</sup>")
		})

		it("should not convert single ^ without closing ^", () => {
			const input = "X^2 + Y"
			const result = preprocessService.preprocess(input)
			expect(result.join("")).toBe("X^2 + Y")
		})
	})

	describe("Subscript", () => {
		it("should convert ~2~ to <sub>2</sub>", () => {
			const input = "H~2~O"
			const result = preprocessService.preprocess(input)
			expect(result.join("")).toContain("<sub>2</sub>")
		})

		it("should handle multiple subscripts", () => {
			const input = "H~2~O + CO~2~"
			const result = preprocessService.preprocess(input)
			const output = result.join("")
			expect(output).toContain("<sub>2</sub>")
			expect(output).toContain("<sub>2</sub>")
		})

		it("should handle complex subscript content", () => {
			const input = "C~6H12O6~"
			const result = preprocessService.preprocess(input)
			expect(result.join("")).toContain("<sub>6H12O6</sub>")
		})

		it("should not convert single ~ without closing ~", () => {
			const input = "H~2O"
			const result = preprocessService.preprocess(input)
			expect(result.join("")).toBe("H~2O")
		})
	})

	describe("Mixed superscript and subscript", () => {
		it("should handle both superscript and subscript in same text", () => {
			const input = "The formula is H~2~O^2^"
			const result = preprocessService.preprocess(input)
			const output = result.join("")
			expect(output).toContain("<sub>2</sub>")
			expect(output).toContain("<sup>2</sup>")
		})

		it("should not interfere with strikethrough syntax", () => {
			const input = "~~strikethrough~~ and H~2~O"
			const result = preprocessService.preprocess(input)
			const output = result.join("")
			expect(output).toContain('<span class="strikethrough">strikethrough</span>')
			expect(output).toContain("<sub>2</sub>")
		})

		it("should handle complex cases with strikethrough and subscript", () => {
			const input = "~~This is deleted~~ but H~2~O is not"
			const result = preprocessService.preprocess(input)
			const output = result.join("")
			expect(output).toContain('<span class="strikethrough">This is deleted</span>')
			expect(output).toContain("H<sub>2</sub>O")
		})
	})

	describe("Edge cases", () => {
		it("should handle empty content between markers", () => {
			const input = "X^^ and H~~O"
			const result = preprocessService.preprocess(input)
			// Empty content should not be converted
			expect(result.join("")).toBe("X^^ and H~~O")
		})

		it("should handle whitespace in content", () => {
			const input = "X^2 + 3^ should not work"
			const result = preprocessService.preprocess(input)
			// Content with spaces should not be converted based on our regex
			expect(result.join("")).toBe("X^2 + 3^ should not work")
		})
	})
})

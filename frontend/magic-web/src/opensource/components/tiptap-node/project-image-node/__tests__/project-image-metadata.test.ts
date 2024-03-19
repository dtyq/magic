import { describe, expect, it } from "vitest"
import {
	buildProjectImageTitle,
	parseProjectImageTitle,
	toMarkdownImageSource,
	normalizeProjectImagePath,
} from "../project-image-metadata"

describe("project-image-metadata", () => {
	describe("buildProjectImageTitle", () => {
		it("should return empty string when width is not provided", () => {
			const result = buildProjectImageTitle({})
			expect(result).toBe("")
		})

		it("should return quoted format with width only", () => {
			const result = buildProjectImageTitle({ width: 300 })
			expect(result).toBe(' "=300x"')
		})

		it("should return quoted format with width and height", () => {
			const result = buildProjectImageTitle({ width: 300, height: 200 })
			expect(result).toBe(' "=300x200"')
		})

		it("should handle null height as omitted", () => {
			const result = buildProjectImageTitle({ width: 500, height: null })
			expect(result).toBe(' "=500x"')
		})
	})

	describe("parseProjectImageTitle", () => {
		it("should return null values when title is not provided", () => {
			const result = parseProjectImageTitle(null)
			expect(result).toEqual({ width: null, height: null })
		})

		it("should return null values when title is empty", () => {
			const result = parseProjectImageTitle("")
			expect(result).toEqual({ width: null, height: null })
		})

		it("should parse width only format", () => {
			const result = parseProjectImageTitle("=300x")
			expect(result).toEqual({ width: 300, height: null })
		})

		it("should parse width and height format", () => {
			const result = parseProjectImageTitle("=300x200")
			expect(result).toEqual({ width: 300, height: 200 })
		})

		it("should handle format without quotes (from markdown-it)", () => {
			// markdown-it will strip the quotes when passing to title attr
			const result = parseProjectImageTitle("=800x600")
			expect(result).toEqual({ width: 800, height: 600 })
		})

		it("should ignore invalid format", () => {
			const result = parseProjectImageTitle("invalid")
			expect(result).toEqual({ width: null, height: null })
		})
	})

	describe("normalizeProjectImagePath", () => {
		it("should return null for null input", () => {
			expect(normalizeProjectImagePath(null)).toBeNull()
		})

		it("should return null for undefined input", () => {
			expect(normalizeProjectImagePath(undefined)).toBeNull()
		})

		it("should remove leading ./ from path", () => {
			expect(normalizeProjectImagePath("./images/test.png")).toBe("images/test.png")
		})

		it("should remove leading / from path", () => {
			expect(normalizeProjectImagePath("/images/test.png")).toBe("images/test.png")
		})

		it("should remove multiple leading slashes", () => {
			expect(normalizeProjectImagePath(".///images/test.png")).toBe("images/test.png")
		})

		it("should keep path without leading slashes unchanged", () => {
			expect(normalizeProjectImagePath("images/test.png")).toBe("images/test.png")
		})
	})

	describe("toMarkdownImageSource", () => {
		it("should return empty string for null input", () => {
			expect(toMarkdownImageSource(null)).toBe("")
		})

		it("should return empty string for undefined input", () => {
			expect(toMarkdownImageSource(undefined)).toBe("")
		})

		it("should add ./ prefix to normalized path", () => {
			expect(toMarkdownImageSource("images/test.png")).toBe("./images/test.png")
		})

		it("should normalize and add ./ prefix to path with existing prefix", () => {
			expect(toMarkdownImageSource("./images/test.png")).toBe("./images/test.png")
		})

		it("should normalize path with leading / and add ./ prefix", () => {
			expect(toMarkdownImageSource("/images/test.png")).toBe("./images/test.png")
		})

		it("should preserve http:// URLs as is", () => {
			expect(toMarkdownImageSource("http://example.com/image.png")).toBe(
				"http://example.com/image.png",
			)
		})

		it("should preserve https:// URLs as is", () => {
			expect(toMarkdownImageSource("https://cdn.example.com/images/test.jpg")).toBe(
				"https://cdn.example.com/images/test.jpg",
			)
		})

		it("should preserve relative parent paths", () => {
			expect(toMarkdownImageSource("../images/test.png")).toBe("../images/test.png")
		})
	})

	describe("round-trip serialization", () => {
		it("should correctly round-trip with width and height", () => {
			// Simulate serialization
			const width = 800
			const height = 600
			const path = "images/photo.jpg"

			const titleStr = buildProjectImageTitle({ width, height })
			const srcStr = toMarkdownImageSource(path)

			// Result: ![alt](./images/photo.jpg "=800x600")
			expect(srcStr).toBe("./images/photo.jpg")
			expect(titleStr).toBe(' "=800x600"')

			// Simulate parsing (markdown-it strips quotes from title attribute)
			const parsedTitle = titleStr.trim().slice(1, -1) // Remove space and quotes
			const parsed = parseProjectImageTitle(parsedTitle)

			expect(parsed).toEqual({ width, height })
		})

		it("should correctly round-trip with width only", () => {
			const width = 500
			const path = "test.png"

			const titleStr = buildProjectImageTitle({ width })
			const srcStr = toMarkdownImageSource(path)

			expect(srcStr).toBe("./test.png")
			expect(titleStr).toBe(' "=500x"')

			const parsedTitle = titleStr.trim().slice(1, -1)
			const parsed = parseProjectImageTitle(parsedTitle)

			expect(parsed).toEqual({ width, height: null })
		})
	})

	describe("edge cases", () => {
		it("should handle title with spaces", () => {
			const result = parseProjectImageTitle(" =300x200 ")
			expect(result).toEqual({ width: 300, height: 200 })
		})

		it("should handle missing height in format =300x", () => {
			const result = parseProjectImageTitle("=300x")
			expect(result).toEqual({ width: 300, height: null })
		})

		it("should handle format from markdown-it (without quotes)", () => {
			// This is what markdown-it passes to title attribute
			const result = parseProjectImageTitle("=246x189")
			expect(result).toEqual({ width: 246, height: 189 })
		})

		it("should ignore other title formats", () => {
			const result = parseProjectImageTitle("Some other title")
			expect(result).toEqual({ width: null, height: null })
		})

		it("should handle zero dimensions", () => {
			const result = parseProjectImageTitle("=0x0")
			expect(result).toEqual({ width: 0, height: 0 })
		})

		it("should handle large numbers", () => {
			const result = parseProjectImageTitle("=9999x8888")
			expect(result).toEqual({ width: 9999, height: 8888 })
		})
	})

	describe("toMarkdownImageSource - special URLs", () => {
		it("should not add ./ prefix to base64 data URLs", () => {
			const dataUrl =
				"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
			expect(toMarkdownImageSource(dataUrl)).toBe(dataUrl)
		})

		it("should not add ./ prefix to HTTP URLs", () => {
			const httpUrl = "http://example.com/image.png"
			expect(toMarkdownImageSource(httpUrl)).toBe(httpUrl)
		})

		it("should not add ./ prefix to HTTPS URLs", () => {
			const httpsUrl = "https://example.com/image.png"
			expect(toMarkdownImageSource(httpsUrl)).toBe(httpsUrl)
		})

		it("should add ./ prefix to relative paths", () => {
			expect(toMarkdownImageSource("images/test.png")).toBe("./images/test.png")
		})

		it("should not modify paths that already have ./ prefix", () => {
			expect(toMarkdownImageSource("./images/test.png")).toBe("./images/test.png")
		})

		it("should not modify paths that already have ../ prefix", () => {
			expect(toMarkdownImageSource("../images/test.png")).toBe("../images/test.png")
		})
	})
})

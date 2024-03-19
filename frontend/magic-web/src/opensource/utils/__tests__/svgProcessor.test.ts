import { describe, it, expect } from "vitest"
import { processSvgContent, isSvgContent } from "../svgProcessor"

describe("svgProcessor", () => {
	describe("processSvgContent", () => {
		it("should process base64 encoded SVG data URL", () => {
			const svgString = "<svg><circle r='50' /></svg>"
			const base64Content = btoa(svgString)
			const dataUrl = `data:image/svg+xml;base64,${base64Content}`

			const result = processSvgContent(dataUrl)

			expect(result.isValid).toBe(true)
			expect(result.content).toBe(svgString)
		})

		it("should process URL-encoded SVG data URL", () => {
			const svgString = "<svg><circle r='50' /></svg>"
			const encodedContent = encodeURIComponent(svgString)
			const dataUrl = `data:image/svg+xml,${encodedContent}`

			const result = processSvgContent(dataUrl)

			expect(result.isValid).toBe(true)
			expect(result.content).toBe(svgString)
		})

		it("should handle raw SVG content", () => {
			const svgString = "<svg><rect width='100' height='100' /></svg>"

			const result = processSvgContent(svgString)

			expect(result.isValid).toBe(true)
			expect(result.content).toBe(svgString)
		})

		it("should handle SVG file URLs", () => {
			const svgUrl = "https://example.com/image.svg"

			const result = processSvgContent(svgUrl)

			expect(result.isValid).toBe(true)
			expect(result.content).toBe(svgUrl)
		})

		it("should handle invalid base64 content gracefully", () => {
			const invalidDataUrl = "data:image/svg+xml;base64,invalid_base64_content"

			const result = processSvgContent(invalidDataUrl)

			expect(result.isValid).toBe(false)
			expect(result.error).toContain("Failed to decode base64 content")
		})

		it("should handle invalid SVG format", () => {
			const invalidSvg = "<div>Not an SVG</div>"

			const result = processSvgContent(invalidSvg)

			expect(result.isValid).toBe(false)
			expect(result.error).toContain("Content is not recognized as SVG format")
		})

		it("should clean problematic URI characters in SVG", () => {
			const svgWithEncodedUrl = `<svg><use href="data:image%2Fsvg%2Bxml;base64,test"/></svg>`

			const result = processSvgContent(svgWithEncodedUrl)

			expect(result.isValid).toBe(true)
			// Should decode the URL in href attribute
			expect(result.content).toContain('href="data:image/svg+xml;base64,test"')
		})

		it("should handle SVG with xlink:href attributes", () => {
			const svgWithXlinkHref = `<svg><use xlink:href="data:image%2Fsvg%2Bxml;base64,test"/></svg>`

			const result = processSvgContent(svgWithXlinkHref)

			expect(result.isValid).toBe(true)
			expect(result.content).toContain('xlink:href="data:image/svg+xml;base64,test"')
		})

		it("should handle empty or malformed data URLs", () => {
			const emptyDataUrl = "data:image/svg+xml,"
			const result = processSvgContent(emptyDataUrl)

			expect(result.isValid).toBe(false)
			expect(result.error).toContain("Invalid data URL format")
		})

		it("should handle SVG with incomplete tags", () => {
			const incompleteSvg = "<svg><circle r='50'"
			const result = processSvgContent(incompleteSvg)

			expect(result.isValid).toBe(false)
			expect(result.error).toContain("missing closing </svg> tag")
		})
	})

	describe("isSvgContent", () => {
		it("should detect SVG by file extension", () => {
			expect(isSvgContent("any content", "svg")).toBe(true)
			expect(isSvgContent("any content", "svg+xml")).toBe(true)
			expect(isSvgContent("any content", "png")).toBe(false)
		})

		it("should detect SVG data URLs", () => {
			expect(isSvgContent("data:image/svg+xml;base64,test")).toBe(true)
			expect(isSvgContent("data:image/svg+xml,test")).toBe(true)
			expect(isSvgContent("data:image/png;base64,test")).toBe(false)
		})

		it("should detect SVG file URLs", () => {
			expect(isSvgContent("https://example.com/image.svg")).toBe(true)
			expect(isSvgContent("https://example.com/image.png")).toBe(false)
		})

		it("should detect raw SVG content", () => {
			expect(isSvgContent("<svg><circle r='50' /></svg>")).toBe(true)
			expect(isSvgContent("  <svg><rect /></svg>  ")).toBe(true)
			expect(isSvgContent("<div>Not SVG</div>")).toBe(false)
		})

		it("should prioritize file extension over content", () => {
			// Even if URL looks like SVG, file extension should take priority
			expect(isSvgContent("https://example.com/fake.svg", "png")).toBe(false)
			expect(isSvgContent("<div>Not SVG</div>", "svg")).toBe(true)
		})

		it("should handle edge cases", () => {
			expect(isSvgContent("")).toBe(false)
			expect(isSvgContent("svg")).toBe(false)
			expect(isSvgContent("image.svg.png")).toBe(false)
		})
	})
})

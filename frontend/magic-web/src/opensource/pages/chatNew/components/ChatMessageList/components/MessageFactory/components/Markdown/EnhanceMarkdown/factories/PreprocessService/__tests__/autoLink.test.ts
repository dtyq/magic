import { describe, it, expect } from "vitest"
import PreprocessService from "../index"

describe("PreprocessService - Auto Link", () => {
	it("should correctly parse auto links with https", () => {
		const markdown = "Check out this link: https://www.example.com for more info"
		const result = PreprocessService.preprocess(markdown, { enableLatex: false })
		const content = result.join(" ")

		// Should convert URL to clickable link
		expect(content).toContain(
			'<a href="https://www.example.com" target="_blank" rel="noopener noreferrer">https://www.example.com</a>',
		)
		expect(content).toContain("Check out this link:")
		expect(content).toContain("for more info")
	})

	it("should correctly parse auto links with http", () => {
		const markdown = "Visit http://example.com today"
		const result = PreprocessService.preprocess(markdown, { enableLatex: false })
		const content = result.join(" ")

		// Should convert URL to clickable link
		expect(content).toContain(
			'<a href="http://example.com" target="_blank" rel="noopener noreferrer">http://example.com</a>',
		)
	})

	it("should handle multiple auto links", () => {
		const markdown = `
Visit https://github.com and also check https://stackoverflow.com
You might also like http://example.com
		`.trim()

		const result = PreprocessService.preprocess(markdown, { enableLatex: false })
		const content = result.join(" ")

		// Should convert all URLs to clickable links
		expect(content).toContain(
			'<a href="https://github.com" target="_blank" rel="noopener noreferrer">https://github.com</a>',
		)
		expect(content).toContain(
			'<a href="https://stackoverflow.com" target="_blank" rel="noopener noreferrer">https://stackoverflow.com</a>',
		)
		expect(content).toContain(
			'<a href="http://example.com" target="_blank" rel="noopener noreferrer">http://example.com</a>',
		)
	})

	it("should handle URLs with paths and query parameters", () => {
		const markdown = "API docs: https://api.example.com/docs?version=v1&format=json"
		const result = PreprocessService.preprocess(markdown, { enableLatex: false })
		const content = result.join(" ")

		// Should convert complex URL to clickable link
		expect(content).toContain(
			'<a href="https://api.example.com/docs?version=v1&format=json" target="_blank" rel="noopener noreferrer">https://api.example.com/docs?version=v1&format=json</a>',
		)
	})

	it("should not interfere with existing markdown links", () => {
		const markdown = "Check out [Google](https://www.google.com) and also https://www.bing.com"
		const result = PreprocessService.preprocess(markdown, { enableLatex: false })
		const content = result.join(" ")

		// Should keep existing markdown link intact and convert bare URL
		expect(content).toContain("[Google](https://www.google.com)")
		expect(content).toContain(
			'<a href="https://www.bing.com" target="_blank" rel="noopener noreferrer">https://www.bing.com</a>',
		)
	})

	it("should not convert URLs that contain quotes", () => {
		const markdown =
			'This URL is quoted: "https://example.com" but this should be converted: https://test.com'
		const result = PreprocessService.preprocess(markdown, { enableLatex: false })
		const content = result.join(" ")

		// Should not convert URLs within quotes, but convert bare URLs
		expect(content).toContain('"https://example.com"')
		expect(content).toContain(
			'<a href="https://test.com" target="_blank" rel="noopener noreferrer">https://test.com</a>',
		)
	})

	it("should handle URLs at the beginning of text", () => {
		const markdown = "https://example.com is a great website"
		const result = PreprocessService.preprocess(markdown, { enableLatex: false })
		const content = result.join(" ")

		// Should convert URL at the beginning
		expect(content).toContain(
			'<a href="https://example.com" target="_blank" rel="noopener noreferrer">https://example.com</a>',
		)
	})
})

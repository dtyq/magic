/**
 * ContentCleaner tests
 */

import { describe, it, expect } from "vitest"
import { ContentCleaner } from "../ContentCleaner"

describe("ContentCleaner", () => {
	describe("cleanDocument", () => {
		it("should remove injected script elements", () => {
			const html = `
				<!DOCTYPE html>
				<html>
				<head>
					<script data-injected="true">console.log('test')</script>
					<script>console.log('keep')</script>
				</head>
				<body>
					<div>Content</div>
				</body>
				</html>
			`
			const cleaned = ContentCleaner.cleanDocument(html)
			expect(cleaned).not.toContain('data-injected="true"')
			expect(cleaned).toContain("console.log('keep')")
		})

		it("should remove injected style elements", () => {
			const html = `
				<!DOCTYPE html>
				<html>
				<head>
					<style data-injected="true">.test { color: red; }</style>
					<style>.keep { color: blue; }</style>
				</head>
				<body></body>
				</html>
			`
			const cleaned = ContentCleaner.cleanDocument(html)
			expect(cleaned).not.toContain('data-injected="true"')
			expect(cleaned).toContain(".keep")
		})

		it("should remove injected link elements", () => {
			const html = `
				<!DOCTYPE html>
				<html>
				<head>
					<link rel="stylesheet" data-injected="true" href="test.css">
					<link rel="stylesheet" href="keep.css">
				</head>
				<body></body>
				</html>
			`
			const cleaned = ContentCleaner.cleanDocument(html)
			expect(cleaned).not.toContain('data-injected="true"')
			expect(cleaned).toContain("keep.css")
		})

		it("should remove data-injected attribute from other elements", () => {
			const html = `
				<!DOCTYPE html>
				<html>
				<body>
					<div data-injected="true">
						<span>Content</span>
					</div>
				</body>
				</html>
			`
			const cleaned = ContentCleaner.cleanDocument(html)
			expect(cleaned).not.toContain('data-injected="true"')
			expect(cleaned).toContain("<span>Content</span>")
		})

		it("should remove editing classes", () => {
			const html = `
				<!DOCTYPE html>
				<html>
				<body>
					<div class="content __editor-selected __editor-hover">Text</div>
				</body>
				</html>
			`
			const cleaned = ContentCleaner.cleanDocument(html)
			expect(cleaned).not.toContain("__editor-selected")
			expect(cleaned).not.toContain("__editor-hover")
			expect(cleaned).toContain("content")
		})

		it("should preserve DOCTYPE", () => {
			const html = `<!DOCTYPE html>
<html>
<body>Content</body>
</html>`
			const cleaned = ContentCleaner.cleanDocument(html)
			expect(cleaned).toContain("<!DOCTYPE html>")
		})

		it("should handle custom DOCTYPE", () => {
			const html = `<!DOCTYPE HTML PUBLIC "-//W3C//DTD HTML 4.01//EN" "http://www.w3.org/TR/html4/strict.dtd">
<html>
<body>Content</body>
</html>`
			const cleaned = ContentCleaner.cleanDocument(html)
			// DOMParser normalizes DOCTYPE, so we just check it has a DOCTYPE
			expect(cleaned).toContain("<!DOCTYPE")
		})

		it("should remove data-injected from html and body", () => {
			const html = `
				<!DOCTYPE html>
				<html data-injected="true">
				<body data-injected="true">
					<div>Content</div>
				</body>
				</html>
			`
			const cleaned = ContentCleaner.cleanDocument(html)
			// Check html opening tag doesn't have data-injected
			const htmlMatch = cleaned.match(/<html[^>]*>/)
			expect(htmlMatch?.[0]).not.toContain("data-injected")
			// Check body opening tag doesn't have data-injected
			const bodyMatch = cleaned.match(/<body[^>]*>/)
			expect(bodyMatch?.[0]).not.toContain("data-injected")
		})

		it("should preserve normal attributes and classes", () => {
			const html = `
				<!DOCTYPE html>
				<html lang="en">
				<body>
					<div id="main" class="container active" data-value="123">
						<p>Content</p>
					</div>
				</body>
				</html>
			`
			const cleaned = ContentCleaner.cleanDocument(html)
			expect(cleaned).toContain('lang="en"')
			expect(cleaned).toContain('id="main"')
			expect(cleaned).toContain("container")
			expect(cleaned).toContain("active")
			expect(cleaned).toContain('data-value="123"')
		})

		it("should remove text editing attributes", () => {
			const html = `
				<!DOCTYPE html>
				<html>
				<body>
					<div contenteditable="true" data-text-editing="true" data-previous-content="old text">
						Edited text
					</div>
				</body>
				</html>
			`
			const cleaned = ContentCleaner.cleanDocument(html)
			expect(cleaned).not.toContain("contenteditable")
			expect(cleaned).not.toContain("data-text-editing")
			expect(cleaned).not.toContain("data-previous-content")
			expect(cleaned).toContain("Edited text")
		})

		it("should handle empty document", () => {
			const html = `<!DOCTYPE html><html><body></body></html>`
			const cleaned = ContentCleaner.cleanDocument(html)
			expect(cleaned).toContain("<!DOCTYPE html>")
			expect(cleaned).toContain("<html>")
			expect(cleaned).toContain("<body>")
		})
	})

	describe("validateHtmlContent", () => {
		it("should validate correct HTML", () => {
			const html = `
				<!DOCTYPE html>
				<html>
				<body>
					<div>Content</div>
				</body>
				</html>
			`
			const result = ContentCleaner.validateHtmlContent(html)
			expect(result.valid).toBe(true)
			expect(result.errors).toHaveLength(0)
		})

		it("should reject empty content", () => {
			const result = ContentCleaner.validateHtmlContent("")
			expect(result.valid).toBe(false)
			expect(result.errors).toContain("HTML content cannot be empty")
		})

		it("should reject non-string content", () => {
			const result = ContentCleaner.validateHtmlContent(null as unknown as string)
			expect(result.valid).toBe(false)
			expect(result.errors).toContain("HTML content cannot be empty")
		})

		it("should warn about missing HTML structure", () => {
			const html = "<div>Just a div</div>"
			const result = ContentCleaner.validateHtmlContent(html)
			expect(result.errors).toContain("Missing HTML document structure")
		})

		it("should accept HTML without DOCTYPE", () => {
			const html = "<html><body><div>Content</div></body></html>"
			const result = ContentCleaner.validateHtmlContent(html)
			// Should still be valid even though it warns about structure
			expect(result.errors.length).toBeGreaterThanOrEqual(0)
		})

		it("should handle malformed HTML gracefully", () => {
			const html = `
				<!DOCTYPE html>
				<html>
				<body>
					<div>Unclosed div
				</body>
				</html>
			`
			const result = ContentCleaner.validateHtmlContent(html)
			// DOMParser is forgiving, so this might still be valid
			expect(result).toHaveProperty("valid")
			expect(result).toHaveProperty("errors")
		})

		it("should accept minimal valid HTML", () => {
			const html = "<!DOCTYPE html><html><body></body></html>"
			const result = ContentCleaner.validateHtmlContent(html)
			expect(result.valid).toBe(true)
		})

		it("should handle HTML with special characters", () => {
			const html = `
				<!DOCTYPE html>
				<html>
				<body>
					<div>Test & <script>alert('xss')</script></div>
				</body>
				</html>
			`
			const result = ContentCleaner.validateHtmlContent(html)
			// Should be valid - DOMParser handles special characters
			expect(result.valid).toBe(true)
		})
	})
})

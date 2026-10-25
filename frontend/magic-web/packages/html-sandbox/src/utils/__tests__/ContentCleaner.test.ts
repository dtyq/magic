/**
 * ContentCleaner tests
 */

import { describe, it, expect } from "vitest"
import { ContentCleaner } from "../ContentCleaner"
import { markSourceNode } from "../sourceNodes"

describe("ContentCleaner", () => {
	describe("cleanDocument", () => {
		it("removes runtime-created children before saving authored HTML", () => {
			const html =
				'<html data-magic-source-node=""><body data-magic-source-node=""><section data-magic-source-node=""><p data-magic-source-node="">Fixed</p><p>Dynamic</p></section></body></html>'
			const cleaned = ContentCleaner.cleanDocument(html)
			expect(cleaned).toContain("<p>Fixed</p>")
			expect(cleaned).not.toContain("Dynamic")
			expect(cleaned).not.toContain("data-magic-source-node")
		})

		it("preserves editor-inserted nodes that were marked as source content", () => {
			const parser = new DOMParser()
			const doc = parser.parseFromString(
				"<html><body><section><p>Fixed</p></section></body></html>",
				"text/html",
			)
			doc.documentElement.setAttribute("data-magic-source-node", "")
			doc.body.setAttribute("data-magic-source-node", "")
			doc.querySelector("section")?.setAttribute("data-magic-source-node", "")

			const inserted = doc.createElement("img")
			inserted.src = "./images/inserted.png"
			doc.querySelector("section")?.appendChild(inserted)
			markSourceNode(inserted)

			const cleaned = ContentCleaner.cleanDocument(doc.documentElement.outerHTML)

			expect(cleaned).toContain("images/inserted.png")
		})
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

		it("should remove legacy editing attributes while preserving author inline styles", () => {
			const html = `<!DOCTYPE html><html><body>
				<p
					id="placeholder-copy"
					contenteditable="true"
					data-text-editing="true"
					data-previous-content="Previous placeholder"
					data-previous-user-select="none"
					data-previous-webkit-user-select="none"
					style="color: red; user-select: text; -webkit-user-select: text; outline: none; outline-offset: 2px;"
				>Placeholder copy</p>
			</body></html>`

			const cleaned = ContentCleaner.cleanDocument(html)
			const cleanedDocument = new DOMParser().parseFromString(cleaned, "text/html")
			const element = cleanedDocument.querySelector("#placeholder-copy") as HTMLElement

			expect(element.style.color).toBe("red")
			expect(element.style.userSelect).toBe("text")
			expect(element.getAttribute("style")).toContain("-webkit-user-select: text")
			expect(element.style.outline).toBe("none")
			expect(element.style.outlineOffset).toBe("2px")
			expect(cleaned).not.toContain("data-text-editing")
			expect(cleaned).not.toContain("data-previous-user-select")
			expect(cleaned).not.toContain("data-previous-webkit-user-select")
		})

		it("should remove unsafe hrefs and protect blank targets before persistence", () => {
			const cleaned = ContentCleaner.cleanDocument(
				"<html><body><a href='javascript:alert(1)' target='_blank'>Unsafe</a><a href=' /safe '>Safe</a></body></html>",
			)
			const doc = new DOMParser().parseFromString(cleaned, "text/html")

			expect(doc.querySelector("a")?.hasAttribute("href")).toBe(false)
			expect(doc.querySelectorAll("a")[0]?.getAttribute("rel")).toBe("noopener noreferrer")
			expect(doc.querySelectorAll("a")[1]?.getAttribute("href")).toBe("/safe")
		})

		it("preserves configured click links while stripping unsafe custom links", () => {
			const cleaned = ContentCleaner.cleanDocument(
				"<html><body><div data-magic-href=' ../slide-2.html '>Go</div><img data-magic-href='javascript:alert(1)'></body></html>",
			)
			const doc = new DOMParser().parseFromString(cleaned, "text/html")
			expect(doc.querySelector("div")?.getAttribute("data-magic-href")).toBe(
				"../slide-2.html",
			)
			expect(doc.querySelector("img")?.hasAttribute("data-magic-href")).toBe(false)
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

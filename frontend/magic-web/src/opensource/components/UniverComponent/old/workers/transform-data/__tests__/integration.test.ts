import { describe, it, expect, beforeAll } from "vitest"
import { getDOMParser } from "../../../utils/textUtils"

// Test helper to check if we're in a worker-like environment
function isWorkerEnvironment(): boolean {
	return typeof self !== "undefined" && typeof window === "undefined"
}

/**
 * Helper function for xmldom-compatible querySelector
 */
function querySelector(element: Element | Document, tagName: string): Element | null {
	const elements = element.getElementsByTagName(tagName)
	return elements.length > 0 ? elements[0] : null
}

describe("Transform Data Worker Integration", () => {
	beforeAll(() => {
		// Mock worker environment if needed
		if (typeof self === "undefined") {
			global.self = {} as any
		}
	})

	it("should use xmldom DOMParser in worker environment", () => {
		// Temporarily mock worker environment
		const originalWindow = global.window
		delete (global as any).window

		try {
			const parser = getDOMParser()
			expect(parser).toBeDefined()
			expect(typeof parser.parseFromString).toBe("function")
		} finally {
			// Restore original window
			if (originalWindow) {
				global.window = originalWindow
			}
		}
	})

	it("should parse XML correctly with xmldom", () => {
		const xmlString = "<root><item>test content</item></root>"

		// Test in mock worker environment
		const originalWindow = global.window
		delete (global as any).window

		try {
			const parser = getDOMParser()
			const doc = parser.parseFromString(xmlString, "text/xml")

			expect(doc).toBeDefined()
			const item = querySelector(doc, "item")
			expect(item).toBeDefined()
			expect(item?.textContent).toBe("test content")
		} finally {
			if (originalWindow) {
				global.window = originalWindow
			}
		}
	})

	it("should handle Excel rich text XML", () => {
		const richTextXml = `
			<r>
				<rPr>
					<b/>
					<sz val="12"/>
					<color rgb="FF000000"/>
					<rFont val="Arial"/>
				</rPr>
				<t>Bold Text</t>
			</r>
		`

		// Mock worker environment
		const originalWindow = global.window
		delete (global as any).window

		try {
			const parser = getDOMParser()
			const doc = parser.parseFromString(`<root>${richTextXml}</root>`, "text/xml")

			expect(doc).toBeDefined()
			const textElement = querySelector(doc, "t")
			expect(textElement?.textContent).toBe("Bold Text")

			const boldElement = querySelector(doc, "b")
			expect(boldElement).toBeDefined()

			const sizeElement = querySelector(doc, "sz")
			expect(sizeElement?.getAttribute("val")).toBe("12")
		} finally {
			if (originalWindow) {
				global.window = originalWindow
			}
		}
	})

	it("should handle HTML content", () => {
		const htmlContent = "<div><b>Bold</b> and <i>italic</i> text</div>"

		// Mock worker environment
		const originalWindow = global.window
		delete (global as any).window

		try {
			const parser = getDOMParser()
			const doc = parser.parseFromString(htmlContent, "text/xml")

			expect(doc).toBeDefined()
			const boldElement = querySelector(doc, "b")
			expect(boldElement?.textContent).toBe("Bold")

			const italicElement = querySelector(doc, "i")
			expect(italicElement?.textContent).toBe("italic")
		} finally {
			if (originalWindow) {
				global.window = originalWindow
			}
		}
	})
})

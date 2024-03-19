/**
 * Content Cleaner
 * Cleans injected editor elements from HTML
 */

export class ContentCleaner {
	/**
	 * Clean document HTML
	 */
	static cleanDocument(html: string): string {
		const parser = new DOMParser()
		const doc = parser.parseFromString(html, "text/html")

		// Remove injected elements
		this.removeInjectedElements(doc)

		// Clean editing attributes
		this.cleanEditingAttributes(doc)

		// Serialize document
		return this.serializeDocument(doc)
	}

	/**
	 * Remove injected elements
	 */
	private static removeInjectedElements(doc: Document): void {
		// Remove all elements with data-injected attribute
		const injected = doc.querySelectorAll("[data-injected]")
		injected.forEach((el) => {
			// Remove script/style/link/meta directly
			if (["SCRIPT", "STYLE", "LINK", "META"].includes(el.tagName)) {
				el.remove()
			} else {
				// Only remove attribute for other elements
				el.removeAttribute("data-injected")
			}
		})
	}

	/**
	 * Clean editing attributes
	 */
	private static cleanEditingAttributes(doc: Document): void {
		const editingClasses = ["__editor-selected", "__editor-hover"]
		const editingAttributes = ["contenteditable", "data-text-editing", "data-previous-content"]

		doc.querySelectorAll("*").forEach((el) => {
			// Remove editing classes
			editingClasses.forEach((cls) => el.classList.remove(cls))

			// Remove editing attributes
			editingAttributes.forEach((attr) => el.removeAttribute(attr))
		})

		// Clean html and body attributes
		doc.documentElement?.removeAttribute("data-injected")
		doc.body?.removeAttribute("data-injected")
	}

	/**
	 * Serialize document
	 */
	private static serializeDocument(doc: Document): string {
		const doctype = doc.doctype
		let doctypeStr = "<!DOCTYPE html>"

		if (doctype) {
			doctypeStr = `<!DOCTYPE ${doctype.name}`
			if (doctype.publicId) {
				doctypeStr += ` PUBLIC "${doctype.publicId}"`
			}
			if (doctype.systemId) {
				doctypeStr += ` "${doctype.systemId}"`
			}
			doctypeStr += ">\n"
		}

		return doctypeStr + doc.documentElement.outerHTML
	}

	/**
	 * Validate HTML content
	 */
	static validateHtmlContent(html: string): { valid: boolean; errors: string[] } {
		const errors: string[] = []

		// Basic validation
		if (!html || typeof html !== "string") {
			errors.push("HTML content cannot be empty")
			return { valid: false, errors }
		}

		// Check for basic HTML structure
		if (!html.includes("<html") && !html.includes("<!DOCTYPE")) {
			errors.push("Missing HTML document structure")
		}

		// Try parsing HTML
		try {
			const parser = new DOMParser()
			const doc = parser.parseFromString(html, "text/html")

			// Check for parse errors
			const parserError = doc.querySelector("parsererror")
			if (parserError) {
				errors.push("HTML parse error: " + parserError.textContent)
			}
		} catch (error) {
			errors.push(
				"HTML parse failed: " + (error instanceof Error ? error.message : String(error)),
			)
		}

		return {
			valid: errors.length === 0,
			errors,
		}
	}
}

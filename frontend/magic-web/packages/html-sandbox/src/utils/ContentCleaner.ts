/**
 * Content Cleaner
 * Cleans injected editor elements from HTML
 */

import { normalizeSafeHref } from "./safeUrl"
import { removeRuntimeNodes, SOURCE_NODE_ATTRIBUTE } from "./sourceNodes"
import { PPT_BUILD_MARKERS_ATTRIBUTE } from "../features/PPTBuildMarkers"

export class ContentCleaner {
	/**
	 * Clean serialized document HTML without modifying author-owned inline styles.
	 */
	static cleanDocument(html: string): string {
		const parser = new DOMParser()
		const doc = parser.parseFromString(html, "text/html")
		removeRuntimeNodes(doc)

		// Remove injected elements
		this.removeInjectedElements(doc)

		// Clean editing attributes
		this.cleanEditingAttributes(doc)

		// Apply the same href policy used by editor commands before persisting HTML.
		this.cleanUnsafeHrefAttributes(doc)

		// Serialize document
		return this.serializeDocument(doc)
	}

	/**
	 * Remove injected elements
	 */
	private static removeInjectedElements(doc: Document): void {
		doc.querySelectorAll(`[${PPT_BUILD_MARKERS_ATTRIBUTE}]`).forEach((element) =>
			element.remove(),
		)
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
		const editingAttributes = [
			"data-magic-editor-node-id",
			"data-magic-ppt-build-hidden",
			SOURCE_NODE_ATTRIBUTE,
			"contenteditable",
			"data-text-editing",
			"data-previous-content",
			"data-previous-user-select",
			"data-previous-webkit-user-select",
		]

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

	private static cleanUnsafeHrefAttributes(doc: Document): void {
		doc.querySelectorAll<HTMLElement>("a[href], area[href], [data-magic-href]").forEach(
			(element) => {
				for (const attribute of ["href", "data-magic-href"]) {
					const href = element.getAttribute(attribute)
					if (href === null) continue
					try {
						const normalizedHref = normalizeSafeHref(href)
						if (normalizedHref === null) element.removeAttribute(attribute)
						else element.setAttribute(attribute, normalizedHref)
					} catch {
						element.removeAttribute(attribute)
					}
				}

				if (element.getAttribute("target") !== "_blank") return
				const relTokens = new Set(
					(element.getAttribute("rel") ?? "").split(/\s+/).filter(Boolean),
				)
				relTokens.add("noopener")
				relTokens.add("noreferrer")
				element.setAttribute("rel", Array.from(relTokens).join(" "))
			},
		)
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

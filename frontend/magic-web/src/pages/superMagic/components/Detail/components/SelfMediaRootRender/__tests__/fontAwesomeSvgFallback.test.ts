import { describe, expect, it } from "vitest"
import { replaceFontAwesomeIconsWithSvg } from "../utils/fontAwesomeSvgFallback"

describe("replaceFontAwesomeIconsWithSvg", () => {
	it("replaces the fa-magic alias with inline svg and restores it", () => {
		document.head.innerHTML = ""
		document.body.innerHTML =
			'<div><i class="fas fa-magic text-4xl" style="color: rgb(255, 229, 102);"></i></div>'

		const result = replaceFontAwesomeIconsWithSvg(document)
		const iconElement = document.querySelector("i.fas.fa-magic") as HTMLElement | null
		const svgElement = iconElement?.querySelector("svg")

		expect(result.replacedIconCount).toBe(1)
		expect(iconElement?.getAttribute("data-magic-export-fa-svg")).toBe("true")
		expect(svgElement).not.toBeNull()
		expect(svgElement?.getAttribute("viewBox")).toBe("0 0 576 512")

		result.restore()

		expect(iconElement?.getAttribute("data-magic-export-fa-svg")).toBeNull()
		expect(iconElement?.querySelector("svg")).toBeNull()
		expect(document.head.querySelector("[data-magic-export-fa-svg-style]")).toBeNull()
	})

	it("leaves unknown font awesome icons untouched", () => {
		document.head.innerHTML = ""
		document.body.innerHTML = '<div><i class="fas fa-not-supported"></i></div>'

		const result = replaceFontAwesomeIconsWithSvg(document)

		expect(result.replacedIconCount).toBe(0)
		expect(document.querySelector("svg")).toBeNull()
		expect(document.head.querySelector("[data-magic-export-fa-svg-style]")).toBeNull()
	})

	it("replaces icons for cross-realm document-like targets", () => {
		document.head.innerHTML = ""
		document.body.innerHTML = '<div><i class="fas fa-magic"></i></div>'

		const foreignDocumentLike = {
			nodeType: Node.DOCUMENT_NODE,
			head: document.head,
			body: document.body,
			querySelectorAll: document.querySelectorAll.bind(document),
			querySelector: document.querySelector.bind(document),
			createElement: document.createElement.bind(document),
			ownerDocument: null,
		} as unknown as Document

		const result = replaceFontAwesomeIconsWithSvg(foreignDocumentLike)

		expect(result.replacedIconCount).toBe(1)
		expect(document.querySelector("i.fas.fa-magic svg")).not.toBeNull()
	})
})

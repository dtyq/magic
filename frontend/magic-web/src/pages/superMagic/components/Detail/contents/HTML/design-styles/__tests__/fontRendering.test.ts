import { describe, expect, it } from "vitest"
import { getPrimaryFontFamily, parseFontFamilyStack } from "../fontRendering"
import { buildGoogleFontsCssUrl, getGoogleFontFamilies, loadGoogleFonts } from "../googleFontLoader"

describe("font rendering helpers", () => {
	it("parses quoted font stacks and ignores generic families", () => {
		expect(parseFontFamilyStack(`"Plus Jakarta Sans", system-ui, sans-serif`)).toEqual([
			"Plus Jakarta Sans",
			"system-ui",
			"sans-serif",
		])
		expect(getPrimaryFontFamily(`"Plus Jakarta Sans", system-ui, sans-serif`)).toBe(
			"Plus Jakarta Sans",
		)
	})
})

describe("Google font preview loader", () => {
	it("only allows known Google font families", () => {
		expect(getGoogleFontFamilies("Plus Jakarta Sans, system-ui, sans-serif")).toEqual([
			"Plus Jakarta Sans",
		])
		expect(getGoogleFontFamilies("Airbnb Cereal VF, sans-serif")).toEqual([])
	})

	it("builds a CSS2 URL for the preview weights", () => {
		expect(buildGoogleFontsCssUrl(["Plus Jakarta Sans"])).toContain(
			"family=Plus+Jakarta+Sans:wght@300;400;500;600;700",
		)
	})

	it("adds one stylesheet link per primary font", async () => {
		const documentLike = document.implementation.createHTMLDocument("font-loader")
		const appendChild = documentLike.head.appendChild.bind(documentLike.head)
		documentLike.head.appendChild = ((node: Node) => {
			const result = appendChild(node)
			queueMicrotask(() => (node as HTMLLinkElement).onload?.(new Event("load")))
			return result
		}) as typeof documentLike.head.appendChild
		const [first, second] = await Promise.all([
			loadGoogleFonts("Inter, sans-serif", documentLike),
			loadGoogleFonts("Inter, sans-serif", documentLike),
		])
		expect(first).toBe("loaded")
		expect(second).toBe("loaded")
		expect(
			documentLike.head.querySelectorAll("link[data-design-style-google-fonts]"),
		).toHaveLength(1)
	})
})

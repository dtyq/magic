import { describe, expect, it } from "vitest"
import { findPPTSlideIndex, getPPTSlideHref } from "../slideNavigation"

const slides = [
	{ path: "slides/slide-1.html" },
	{ path: "slides/slide-2.html" },
	{ path: "slides/section/slide-3.html" },
	{ path: "slides/section/slide-2.html" },
	{ path: "slide-2.html" },
]

describe("findPPTSlideIndex", () => {
	it("matches project-root relative paths", () => {
		expect(findPPTSlideIndex(slides, "slides/slide-1.html", "slides/slide-2.html")).toBe(1)
	})

	it("matches paths relative to the current slide folder", () => {
		expect(findPPTSlideIndex(slides, "slides/section/slide-3.html", "../slide-2.html")).toBe(1)
	})

	it("prefers the current folder over a project-root duplicate", () => {
		expect(findPPTSlideIndex(slides, "slides/section/slide-3.html", "slide-2.html")).toBe(3)
	})

	it("ignores query strings and hashes", () => {
		expect(
			findPPTSlideIndex(slides, "slides/slide-1.html", "slide-2.html?mode=preview#top"),
		).toBe(1)
	})

	it("returns -1 for empty or unknown paths", () => {
		expect(findPPTSlideIndex(slides, "slides/slide-1.html", "")).toBe(-1)
		expect(findPPTSlideIndex(slides, "slides/slide-1.html", "other.html")).toBe(-1)
	})

	it("matches normalized paths sent by the HTML navigation runtime", () => {
		expect(findPPTSlideIndex(slides, "slides/slide-1.html", "/slides/slide-2.html")).toBe(1)
	})

	it.each([
		"https://example.com/slides/slide-2.html",
		"//example.com/slides/slide-2.html",
		"javascript:alert(1)",
		"file:///slides/slide-2.html",
		"%bad.html",
	])("ignores non-project or malformed href %s", (href) => {
		expect(findPPTSlideIndex(slides, slides[0].path, href)).toBe(-1)
	})

	it("round trips encoded names and nested folders using stable paths after reorder", () => {
		const target = { path: "slides/章节/第 2 页 #.html" }
		const href = getPPTSlideHref("slides/section/slide-3.html", target.path)
		expect(href).toBe("../%E7%AB%A0%E8%8A%82/%E7%AC%AC%202%20%E9%A1%B5%20%23.html")
		expect(findPPTSlideIndex([target, ...slides], "slides/section/slide-3.html", href)).toBe(0)
		expect(findPPTSlideIndex([...slides, target], "slides/section/slide-3.html", href)).toBe(5)
	})

	it("creates a working link to the current slide", () => {
		const href = getPPTSlideHref(slides[0].path, slides[0].path)
		expect(findPPTSlideIndex(slides, slides[0].path, href)).toBe(0)
	})
})

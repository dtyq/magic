import { describe, expect, it } from "vitest"
import { filterPptSlidePaths, normalizeHiddenSlides } from "../pptHiddenSlides"

describe("PPT hidden slide selection", () => {
	const slides = ["./slides/03.html", "slides/01.html", "./slides/02.html"]

	it("keeps the deck's order and original path spelling", () => {
		expect(
			normalizeHiddenSlides(slides, ["slides/02.html", "./slides/03.html", "gone.html"]),
		).toEqual(["./slides/03.html", "./slides/02.html"])
		expect(filterPptSlidePaths(slides, ["slides/02.html"])).toEqual(slides.slice(0, 2))
	})

	it("defaults legacy decks to visible and permits explicit inclusion", () => {
		expect(filterPptSlidePaths(slides, undefined)).toEqual(slides)
		expect(filterPptSlidePaths(slides, slides)).toEqual([])
		expect(filterPptSlidePaths(slides, slides, true)).toEqual(slides)
	})

	it.each([null, "01.html", [3], [""]])("rejects malformed configuration: %j", (hidden) => {
		expect(() => filterPptSlidePaths(slides, hidden)).toThrow("Invalid hidden_slides")
	})
})

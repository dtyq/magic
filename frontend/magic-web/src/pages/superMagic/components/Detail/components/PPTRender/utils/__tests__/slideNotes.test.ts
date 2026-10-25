import { describe, expect, it } from "vitest"
import {
	extractSlideNotes,
	preserveSlideNotesFromSource,
	stripSlideNotes,
	upsertSlideNotes,
} from "../slideNotes"

describe("slide notes html contract", () => {
	it("reads escaped plain text from the inert template", () => {
		const html =
			"<main>Slide</main><template data-magic-slide-notes>Line 1 &amp; &lt;Line 2&gt;</template>"

		expect(extractSlideNotes(html)).toBe("Line 1 & <Line 2>")
	})

	it("inserts notes before the body closing tag without changing slide markup", () => {
		const html = "<html><body><main>Slide</main></body></html>"
		const result = upsertSlideNotes(html, "Talk about <this> & that")

		expect(result).toContain("<main>Slide</main>")
		expect(result).toContain("Talk about &lt;this&gt; &amp; that")
		expect(extractSlideNotes(result)).toBe("Talk about <this> & that")
	})

	it("updates only the canonical notes block", () => {
		const html =
			'<main data-value="keep">Slide</main><template data-magic-slide-notes>Old</template>'

		expect(upsertSlideNotes(html, "New")).toBe(
			'<main data-value="keep">Slide</main><template data-magic-slide-notes data-format="plain-text" data-version="1">\nNew\n</template>',
		)
	})

	it("returns an empty string when a page has no notes", () => {
		expect(extractSlideNotes("<main>Slide</main>")).toBe("")
	})

	it("removes only the inert notes block when comparing visual HTML", () => {
		const visualHtml = '<main data-value="keep">Slide</main>'
		const withNotes = `${visualHtml}<template data-magic-slide-notes>Talk track</template>`

		expect(stripSlideNotes(withNotes)).toBe(visualHtml)
	})

	it("normalizes duplicate notes blocks to one canonical block", () => {
		const html =
			"<main>Slide</main><template data-magic-slide-notes>Old 1</template><template data-magic-slide-notes>Old 2</template>"

		expect(upsertSlideNotes(html, "New")).toBe(
			'<main>Slide</main><template data-magic-slide-notes data-format="plain-text" data-version="1">\nNew\n</template>',
		)
	})

	it("preserves the exact saved notes block while keeping visual edits", () => {
		const savedBlock =
			'<template data-version="2" data-magic-slide-notes data-format="plain-text">\n中文 &amp; &#60;talk&#62;\n</template>'
		const edited =
			"<main>Edited body</main><template data-magic-slide-notes>Old</template><template data-magic-slide-notes>Duplicate</template>"
		expect(preserveSlideNotesFromSource(edited, `<main>Original</main>${savedBlock}`)).toBe(
			`<main>Edited body</main>${savedBlock}`,
		)
	})

	it("does not restore old notes when the source has removed the block", () => {
		expect(
			preserveSlideNotesFromSource(
				"<main>Edited body</main><template data-magic-slide-notes>Old</template>",
				"<main>Original</main>",
			),
		).toBe("<main>Edited body</main>")
	})

	it("inserts separately saved notes when the iframe never had a notes block", () => {
		const edited = "<html><body><main>Edited body</main></body></html>"
		const source = upsertSlideNotes(
			"<html><body><main>Original</main></body></html>",
			"New notes",
		)
		const saved = preserveSlideNotesFromSource(edited, source)
		expect(extractSlideNotes(saved)).toBe("New notes")
		expect(saved).toContain("<main>Edited body</main>")
		expect(stripSlideNotes(saved)).toBe(edited.replace("</body>", "\n</body>"))
	})
})

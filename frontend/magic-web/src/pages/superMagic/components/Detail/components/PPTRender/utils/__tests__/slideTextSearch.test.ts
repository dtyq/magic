import { describe, expect, it } from "vitest"
import { applySlideTextReplacements, createSlideTextSearchSnapshot } from "../slideTextSearch"

function replace(source: string, query: string, replacement: string) {
	return applySlideTextReplacements(
		createSlideTextSearchSnapshot(source, query),
		source,
		replacement,
	)
}

describe("slide text source search", () => {
	it("finds literal text with configurable case sensitivity and stable match IDs", () => {
		const source = '<p title="A+B">A+B a+b AAB</p>'
		expect(
			createSlideTextSearchSnapshot(source, "a+b").matches.map((match) => match.text),
		).toEqual(["A+B", "a+b"])
		expect(
			createSlideTextSearchSnapshot(source, "a+b", { caseSensitive: true }).matches,
		).toHaveLength(1)
		expect(replace(source, "a+b", "$&")).toBe('<p title="A+B">$&amp; $&amp; AAB</p>')
	})

	it("patches across inline tags without changing markup, comments or unrelated source bytes", () => {
		const source =
			"<!doctype html>\r\n<html><head><title>Hello world</title></head><body><p class = 'x'>Hello <b data-v=\"world\">wor<!-- keep -->ld</b>!</p></body></html>"
		const snapshot = createSlideTextSearchSnapshot(source, "Hello world")
		expect(snapshot.matches).toHaveLength(1)
		expect(
			snapshot.matches[0].ranges.map(({ start, end }) => source.slice(start, end)),
		).toEqual(["Hello ", "wor", "ld"])
		expect(applySlideTextReplacements(snapshot, source, '<safe & "quoted">')).toBe(
			'<!doctype html>\r\n<html><head><title>Hello world</title></head><body><p class = \'x\'>&lt;safe &amp; "quoted"&gt;<b data-v="world"><!-- keep --></b>!</p></body></html>',
		)
	})

	it("decodes numeric, named, legacy and astral entities with their exact source ranges", () => {
		const source = "<p>&amp; &#x4E2D;&#25991; &#x1f680; &copy next &NotEqualTilde;</p>"
		expect(replace(source, "& 中文 🚀 © next ≂̸", "完成")).toBe("<p>完成</p>")
		expect(replace("<p>a&copy</p>", "©", "b")).toBe("<p>ab</p>")
		expect(replace("<p>&unknown; &amp;amp;</p>", "&amp;", "safe")).toBe("<p>&unknown; safe</p>")
	})

	it("does not replace only part of a multi-codepoint entity", () => {
		const source = "<p>&NotEqualTilde;</p>"
		const snapshot = createSlideTextSearchSnapshot(source, "≂")
		expect(snapshot.matches).toHaveLength(1)
		expect(snapshot.matches[0].replaceable).toBe(false)
		expect(() => applySlideTextReplacements(snapshot, source, "x")).toThrow("safely")
	})

	it("ignores head, scripts, styles, attributes, templates, canvas, controls and hidden subtrees", () => {
		const source = `<!doctype html><html><head><title>needle</title><style>.needle{color:red}</style></head><body>
<p title="needle" onclick="needle()">needle</p><!-- needle -->
<script>throw new Error('needle')</script><style>.needle{display:none}</style>
<template data-magic-slide-notes>needle<template>needle</template></template>
<noscript>needle</noscript><canvas>needle</canvas><iframe>needle</iframe>
<textarea>needle</textarea><select><option>needle</option></select>
<div hidden="false"><b>needle</b></div><p aria-hidden="TRUE">needle</p>
<p style="color:red; display: none !important">needle</p><p style="visibility: hidden">needle</p>
<p style="DISPLAY:/*reason*/none">needle</p><div style="content-visibility: hidden">needle</div>
</body></html>`
		const snapshot = createSlideTextSearchSnapshot(source, "needle")
		expect(snapshot.matches).toHaveLength(1)
		expect(replace(source, "needle", "found")).toBe(
			source.replace('onclick="needle()">needle', 'onclick="needle()">found'),
		)
	})

	it("does not join separate blocks, line breaks, or excluded subtrees", () => {
		for (const source of [
			"<p>one</p><p>two</p>",
			"<p>one<br>two</p>",
			"<p>one<span hidden>x</span>two</p>",
			"<p>one<script>x</script>two</p>",
		]) {
			expect(createSlideTextSearchSnapshot(source, "onetwo").matches).toHaveLength(0)
		}
		expect(replace("<p>one<span>two</span><b>three</b></p>", "onetwothree", "all")).toBe(
			"<p>all<span></span><b></b></p>",
		)
	})

	it("searches visible SVG static text but excludes definitions and metadata", () => {
		const source =
			"<svg><title>needle</title><desc>needle</desc><defs><text>needle</text></defs><text>nee<tspan>dle</tspan></text></svg>"
		expect(createSlideTextSearchSnapshot(source, "needle").matches).toHaveLength(1)
		expect(replace(source, "needle", "safe")).toBe(
			"<svg><title>needle</title><desc>needle</desc><defs><text>needle</text></defs><text>safe<tspan></tspan></text></svg>",
		)
	})

	it("excludes non-rendering SVG character data and closed dialogs", () => {
		const source =
			"<svg><g>needle</g><text><tspan>needle</tspan></text></svg><dialog>needle</dialog><dialog open>needle</dialog>"
		expect(createSlideTextSearchSnapshot(source, "needle").matches).toHaveLength(2)
		expect(
			createSlideTextSearchSnapshot(
				'<svg><text visibility="hidden">needle</text><g display="none"><text>needle</text></g></svg>',
				"needle",
			).matches,
		).toHaveLength(0)
	})

	it("includes only summary text from closed details", () => {
		const source =
			"<details><summary>needle</summary><p>needle</p></details><details open><summary>needle</summary><p>needle</p></details>"
		expect(createSlideTextSearchSnapshot(source, "needle").matches).toHaveLength(3)
	})

	it("maps CRLF text without rewriting unrelated newlines", () => {
		const source = "<pre>left\r\nright\r\nkeep</pre>\r\n"
		expect(replace(source, "left\nright", "joined")).toBe("<pre>joined\r\nkeep</pre>\r\n")
	})

	it("keeps Unicode case folding from shifting subsequent source offsets", () => {
		const source = "<p>İ ABC 中文 🚀 ABC</p>"
		expect(replace(source, "abc", "ok")).toBe("<p>İ ok 中文 🚀 ok</p>")
		expect(replace(source, "中文 🚀", "完成")).toBe("<p>İ ABC 完成 ABC</p>")
	})

	it("supports selected occurrences, deletion, deduplicated IDs and empty queries", () => {
		const source = "<p>cat cat cat</p>"
		const snapshot = createSlideTextSearchSnapshot(source, "cat")
		expect(applySlideTextReplacements(snapshot, source, "dog", [1, 1])).toBe(
			"<p>cat dog cat</p>",
		)
		expect(applySlideTextReplacements(snapshot, source, "", [0, 2])).toBe("<p> cat </p>")
		expect(applySlideTextReplacements(snapshot, source, "dog", [])).toBe(source)
		expect(replace(source, "", "dog")).toBe(source)
		expect(replace("<p>aaaaa</p>", "aa", "x")).toBe("<p>xxa</p>")
	})

	it("freezes the source snapshot and rejects stale source or unknown matches", () => {
		const source = "<p>needle</p>"
		const snapshot = createSlideTextSearchSnapshot(source, "needle")
		expect(Object.isFrozen(snapshot)).toBe(true)
		expect(Object.isFrozen(snapshot.matches)).toBe(true)
		expect(Object.isFrozen(snapshot.matches[0])).toBe(true)
		expect(Object.isFrozen(snapshot.matches[0].ranges)).toBe(true)
		expect(Object.isFrozen(snapshot.matches[0].ranges[0])).toBe(true)
		expect(() => applySlideTextReplacements(snapshot, source + " ", "x")).toThrow("Stale")
		expect(() => applySlideTextReplacements(snapshot, source, "x", [3])).toThrow("Unknown")
	})

	it("marks parser-recovered text as unreplaceable when its source cannot be proven", () => {
		const source = "<p>ab\0cd</p>"
		const snapshot = createSlideTextSearchSnapshot(source, "abcd")
		expect(snapshot.matches).toHaveLength(1)
		expect(snapshot.matches[0].replaceable).toBe(false)
		expect(() => applySlideTextReplacements(snapshot, source, "x")).toThrow("safely")
	})

	it("refuses ordinary escaped patches inside obsolete raw-text elements", () => {
		for (const source of ["<xmp>needle</xmp>", "<plaintext>needle"]) {
			const snapshot = createSlideTextSearchSnapshot(source, "needle")
			expect(snapshot.matches[0].replaceable).toBe(false)
			expect(() => applySlideTextReplacements(snapshot, source, "<new>")).toThrow("safely")
		}
	})
})

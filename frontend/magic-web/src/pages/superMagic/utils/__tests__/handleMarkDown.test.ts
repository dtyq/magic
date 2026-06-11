import { describe, expect, it } from "vitest"
import { preprocessMarkdown } from "../handleMarkDown"

describe("preprocessMarkdown", () => {
	it("converts file path placeholders into file-path tags", () => {
		expect(preprocessMarkdown("[@file_path:foo\"bar&baz'qux]")).toBe(
			'<file-path path="foo&quot;bar&amp;baz&#39;qux"></file-path>',
		)
	})

	it("escapes custom html tags but keeps standard html tags", () => {
		expect(preprocessMarkdown("<custom_panel>Hello</custom_panel><div>world</div>")).toBe(
			"`<custom_panel>`Hello`</custom_panel>`<div>world</div>",
		)
	})

	it("keeps citation references tags for markdown custom renderers", () => {
		const content =
			'<references><ref index="1" title="Doc" url="https://example.com" /></references>'

		expect(preprocessMarkdown(content)).toBe(content)
	})

	it("escapes underscore emphasis but keeps code spans intact", () => {
		expect(preprocessMarkdown("_demo_ `inline_code` _text_")).toBe(
			"\\_demo\\_ `inline_code` \\_text\\_",
		)
	})

	it("returns the original string when there is nothing to preprocess", () => {
		expect(preprocessMarkdown("plain markdown text")).toBe("plain markdown text")
	})
})

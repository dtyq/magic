import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { tokenizer } from "acorn"
import { describe, expect, it } from "vitest"
import { prepareNoSendMarkdown } from "../noSend"

describe("prepareNoSendMarkdown", () => {
	it("loads with regex syntax supported before Safari 16.4", () => {
		// Tokenize the real module so unsupported regex literals fail even on modern Node.
		// ES2017 excludes lookbehind; tokenization also accepts TypeScript type tokens.
		const source = readFileSync(resolve(__dirname, "../noSend.ts"), "utf8")
		expect(() => Array.from(tokenizer(source, { ecmaVersion: 2017 }))).not.toThrow()
	})

	it.each([
		"`<no_send>example</no_send>`",
		"``<no_send>example</no_send>``",
		"``before ` <no_send>example</no_send> after``",
		"```before `` <no_send>example</no_send> after```",
		"`before\n<no_send>example</no_send>\nafter`",
		"`<no_send>first</no_send>` and ``<no_send>second</no_send>``",
		"```\n<no_send>example</no_send>\n```",
	])("preserves control tags inside code: %s", (text) => {
		expect(prepareNoSendMarkdown(text, false)).toEqual({
			content: text,
			hasControls: false,
			hasBlock: false,
		})
	})

	it("still processes controls outside an inline code span", () => {
		expect(
			prepareNoSendMarkdown("`<no_send>example</no_send>` <no_send>body</no_send>", false),
		).toEqual({
			content:
				'`<no_send>example</no_send>` <no-send data-layout="inline" data-unclosed="false">body</no-send>',
			hasControls: true,
			hasBlock: false,
		})
	})

	it("does not protect controls after an unmatched opening backtick", () => {
		expect(prepareNoSendMarkdown("`<no_send>body</no_send>", false)).toEqual({
			content: '`<no-send data-layout="inline" data-unclosed="false">body</no-send>',
			hasControls: true,
			hasBlock: false,
		})
	})

	it("keeps an incomplete streaming tag inside inline code", () => {
		expect(prepareNoSendMarkdown("`<no_send>example</no_send> <no_s`", true)).toEqual({
			content: "`<no_send>example</no_send> <no_s`",
			hasControls: false,
			hasBlock: false,
		})
	})
})

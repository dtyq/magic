import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { tokenizer } from "acorn"
import { describe, expect, it } from "vitest"
import { injectMarkdownTimeLinks } from "../markdownTimeLinks"

describe("recording markdown time link compatibility", () => {
	it("loads without regex syntax unavailable in older WebKit", () => {
		// Check the actual module: modern Node would otherwise accept lookbehind.
		const source = readFileSync(resolve(__dirname, "../markdownTimeLinks.ts"), "utf8")
		expect(() => Array.from(tokenizer(source, { ecmaVersion: 2017 }))).not.toThrow()
	})

	it.each([
		["00:05", "[00:05](magic-time://5)"],
		["Intro 1:02:03", "Intro [1:02:03](magic-time://3723)"],
		["00:05 00:10", "[00:05](magic-time://5) [00:10](magic-time://10)"],
		["00:0500:10", "[00:05](magic-time://5)[00:10](magic-time://10)"],
		["(00:05)", "([00:05](magic-time://5))"],
		["[jump](0:05)", "[jump](0:05)"],
		["[jump](00:05)", "[jump](00:05)"],
		["[00:05](magic-time://5) 00:10", "[00:05](magic-time://5) [00:10](magic-time://10)"],
	])("converts %s without changing link targets", (input, expected) => {
		expect(injectMarkdownTimeLinks(input)).toBe(expected)
	})
})

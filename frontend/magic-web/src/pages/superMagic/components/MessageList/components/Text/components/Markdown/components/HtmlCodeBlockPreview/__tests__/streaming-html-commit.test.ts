import { describe, expect, it } from "vitest"
import {
	findIncompleteStreamingScriptStart,
	resolveStreamingHtmlCommitContent,
	resolveStreamingHtmlCommitContentIncrementally,
} from "../streaming-html-commit"

describe("streaming html commit", () => {
	it("keeps static html streaming without deferral", () => {
		const content = "<!DOCTYPE html><html><body><main>Report</main></body></html>"

		expect(findIncompleteStreamingScriptStart(content)).toBeNull()
		expect(resolveStreamingHtmlCommitContent(content)).toBe(content)
	})

	it("defers an incomplete script opening tag", () => {
		const prefix = "<!DOCTYPE html><html><head>"
		const content = `${prefix}<script src="https://cdn.example.com/chart.js"`

		expect(findIncompleteStreamingScriptStart(content)).toBe(prefix.length)
		expect(resolveStreamingHtmlCommitContent(content)).toBe(prefix)
	})

	it("defers a partially received script tag", () => {
		const prefix = "<html><body><main>Report</main>"
		const content = `${prefix}<scr`

		expect(findIncompleteStreamingScriptStart(content)).toBe(prefix.length)
		expect(resolveStreamingHtmlCommitContent(content)).toBe(prefix)
	})

	it("keeps the last static frame while an inline script is streaming", () => {
		const prefix = "<html><body><main>Report</main>"
		const content = `${prefix}<script>const chart = createChart({ title: "East India`

		expect(resolveStreamingHtmlCommitContent(content)).toBe(prefix)
	})

	it("commits the complete script once its closing tag arrives", () => {
		const content =
			"<html><body><main>Report</main><script>window.ready = true</script></body></html>"

		expect(resolveStreamingHtmlCommitContent(content)).toBe(content)
	})

	it("recognizes a closing script tag after a legacy html comment in script text", () => {
		const content =
			"<html><body><script><!-- legacy comment\nwindow.ready = true</script></body></html>"

		expect(findIncompleteStreamingScriptStart(content)).toBeNull()
		expect(resolveStreamingHtmlCommitContent(content)).toBe(content)
	})

	it("preserves complete scripts before a later incomplete script", () => {
		const safePrefix =
			'<html><head><script src="https://cdn.example.com/chart.js"></script></head><body><main>Report</main>'
		const content = `${safePrefix}<SCRIPT>renderChart(`

		expect(resolveStreamingHtmlCommitContent(content)).toBe(safePrefix)
	})

	it("ignores script-like text inside html comments and tag names", () => {
		const content =
			"<!-- <script>disabled example --><script-template>Example</script-template>"

		expect(findIncompleteStreamingScriptStart(content)).toBeNull()
		expect(resolveStreamingHtmlCommitContent(content)).toBe(content)
	})
})

describe("streaming html incremental scanner", () => {
	it("keeps partial script opening tags out of the committed prefix", () => {
		const partialOpening = resolveStreamingHtmlCommitContentIncrementally(
			undefined,
			"<main>ok</main><scr",
		)
		expect(partialOpening.content).toBe("<main>ok</main>")

		const scriptContent = resolveStreamingHtmlCommitContentIncrementally(
			partialOpening.state,
			"<main>ok</main><script>const chart = 1",
		)
		expect(scriptContent.content).toBe("<main>ok</main>")
	})

	it("handles split closing script tags and comments", () => {
		const prefix = "<main>ok</main><script>const chart = 1"
		let result = resolveStreamingHtmlCommitContentIncrementally(undefined, `${prefix}</scr`)
		result = resolveStreamingHtmlCommitContentIncrementally(
			result.state,
			`${prefix}</script><p>done</p>`,
		)

		expect(result.content).toBe(`${prefix}</script><p>done</p>`)
		expect(resolveStreamingHtmlCommitContent("<!-- <script>")).toBe("<!-- <script>")
	})

	it("falls back to a full rescan when the source is replaced", () => {
		const first = resolveStreamingHtmlCommitContentIncrementally(
			undefined,
			"<main>first</main>",
		)
		const replaced = resolveStreamingHtmlCommitContentIncrementally(
			first.state,
			"<script>broken",
		)

		expect(replaced.content).toBe("")
		expect(replaced.content).toBe(resolveStreamingHtmlCommitContent("<script>broken"))
	})
})

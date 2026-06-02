import { describe, expect, it } from "vitest"
import {
	resolveMarkdownRenderSource,
	shouldEnableStreamingTextAnimation,
} from "../streamingMarkdown"

describe("streamingMarkdown", () => {
	it("does not append a synthetic closing fence during streaming", () => {
		const markdown = ["```javascript", "console.log('streaming')"].join("\n")

		expect(resolveMarkdownRenderSource(markdown, { isStreaming: true })).toBe(markdown)
	})

	it("keeps non-streaming fallback for unclosed fences", () => {
		const markdown = ["~~~javascript", "console.log('done')"].join("\n")

		expect(resolveMarkdownRenderSource(markdown, { isStreaming: false })).toBe(
			["~~~javascript", "console.log('done')", "~~~"].join("\n"),
		)
	})

	it("disables streaming text animation for fenced code messages", () => {
		const markdown = ["说明", "```json", '{"ok":true}', "```"].join("\n")

		expect(shouldEnableStreamingTextAnimation(markdown, { isStreaming: true })).toBe(false)
	})

	it("keeps streaming text animation for plain text messages", () => {
		expect(shouldEnableStreamingTextAnimation("普通流式文本", { isStreaming: true })).toBe(true)
	})
})

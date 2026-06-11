import { describe, expect, it } from "vitest"
import {
	resolveMarkdownRenderSource,
	shouldEnableStreamingTextAnimation,
} from "../streamingMarkdown"

describe("streamingMarkdown", () => {
	it("appends a synthetic closing fence during streaming when fence is unclosed", () => {
		const markdown = ["```javascript", "console.log('streaming')"].join("\n")
		const expected = ["```javascript", "console.log('streaming')", "```"].join("\n")

		// 流式过程中同样需要补齐未闭合 fence，避免 HtmlCodeBlockPreview 在
		// "可预览 / 不可预览"之间反复切换，导致视觉抖动
		expect(resolveMarkdownRenderSource(markdown, { isStreaming: true })).toBe(expected)
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

import { describe, expect, it } from "vitest"

import type { JSONContent } from "@/infrastructure/editors/tiptap/core"
import { normalizeQueuePreviewText } from "../utils"

const FILE_MENTION: JSONContent = {
	type: "mention",
	attrs: { type: "project_file", data: { file_id: "1", file_name: "index.html" } },
}

/**
 * 队列里存的是 `serializeSelection` 的产物：`<magic-selection>` 起止标记与各字段
 * 各自成 text 节点，换行被转义成字面 `\n`，File 是 mention 节点。
 */
function createInspectorContent(body: JSONContent[]): JSONContent {
	return {
		type: "doc",
		content: [
			{
				type: "paragraph",
				content: [
					{ type: "text", text: "请帮我看一下 " },
					{ type: "text", text: "<magic-selection>" },
					...body,
					{ type: "text", text: "</magic-selection>" },
					{ type: "text", text: " 这句话要保留" },
				],
			},
		],
	}
}

describe("normalizeQueuePreviewText", () => {
	it("replaces the serialized selection with the chip label", () => {
		const preview = normalizeQueuePreviewText(
			createInspectorContent([
				{ type: "text", text: "Type: html" },
				{ type: "text", text: "\\nFile: " },
				FILE_MENTION,
				{ type: "text", text: "\\nSelector: #app" },
				{ type: "text", text: '\\nText Content: "首屏标题"' },
			]),
		)

		// 标签文案取自元素自身的文本内容，与消息气泡里的标签保持一致。
		expect(preview).toBe("请帮我看一下 首屏标题 这句话要保留")
	})

	it("never leaks the raw selection fields used by the drag preview and delete dialog", () => {
		const preview = normalizeQueuePreviewText(
			createInspectorContent([
				{ type: "text", text: "Type: html" },
				{ type: "text", text: "\\nSelector: #app > canvas" },
				{ type: "text", text: "\\nSize: 320x120" },
			]),
		)

		expect(preview).not.toContain("<magic-selection>")
		expect(preview).not.toContain("Type: html")
		expect(preview).not.toContain("Selector")
		expect(preview).toContain("请帮我看一下")
		expect(preview).toContain("这句话要保留")
	})

	it("keeps the surrounding text when the block cannot be restored", () => {
		const preview = normalizeQueuePreviewText(
			createInspectorContent([{ type: "text", text: "Type: png" }]),
		)

		// 解析失败时退化成原文，不能整段丢失。
		expect(preview).toContain("请帮我看一下")
		expect(preview).toContain("这句话要保留")
	})
})

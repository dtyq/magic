import { describe, expect, it } from "vitest"
import type { RichTextParagraph } from "../../../../../../runtime/document/types"
import {
	buildRichTextContentFromPlainText,
	normalizeOptimizedTextLineBreaks,
} from "../richTextContentOptimization"
import { buildTextContentOptimizationPrompt } from "../textContentOptimizationPrompt"

describe("buildTextContentOptimizationPrompt", () => {
	it("builds a canvas text optimization prompt", () => {
		const prompt = buildTextContentOptimizationPrompt({
			currentText: "夏日新品上市",
			hostUiLocale: "en_US",
		})

		expect(prompt).toContain("# 任务\n优化画布文本元素中的展示文案")
		expect(prompt).toContain("# 当前文本\n```text\n夏日新品上市\n```")
		expect(prompt).toContain("最终文本必须跟随当前文本语言")
		expect(prompt).toContain("只输出优化后的文本正文")
	})

	it("falls back to host locale when text language is unclear", () => {
		const prompt = buildTextContentOptimizationPrompt({
			currentText: "2026",
			hostUiLocale: "en_US",
		})

		expect(prompt).toContain("最终文本必须使用英文")
	})

	it("adds flexible line-structure rules for multiline text", () => {
		const prompt = buildTextContentOptimizationPrompt({
			currentText: "第一行\n第二行",
			hostUiLocale: "zh_CN",
		})

		expect(prompt).toContain("原文本包含多行，默认也应返回多行文本")
		expect(prompt).toContain("请按原有行序逐行优化对应内容")
		expect(prompt).toContain('不要用空格、逗号、顿号或字面量 "\\\\n" 替代换行')
		expect(prompt).toContain("最终输出正文也应直接以多行文本形式返回")
		expect(prompt).toContain("1. 第一行")
		expect(prompt).toContain("2. 第二行")
	})
})

describe("buildRichTextContentFromPlainText", () => {
	it("converts plain text lines into rich text paragraphs and keeps source style", () => {
		const sourceContent: RichTextParagraph[] = [
			{
				children: [
					{
						type: "text",
						text: "旧标题",
						style: { fontSize: 32, color: "#111111" },
					},
				],
				style: { textAlign: "center", lineHeight: 1.2 },
			},
		]

		const content = buildRichTextContentFromPlainText(
			"新标题\n副标题",
			sourceContent,
			undefined,
		)

		expect(content).toHaveLength(2)
		expect(content[0]?.children[0]?.text).toBe("新标题")
		expect(content[1]?.children[0]?.text).toBe("副标题")
		expect(content[0]?.children[0]?.style).toEqual({ fontSize: 32, color: "#111111" })
		expect(content[1]?.children[0]?.style).toEqual({ fontSize: 32, color: "#111111" })
		expect(content[0]?.style?.textAlign).toBe("center")
		expect(content[1]?.style?.textAlign).toBe("center")
	})

	it("normalizes literal newline escapes only when source text is multiline", () => {
		expect(normalizeOptimizedTextLineBreaks("新标题\\n副标题", "旧标题\n旧副标题")).toBe(
			"新标题\n副标题",
		)
		expect(normalizeOptimizedTextLineBreaks("新标题\\n副标题", "旧标题")).toBe(
			"新标题\\n副标题",
		)
	})
})

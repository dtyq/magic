import { describe, expect, it } from "vitest"
import type { JSONContent } from "@/infrastructure/editors/tiptap/react"
import { buildScheduleMessageJSONContent, getPromptPlainText } from "../aiCardScheduleMessage"

function textFromJSONContent(node: JSONContent | undefined): string {
	if (!node) return ""
	if (node.type === "text") return node.text || ""
	if (!Array.isArray(node.content)) return ""
	return node.content.map(textFromJSONContent).filter(Boolean).join("\n")
}

describe("buildScheduleMessageJSONContent", () => {
	it("instructs scheduled runs to archive and restore folder-based card assets", () => {
		const message = buildScheduleMessageJSONContent(
			"分析最新趋势",
			"Daily Card",
			"hotspot-tracker",
		)
		const text = textFromJSONContent(message)

		expect(text).toContain("读取模板目录")
		expect(text).toContain("将当前 latest/ 下所有文件复制到 history/YYYY-MM-DD_HH-mm/")
		expect(text).toContain("将 template/ 下所有文件复制到 latest/")
		expect(text).toContain("仅修改 latest/index.html")
		expect(text).toContain("兼容模式")
	})
})

describe("getPromptPlainText", () => {
	it("preserves text labels from non-text JSONContent nodes", () => {
		const prompt = JSON.stringify({
			type: "doc",
			content: [
				{
					type: "paragraph",
					content: [
						{ type: "text", text: "分析 " },
						{ type: "mention", attrs: { label: "sales.csv" } },
					],
				},
			],
		})

		expect(getPromptPlainText(prompt)).toBe("分析 sales.csv")
	})
})

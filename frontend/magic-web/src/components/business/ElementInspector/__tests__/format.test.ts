import { describe, expect, it } from "vitest"
import { getInspectorElementDisplayText } from "../format"

function createTranslator() {
	return (key: string) => {
		const labels: Record<string, string> = {
			"stylePanel.inspector.tagLabel.video": "视频",
			"stylePanel.inspector.tagLabel.audio": "音频",
			"stylePanel.inspector.tagLabel.image": "图片",
			"stylePanel.inspector.tagLabel.iframe": "嵌入页面",
			"stylePanel.inspector.tagLabel.embed": "嵌入内容",
			"stylePanel.inspector.tagLabel.canvas": "画布",
		}
		return labels[key] ?? key
	}
}

describe("getInspectorElementDisplayText", () => {
	const t = createTranslator()

	it("labels iframe fallback copy as embedded page", () => {
		expect(
			getInspectorElementDisplayText(
				{
					tagName: "iframe",
					textContent: "Your browser does not support iframes.",
				},
				t,
			),
		).toBe("嵌入页面")
	})

	it("labels canvas fallback copy as canvas", () => {
		expect(
			getInspectorElementDisplayText(
				{
					tagName: "canvas",
					textContent: "Your browser does not support HTML canvas.",
				},
				t,
			),
		).toBe("画布")
	})

	it("prefers accessible names for images", () => {
		expect(
			getInspectorElementDisplayText(
				{
					tagName: "img",
					textContent: "",
					accessibleName: "Hero banner",
				},
				t,
			),
		).toBe("Hero banner")
	})
})

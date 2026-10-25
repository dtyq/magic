import { describe, expect, it } from "vitest"
import { getInspectorDetailHeaderLabel } from "../display"

describe("inspector-detail display", () => {
	it("uses the element text as the header label", () => {
		const t = (key: string) =>
			key === "stylePanel.inspector.selectedElement" ? "已选取的元素" : key

		expect(getInspectorDetailHeaderLabel(t, "  hello\nworld  ")).toBe("hello world")
	})

	it("falls back to the translated label when the element has no text", () => {
		const t = (key: string) =>
			key === "stylePanel.inspector.selectedElement" ? "已选取的元素" : key

		expect(getInspectorDetailHeaderLabel(t, "   ")).toBe("已选取的元素")
	})

	it("shows a video label instead of browser fallback copy", () => {
		const t = (key: string) => {
			if (key === "stylePanel.inspector.tagLabel.video") return "视频"
			if (key === "stylePanel.inspector.selectedElement") return "已选取的元素"
			return key
		}

		expect(
			getInspectorDetailHeaderLabel(t, "您的浏览器不支持视频播放，请升级浏览器。", "video"),
		).toBe("视频")
	})
})

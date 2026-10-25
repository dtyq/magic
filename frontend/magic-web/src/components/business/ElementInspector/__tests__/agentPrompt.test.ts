import { describe, expect, it } from "vitest"
import { MentionItemType } from "@/components/business/MentionPanel/types"
import { buildAgentPromptContent, buildHtmlMultiSelectionPromptContent } from "../agentPrompt"
import type { HtmlSelectionTarget } from "../types"

describe("HTML inspector agent prompt", () => {
	it("labels video elements instead of using browser fallback copy", () => {
		const t = (key: string) => (key === "stylePanel.inspector.tagLabel.video" ? "视频" : key)
		const content = buildAgentPromptContent(
			{
				selector: "video.demo",
				tagName: "video",
				id: "",
				classList: ["demo"],
				rect: { top: 0, left: 0, width: 640, height: 360 },
				margin: { top: 0, right: 0, bottom: 0, left: 0 },
				padding: { top: 0, right: 0, bottom: 0, left: 0 },
				border: { top: 0, right: 0, bottom: 0, left: 0 },
				computedStyles: {},
				attributes: {},
				textContent: "您的浏览器不支持视频播放，请升级浏览器。",
				resource: "https://example.com/demo.mp4",
			},
			"Inspector details",
			undefined,
			undefined,
			undefined,
			t,
		)

		const detail = content.content?.[0]?.content?.[0]
		expect(detail?.attrs?.textContent).toBe("视频")
	})

	it("renders the HTML file and screenshot as mention nodes", () => {
		const screenshot: HtmlSelectionTarget = {
			id: "screenshot:1",
			kind: "screenshot",
			screenshot: {
				dataUrl: "data:image/png;base64,abc",
				rect: { top: 1, left: 2, width: 30, height: 40 },
			},
			instruction: "Align this card",
		}
		const content = buildHtmlMultiSelectionPromptContent(
			{ fileId: "html-1", fileName: "index.html", filePath: "index.html" },
			[screenshot],
			"Inspector details",
			new Map([
				[
					"screenshot:1",
					{
						type: MentionItemType.UPLOAD_FILE,
						data: {
							file_id: "image-1",
							file_name: "html-screenshot-1.png",
							file_extension: "png",
							file_path: "html-screenshot-1.png",
						},
					},
				],
			]),
		)

		const mentions = (content.content ?? [])
			.flatMap((paragraph) => paragraph.content ?? [])
			.filter((node) => node.type === "mention")

		expect(mentions).toHaveLength(2)
		expect(mentions[0]?.attrs?.type).toBe(MentionItemType.PROJECT_FILE)
		expect(mentions[1]?.attrs?.type).toBe(MentionItemType.UPLOAD_FILE)
		expect(JSON.stringify(content)).toContain("Align this card")
	})

	it("keeps element screenshots off the sent inspector node", () => {
		const target: HtmlSelectionTarget = {
			id: "#hero",
			kind: "element",
			info: {
				selector: "#hero",
				tagName: "section",
				id: "hero",
				classList: [],
				rect: { top: 0, left: 0, width: 300, height: 120 },
				margin: { top: 0, right: 0, bottom: 0, left: 0 },
				padding: { top: 0, right: 0, bottom: 0, left: 0 },
				border: { top: 0, right: 0, bottom: 0, left: 0 },
				computedStyles: {},
				attributes: {},
				textContent: "Hero",
			},
			screenshot: {
				dataUrl: "data:image/png;base64,abc",
				rect: { top: 0, left: 0, width: 300, height: 120 },
			},
			instruction: "Keep this visual style",
		}
		const content = buildHtmlMultiSelectionPromptContent(
			{ fileId: "html-1", fileName: "index.html", filePath: "index.html" },
			[target],
			"Inspector details",
			new Map([
				[
					"#hero",
					{
						type: MentionItemType.UPLOAD_FILE,
						data: {
							file_id: "image-1",
							file_name: "hero.png",
							file_extension: "png",
							file_path: ".tmp/hero.png",
						},
					},
				],
			]),
		)

		const mentions = (content.content ?? [])
			.flatMap((paragraph) => paragraph.content ?? [])
			.filter((node) => node.type === "mention")

		expect(mentions).toHaveLength(1)
		expect(mentions[0]?.attrs?.type).toBe(MentionItemType.PROJECT_FILE)
		const inspectorDetail = content.content?.[3]?.content?.[0]
		expect(inspectorDetail?.type).toBe("inspector-detail")
		expect(inspectorDetail?.attrs?.screenshotMention).toBeUndefined()
		expect(inspectorDetail?.attrs?.captureId).toBe("#hero")
		expect(inspectorDetail?.attrs?.textContent).toBe("Hero")
	})

	it("reuses the inspector-detail node for normalized element targets", () => {
		const content = buildHtmlMultiSelectionPromptContent(
			{ fileId: "html-1", fileName: "index.html", filePath: "index.html" },
			[
				{
					id: "target-1",
					kind: "element",
					selector: "section.hero > h1",
					elementLabel: "h1",
					textContent: "Welcome",
					domContext: {
						parentSelector: "section.hero",
						siblingIndex: 1,
						sameTagSiblingCount: 1,
						sameTagIndex: 1,
					},
					instruction: "Change this heading",
				},
			],
			"HTML 页面修改目标",
		)

		const detail = content.content?.[3]?.content?.[0]
		expect(detail?.type).toBe("inspector-detail")
		expect(detail?.attrs).toMatchObject({
			selector: "section.hero > h1",
			textContent: "Welcome",
			captureId: "target-1",
		})
		expect(JSON.parse(detail?.attrs?.domContext ?? "{}")).toEqual({
			parentSelector: "section.hero",
			siblingIndex: 1,
			sameTagSiblingCount: 1,
			sameTagIndex: 1,
		})
	})

	it("does not attach a local element screenshot to a normalized inspector node", () => {
		const content = buildHtmlMultiSelectionPromptContent(
			{ fileId: "html-1", fileName: "index.html", filePath: "index.html" },
			[
				{
					id: "target-1",
					kind: "element",
					selector: "section.hero",
					elementLabel: "section",
					screenshot: {
						dataUrl: "data:image/png;base64,abc",
						rect: { top: 0, left: 0, width: 300, height: 120 },
					},
					instruction: "Keep it",
				},
			],
			"HTML 页面修改目标",
			new Map([
				[
					"target-1",
					{
						type: MentionItemType.UPLOAD_FILE,
						data: {
							file_id: "image-1",
							file_name: "hero.png",
							file_extension: "png",
							file_path: "hero.png",
						},
					},
				],
			]),
		)

		const detail = content.content?.[3]?.content?.[0]
		expect(detail?.attrs?.screenshotMention).toBeUndefined()
		expect(detail?.attrs?.captureId).toBe("target-1")
	})
})

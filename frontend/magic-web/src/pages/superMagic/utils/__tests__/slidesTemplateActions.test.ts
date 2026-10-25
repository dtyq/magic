import { describe, expect, it, vi } from "vitest"
import { MentionItemType } from "@/components/business/MentionPanel/types"
import { TopicMode } from "@/pages/superMagic/pages/Workspace/TopicMode"
import { buildConvertToSlidesTemplatePayload } from "../slidesTemplateActions"

vi.mock("i18next", () => ({
	default: {
		t: vi.fn((key: string) =>
			key === "mySlidesTemplates.convertFilePrompt"
				? "请将这个文件转化为可复用的 PPT 模板。"
				: "请将这个文件夹转化为可复用的 PPT 模板。",
		),
	},
}))

describe("buildConvertToSlidesTemplatePayload", () => {
	it("creates a PPT topic and sends a folder mention before the conversion prompt", () => {
		const payload = buildConvertToSlidesTemplatePayload({
			file_id: "folder-1",
			file_name: "Quarterly deck",
			is_directory: true,
			relative_file_path: "/Quarterly deck",
			display_config: { type: "slide" },
		})

		expect(payload.topicMode).toBe(TopicMode.PPT)
		expect(payload.afterCreate?.send).toBe(true)
		expect(payload.afterCreate?.topicMode).toBe(TopicMode.PPT)
		expect(payload.afterCreate?.mentionItems).toEqual([
			{
				type: "mention",
				attrs: expect.objectContaining({
					type: MentionItemType.FOLDER,
					data: expect.objectContaining({ directory_id: "folder-1" }),
				}),
			},
		])

		const paragraph = payload.afterCreate?.content.content?.[0]
		expect(paragraph?.content?.[0]).toMatchObject({
			type: "mention",
			attrs: { type: MentionItemType.FOLDER },
		})
		expect(paragraph?.content?.[1]).toMatchObject({
			type: "text",
			text: " 请将这个文件夹转化为可复用的 PPT 模板。",
		})
	})

	it("creates a PPT topic and sends a file mention for PPTX/POTX sources", () => {
		const payload = buildConvertToSlidesTemplatePayload({
			file_id: "file-1",
			file_name: "Brand.potx",
			file_extension: "potx",
			is_directory: false,
			relative_file_path: "/Brand.potx",
		})

		expect(payload.topicMode).toBe(TopicMode.PPT)
		expect(payload.afterCreate?.mentionItems).toEqual([
			{
				type: "mention",
				attrs: expect.objectContaining({
					type: MentionItemType.PROJECT_FILE,
					data: expect.objectContaining({
						file_id: "file-1",
						file_name: "Brand.potx",
						file_extension: "potx",
					}),
				}),
			},
		])

		const paragraph = payload.afterCreate?.content.content?.[0]
		expect(paragraph?.content?.[0]).toMatchObject({
			type: "mention",
			attrs: { type: MentionItemType.PROJECT_FILE },
		})
		expect(paragraph?.content?.[1]).toMatchObject({
			type: "text",
			text: " 请将这个文件转化为可复用的 PPT 模板。",
		})
	})
})

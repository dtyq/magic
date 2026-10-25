import { describe, expect, it } from "vitest"
import type { OptionItem } from "@/pages/superMagic/components/MainInputContainer/panels/types"
import { MentionItemType } from "@/components/business/MentionPanel/types"
import {
	buildSlidesTemplateReplacementPayload,
	type SlidesTemplateReplacementTarget,
} from "../slidesTemplateReplacementActions"

const template: OptionItem = {
	value: "PPT-TPL-ABC123",
	label: "商务蓝",
}

const mainFile = {
	file_id: "ppt-1",
	file_name: "季度汇报.html",
	relative_file_path: "演示/季度汇报.html",
	file_extension: "html",
} as any

const folder = {
	file_id: "folder-1",
	file_name: "演示",
	relative_file_path: "演示",
	is_directory: true,
} as any

describe("buildSlidesTemplateReplacementPayload", () => {
	it.each([
		["deck", { scope: "deck" }],
		["slide", { scope: "slide", slideIndex: 2 }],
	] as Array<[string, SlidesTemplateReplacementTarget]>)(
		"includes the exact template code and scope for %s requests",
		(_label, target) => {
			const payload = buildSlidesTemplateReplacementPayload({
				template,
				target,
				mainFile,
				parentFolder: folder,
				targetSlide: {
					file_id: "slide-3",
					file_name: "page3.html",
					relative_file_path: "演示/slides/page3.html",
					file_extension: "html",
				} as any,
			})

			const text = JSON.stringify(payload.afterCreate?.content)
			const mentionItems = payload.afterCreate?.mentionItems ?? []
			expect(text).toContain("PPT-TPL-ABC123")
			expect(text).toContain(
				target.scope === "deck" ? "请将当前 PPT 项目应用为" : "请将第 3 页应用为",
			)
			expect(text).not.toContain("slide-template-replacement Skill")
			expect(text).not.toContain("作用范围")
			expect(text).not.toContain("默认只更换")
			expect(text).not.toContain("用户后续补充说明优先")
			expect(payload.topicMode).toBe("ppt")
			expect(payload.afterCreate?.topicMode).toBe("ppt")
			expect(payload.afterCreate?.send).toBe(true)
			expect(payload.afterCreate?.content.content?.[0]?.type).toBe("paragraph")
			expect(
				payload.afterCreate?.content.content?.[0]?.content?.some(
					(node) => node.type === "text" && !node.text,
				),
			).toBe(false)
			expect(mentionItems).toHaveLength(target.scope === "deck" ? 2 : 1)
			expect(mentionItems[0]?.attrs.type).toBe(MentionItemType.PROJECT_FILE)
			if (target.scope === "deck") {
				expect(text).toContain("当前 PPT")
				expect(text).toContain("所属文件夹")
				expect(mentionItems[1]?.attrs.type).toBe(MentionItemType.FOLDER)
			} else {
				expect(text).toContain("目标页")
				expect(text).not.toContain("所属文件夹")
				expect(text).not.toContain("当前 PPT：")
			}
		},
	)
})

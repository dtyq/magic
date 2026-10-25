import i18next from "i18next"
import type { JSONContent } from "@/infrastructure/editors/tiptap/react"
import { MentionItemType } from "@/components/business/MentionPanel/types"
import type { DesignStyle } from "./catalog"

export interface DesignStyleFileInfo {
	fileId: string
	fileName: string
	filePath: string
}

function buildFileMention(fileInfo: DesignStyleFileInfo) {
	return {
		type: MentionItemType.PROJECT_FILE,
		data: {
			file_id: fileInfo.fileId,
			file_name: fileInfo.fileName,
			file_path: fileInfo.filePath,
			file_extension: fileInfo.fileName.includes(".")
				? (fileInfo.fileName.split(".").pop() ?? "")
				: "",
		},
	}
}

/**
 * The prompt only dispatches the task: which skill, which file, which style.
 * Preservation, in-place update and reporting rules live in the html-design-style skill
 * (backend/super-magic/agents/skills/html-design-style/SKILL.md), so they are not repeated here.
 */
export function buildDesignStylePromptContent(
	fileInfo: DesignStyleFileInfo,
	style: DesignStyle,
): JSONContent {
	if (!fileInfo.fileId || !fileInfo.fileName || !fileInfo.filePath) {
		throw new Error("HTML file context is incomplete")
	}
	return {
		type: "doc",
		content: [
			{
				type: "paragraph",
				content: [
					{
						type: "text",
						text: i18next.t("htmlEditor.designStyle.promptSkill", { ns: "super" }),
					},
				],
			},
			{
				type: "paragraph",
				content: [
					{
						type: "text",
						text: i18next.t("htmlEditor.designStyle.promptFile", { ns: "super" }),
					},
					{ type: "mention", attrs: buildFileMention(fileInfo) },
				],
			},
			{
				type: "paragraph",
				content: [
					{
						type: "text",
						text: i18next.t("htmlEditor.designStyle.promptStyle", {
							ns: "super",
							styleName: style.title,
							styleCode: style.code,
						}),
					},
				],
			},
		],
	}
}

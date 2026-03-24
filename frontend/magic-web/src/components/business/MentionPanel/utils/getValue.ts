import {
	DirectoryMentionData,
	MentionItem,
	MentionItemType,
	ProjectFileMentionData,
	SkillMentionData,
	SkillMentionSource,
} from "../types"
import type { I18nTexts } from "../i18n/types"

export function getSkillMentionSourceLabel(item: MentionItem, t: I18nTexts) {
	if (item.type !== MentionItemType.SKILL) return ""

	const mentionSource = (item.data as SkillMentionData | undefined)?.mention_source
	if (!mentionSource) return ""

	return t.skillSources[mentionSource as SkillMentionSource] || ""
}

export const getItemTypeDescription = (item: MentionItem, t: I18nTexts) => {
	switch (item.type) {
		case MentionItemType.PROJECT_FILE:
			const file_path = (item.data as ProjectFileMentionData)?.file_path
			const file_name = (item.data as ProjectFileMentionData)?.file_name
			const res = file_path.replace(file_name, "")
			if (res.endsWith("/")) {
				return res.slice(0, -1) || t.selectPathItemDescription.rootDirectory
			}
			return res || t.selectPathItemDescription.rootDirectory
		case MentionItemType.FOLDER:
			const directory_path = (item.data as DirectoryMentionData)?.directory_path
			const directory_name = (item.data as DirectoryMentionData)?.directory_name
			const directory_res = directory_path?.replace(directory_name, "") || ""
			if (directory_res.endsWith("/")) {
				return directory_res.slice(0, -1) || t.selectPathItemDescription.rootDirectory
			}
			return directory_res || t.selectPathItemDescription.rootDirectory
		case MentionItemType.UPLOAD_FILE:
			return t.defaultItems.uploadFiles
		case MentionItemType.MCP:
			return t.defaultItems.mcpExtensions
		case MentionItemType.AGENT:
			return t.defaultItems.agents
		case MentionItemType.SKILL:
			return getSkillMentionSourceLabel(item, t) || t.defaultItems.skills
		case MentionItemType.TOOL:
			return t.defaultItems.tools
		default:
			return ""
	}
}

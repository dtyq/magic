import type { JSONContent } from "@/infrastructure/editors/tiptap/react"
import type { SendMessageByContentPayload } from "@/pages/superMagic/components/MessageEditor/types"
import type { SuperMagicCreateNewTopicPayload } from "@/pages/superMagic/events/message"
import type { AttachmentItem } from "@/pages/superMagic/components/TopicFilesButton/hooks/types"
import {
	MentionItemType,
	type ProjectFileMentionData,
} from "@/components/business/MentionPanel/types"
import type {
	MentionListItem,
	TiptapMentionAttributes,
} from "@/components/business/MentionPanel/tiptap-plugin/types"
import { getFolderMentionData } from "@/components/business/MentionPanel/utils/directoryMention"
import { localeTextToDisplayString } from "@/pages/superMagic/components/MainInputContainer/panels/utils"
import type { OptionItem } from "@/pages/superMagic/components/MainInputContainer/panels/types"
import { TopicMode } from "@/pages/superMagic/pages/Workspace/TopicMode"

export type SlidesTemplateReplacementTarget =
	{ scope: "deck" } | { scope: "slide"; slideIndex: number }

interface SlidesTemplateReplacementPayloadOptions {
	template: OptionItem
	target: SlidesTemplateReplacementTarget
	mainFile: AttachmentItem
	parentFolder?: AttachmentItem
	targetSlide?: AttachmentItem
}

function getDisplayName(item: AttachmentItem): string {
	return item.file_name || item.filename || item.display_filename || item.name || ""
}

function getExtension(item: AttachmentItem): string {
	const explicit = (item.file_extension || "").replace(/^\./, "").toLowerCase()
	if (explicit) return explicit
	const name = getDisplayName(item)
	const separator = name.lastIndexOf(".")
	return separator > 0 ? name.slice(separator + 1).toLowerCase() : ""
}

function toMentionAttributes(item: AttachmentItem): TiptapMentionAttributes {
	if (item.is_directory) {
		return {
			type: MentionItemType.FOLDER,
			data: getFolderMentionData({
				directoryId: item.file_id,
				directoryName: getDisplayName(item),
				directoryPath: item.relative_file_path,
				directoryMetadata: item.display_config,
			}),
		}
	}

	return {
		type: MentionItemType.PROJECT_FILE,
		data: {
			file_id: item.file_id,
			file_name: getDisplayName(item),
			file_path: item.relative_file_path,
			file_extension: getExtension(item),
		} as ProjectFileMentionData,
	}
}

function mentionNode(attrs: TiptapMentionAttributes): JSONContent {
	return { type: "mention", attrs }
}

function textNode(text: string): JSONContent {
	return { type: "text", text }
}

function appendMention(
	content: JSONContent[],
	label: string,
	item: AttachmentItem | undefined,
	suffix = "",
): MentionListItem | undefined {
	if (!item?.file_id) return undefined
	const attrs = toMentionAttributes(item)
	const mention: MentionListItem = {
		type: "mention",
		attrs,
	}
	if (label) content.push(textNode(label))
	content.push(mentionNode(attrs))
	if (suffix) content.push(textNode(suffix))
	return mention
}

/**
 * Builds the fixed natural-language command sent after a template is confirmed.
 * The selected template code and file mentions remain structured data so the agent
 * can resolve the exact source nodes instead of parsing display names or paths.
 */
export function buildSlidesTemplateReplacementPayload({
	template,
	target,
	mainFile,
	parentFolder,
	targetSlide,
}: SlidesTemplateReplacementPayloadOptions): SuperMagicCreateNewTopicPayload {
	const templateCode = localeTextToDisplayString(template.value)
	const templateName = localeTextToDisplayString(template.label) || templateCode
	const content: JSONContent[] = [
		textNode(
			target.scope === "slide"
				? `请将第 ${target.slideIndex + 1} 页应用为「${templateName}」模板（template_code：${templateCode}），目标页：`
				: `请将当前 PPT 项目应用为「${templateName}」模板（template_code：${templateCode}），当前 PPT：`,
		),
	]
	const mentionItems: SendMessageByContentPayload["mentionItems"] = []

	if (target.scope === "slide") {
		const slideMention = appendMention(content, "", targetSlide, "。")
		if (slideMention) mentionItems.push(slideMention)
	} else {
		const mainMention = appendMention(content, "", mainFile)
		if (mainMention) mentionItems.push(mainMention)
		const folderMention = appendMention(
			content,
			mainMention ? "，所属文件夹：" : "所属文件夹：",
			parentFolder,
			"。",
		)
		if (folderMention) mentionItems.push(folderMention)
	}

	return {
		topicMode: TopicMode.PPT,
		afterCreate: {
			send: true,
			topicMode: TopicMode.PPT,
			// TipTap docs only accept block nodes; inline text/mention must live in a paragraph.
			content: {
				type: "doc",
				content: [{ type: "paragraph", content }],
			},
			mentionItems,
		},
	}
}

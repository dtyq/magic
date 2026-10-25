import i18next from "i18next"
import type { SuperMagicCreateNewTopicPayload } from "@/pages/superMagic/events/message"
import type { AttachmentItem } from "@/pages/superMagic/components/TopicFilesButton/hooks/types"
import {
	MentionItemType,
	type ProjectFileMentionData,
} from "@/components/business/MentionPanel/types"
import { getFolderMentionData } from "@/components/business/MentionPanel/utils/directoryMention"
import { TopicMode } from "@/pages/superMagic/pages/Workspace/TopicMode"

function getAttachmentDisplayName(item: AttachmentItem): string {
	return item.file_name || item.filename || item.display_filename || item.name || ""
}

function getAttachmentExtension(item: AttachmentItem): string {
	const explicit = (item.file_extension || "").replace(/^\./, "").toLowerCase()
	if (explicit) return explicit
	const name = getAttachmentDisplayName(item)
	const separatorIndex = name.lastIndexOf(".")
	if (separatorIndex <= 0) return ""
	return name.slice(separatorIndex + 1).toLowerCase()
}

function buildConvertMention(item: AttachmentItem) {
	if (item.is_directory) {
		return {
			type: MentionItemType.FOLDER,
			data: getFolderMentionData({
				directoryId: item.file_id,
				directoryName: getAttachmentDisplayName(item),
				directoryPath: item.relative_file_path,
				directoryMetadata: item.display_config,
			}),
		} as const
	}

	return {
		type: MentionItemType.PROJECT_FILE,
		data: {
			file_id: item.file_id,
			file_name: getAttachmentDisplayName(item),
			file_path: item.relative_file_path,
			file_extension: getAttachmentExtension(item),
		} as ProjectFileMentionData,
	} as const
}

/** Builds the create-topic contract with one file or folder mention and the conversion prompt. */
export function buildConvertToSlidesTemplatePayload(
	item: AttachmentItem,
): SuperMagicCreateNewTopicPayload {
	const mention = buildConvertMention(item)
	const prompt = item.is_directory
		? i18next.t("mySlidesTemplates.convertPrompt", { ns: "super" })
		: i18next.t("mySlidesTemplates.convertFilePrompt", { ns: "super" })

	return {
		topicMode: TopicMode.PPT,
		afterCreate: {
			send: true,
			topicMode: TopicMode.PPT,
			content: {
				type: "doc",
				content: [
					{
						type: "paragraph",
						content: [
							{ type: "mention", attrs: mention },
							{
								type: "text",
								text: ` ${prompt}`,
							},
						],
					},
				],
			},
			mentionItems: [{ type: "mention", attrs: mention }],
		},
	}
}

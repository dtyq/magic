import { TiptapMentionAttributes } from "@/components/business/MentionPanel/tiptap-plugin"
import {
	getMentionDescription,
	getMentionDisplayName,
} from "@/components/business/MentionPanel/tiptap-plugin/types"
import {
	DirectoryMentionData,
	MentionItemType,
	ProjectFileMentionData,
	UploadFileMentionData,
} from "@/components/business/MentionPanel/types"
import { useTranslation } from "react-i18next"

interface MentionTooltipContentProps {
	data: TiptapMentionAttributes
	displayName?: string
	description?: string
}

export function MentionTooltipContent(props: MentionTooltipContentProps) {
	const { data, displayName, description } = props
	const { t } = useTranslation("super")

	const mentionDisplayName = displayName ?? getMentionDisplayName(data)
	const mentionDescription = description ?? getMentionDescription(data)

	switch (data.type) {
		case MentionItemType.MCP:
		case MentionItemType.AGENT:
		case MentionItemType.SKILL:
		case MentionItemType.TOOL:
			return mentionDescription

		case MentionItemType.FOLDER:
			return (data.data as DirectoryMentionData).directory_path
		case MentionItemType.MEMORY_FILE:
		case MentionItemType.USER_FILE:
			return (data.data as { file_path: string }).file_path
		case MentionItemType.MEMORY_DIRECTORY:
		case MentionItemType.USER_DIRECTORY:
			return (data.data as { directory_path: string }).directory_path

		case MentionItemType.PROJECT_FILE:
			return (data.data as ProjectFileMentionData).file_path

		case MentionItemType.UPLOAD_FILE: {
			const uploadData = data.data as UploadFileMentionData
			const isUploadError = uploadData.upload_status === "error"

			const fileNameNode = (
				<span className="w-full whitespace-pre-wrap">
					{isUploadError ? t("fileUpload.uploadFailedPrefix") : ""}
					{uploadData.file_name}
				</span>
			)

			return fileNameNode
		}

		default:
			return mentionDisplayName
	}
}

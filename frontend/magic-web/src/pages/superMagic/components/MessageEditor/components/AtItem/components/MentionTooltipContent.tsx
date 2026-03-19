import FlexBox from "@/components/base/FlexBox"
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
import { getFileType } from "@/pages/superMagic/utils/handleFIle"
import { useTranslation } from "react-i18next"
import { ImageInProjectFile, ImageInUploadFile } from "./AtItemPreviewImage"

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

		case MentionItemType.PROJECT_FILE: {
			const item = data.data as ProjectFileMentionData
			const fileName = item.file_name
			const extension = item.file_extension || item.file_name.split(".").pop() || ""

			if (item.file_id && getFileType(extension) === "image") {
				return (
					<FlexBox vertical gap={4} align="flex-start">
						<span className="w-full whitespace-pre-wrap">{fileName}</span>
						<ImageInProjectFile fileId={item.file_id} fileName={fileName} />
					</FlexBox>
				)
			}

			return item.file_path
		}

		case MentionItemType.UPLOAD_FILE: {
			const uploadData = data.data as UploadFileMentionData
			const file = uploadData.file
			const fileExtension = uploadData.file_extension || file?.type.split("/").pop() || ""
			const isUploadError = uploadData.upload_status === "error"

			const fileNameNode = (
				<span className="w-full whitespace-pre-wrap">
					{isUploadError ? t("fileUpload.uploadFailedPrefix") : ""}
					{uploadData.file_name}
				</span>
			)

			if (file && getFileType(fileExtension) === "image") {
				return (
					<FlexBox vertical gap={4} align="flex-start">
						{fileNameNode}
						<ImageInUploadFile file={file} fileName={uploadData.file_name} />
					</FlexBox>
				)
			}

			return fileNameNode
		}

		default:
			return mentionDisplayName
	}
}

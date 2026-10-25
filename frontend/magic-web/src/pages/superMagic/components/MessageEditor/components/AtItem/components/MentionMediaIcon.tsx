import { FileResourceIcon } from "@/pages/superMagic/components/TopicFilesButton/components/FileResourceIcon"
import {
	resolveFilePresentation,
	type FilePresentation,
} from "@/pages/superMagic/components/TopicFilesButton/utils/file-presentation"
import { memo } from "react"
import { MediaPreviewThumbnail } from "@/components/base/MediaPreview"
import type {
	ProjectFileMentionData,
	UserFileMentionData,
	UploadFileMentionData,
} from "@/components/business/MentionPanel/types"
import { MentionItemType } from "@/components/business/MentionPanel/types"
import type { TiptapMentionAttributes } from "@/components/business/MentionPanel/tiptap-plugin/types"
import {
	useMentionMediaSource,
	type MentionMediaSource,
} from "../../MentionMedia/useMentionMediaSource"

interface MentionMediaIconProps {
	presentation?: FilePresentation
	type: (typeof MentionItemType)["PROJECT_FILE" | "UPLOAD_FILE" | "USER_FILE"]
	data: ProjectFileMentionData | UploadFileMentionData | UserFileMentionData
	size: number
	mediaSource?: MentionMediaSource
}

function MentionMediaIcon({
	presentation,
	type,
	data,
	size,
	mediaSource: providedSource,
}: MentionMediaIconProps) {
	const uploadData = type === MentionItemType.UPLOAD_FILE ? (data as UploadFileMentionData) : null
	const extension =
		data.file_extension ||
		uploadData?.file?.type.split("/").pop() ||
		data.file_name.split(".").pop() ||
		""
	const mentionData: TiptapMentionAttributes = { type, data }
	const ownSource = useMentionMediaSource({
		data: mentionData,
		uploadFile: uploadData?.file || null,
		enabled: !providedSource,
	})
	const { mediaType, thumbnailUrl } = providedSource ?? ownSource
	const fallback = (
		<FileResourceIcon
			presentation={
				presentation ??
				resolveFilePresentation({
					...data,
					space_type: type === MentionItemType.USER_FILE ? "user" : undefined,
					file_extension: extension,
				})
			}
			size={size}
		/>
	)

	if (!mediaType) {
		return fallback
	}

	return (
		<MediaPreviewThumbnail
			mediaType={mediaType}
			thumbnailUrl={thumbnailUrl}
			alt={data.file_name}
			fallback={fallback}
			className="shrink-0 rounded object-cover"
			style={{ width: size, height: size }}
		/>
	)
}

export default memo(MentionMediaIcon)

import { resolveFilePresentation } from "@/pages/superMagic/components/TopicFilesButton/utils/file-presentation"
import { observer } from "mobx-react-lite"
import { decodePathForDisplay } from "./helper"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import { useMessageListProjectFilesStore } from "@/pages/superMagic/components/MessageList/context"
import { FileReference, getFileExtensionFromPath } from "./FileReference"
import {
	createCanonicalWorkspaceHref,
	findLegacyAttachmentByPath,
} from "@/pages/superMagic/utils/markdownFileReference"
import { MentionItemType } from "@/components/business/MentionPanel/types"
import type { TiptapMentionAttributes } from "@/components/business/MentionPanel/tiptap-plugin"
import {
	createDirectoryMentionData,
	createProjectFileMentionData,
} from "@/components/business/MentionPanel/utils/projectReferenceMention"

export const FilePath = observer((props: { path?: unknown }) => {
	const { path } = props
	const projectFilesStore = useMessageListProjectFilesStore()
	const normalizedPath = typeof path === "string" ? path : ""
	// 只解码展示文本，内部匹配和打开逻辑仍使用原始路径。
	const displayPath = decodePathForDisplay(normalizedPath)
	// 获取附件列表
	const attachments = projectFilesStore?.workspaceFilesList ?? []

	// 根据相对路径查找文件信息
	const fileInfo = findLegacyAttachmentByPath(attachments, normalizedPath)
	const fileHref = createCanonicalWorkspaceHref(
		fileInfo?.relative_file_path || fileInfo?.path || normalizedPath,
	)

	const onClick = () => {
		if (fileInfo) {
			pubsub.publish(PubSubEvents.Open_File_Tab, {
				fileId: fileInfo?.file_id,
				fileData: fileInfo,
			})
		}
	}

	if (fileInfo) {
		const projectId = fileInfo.project_id || projectFilesStore?.currentSelectedProject?.id
		const mentionAttrs: TiptapMentionAttributes | undefined = fileInfo.file_id
			? fileInfo.is_directory || fileInfo.type === "directory"
				? {
						type: MentionItemType.FOLDER,
						data: { ...createDirectoryMentionData(fileInfo), project_id: projectId },
					}
				: {
						type: MentionItemType.PROJECT_FILE,
						data: createProjectFileMentionData({ ...fileInfo, project_id: projectId }),
					}
			: undefined
		return (
			<FileReference
				presentation={resolveFilePresentation(fileInfo, {
					context: projectFilesStore?.filePresentationContext,
					index: projectFilesStore?.filePresentationIndex,
				})}
				label={displayPath}
				mentionAttrs={mentionAttrs}
				href={fileHref ?? undefined}
				fileType={fileInfo.file_extension || getFileExtensionFromPath(displayPath)}
				onClick={onClick}
				title={displayPath}
			/>
		)
	}

	return (
		<FileReference
			label={displayPath}
			href={fileHref ?? undefined}
			fileType={getFileExtensionFromPath(displayPath)}
			disabled
			title={`File does not exist: ${displayPath}`}
		/>
	)
})

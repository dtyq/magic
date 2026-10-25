import { useMemo } from "react"
import {
	MentionItemType,
	type ProjectFileMentionData,
	type UserFileMentionData,
	type UploadFileMentionData,
} from "@/components/business/MentionPanel/types"
import type { TiptapMentionAttributes } from "@/components/business/MentionPanel/tiptap-plugin/types"
import type { MediaPreviewSource, MediaPreviewType } from "@/components/base/MediaPreview"
import {
	useFileMediaSource,
	type FileMediaMetadata,
} from "@/pages/superMagic/services/useFileMediaSource"
import { getFileType } from "@/pages/superMagic/utils/handleFIle"
import useObjectUrl from "../AtItem/hooks/useObjectURL"
import { downloadBlobFile } from "@/utils/file"
import { AttachmentSource } from "../../../TopicFilesButton/hooks/types"
import { useOptionalMessageEditorStore } from "../../stores/context"
import { useMessageListProjectFilesStore } from "../../../MessageList/context"

export interface MentionMediaSource extends Omit<MediaPreviewSource, "mediaType"> {
	mediaType: MediaPreviewType | null
}

interface UseMentionMediaSourceOptions {
	data: TiptapMentionAttributes
	/** 编辑器内实时上传文件；用于保留生产 liveFile 优先行为。 */
	uploadFile?: File | null
	enabled?: boolean
	/** Pending canvas chips skip thumbnail ensure to avoid mass NodeView update storms. */
	loadThumbnail?: boolean
}

function getMentionFileData(data: TiptapMentionAttributes) {
	if (data.type === MentionItemType.USER_FILE) return data.data as UserFileMentionData
	if (data.type === MentionItemType.PROJECT_FILE) return data.data as ProjectFileMentionData
	if (data.type === MentionItemType.UPLOAD_FILE) return data.data as UploadFileMentionData
	return null
}

export function useMentionMediaSource({
	data,
	uploadFile,
	enabled = true,
	loadThumbnail = true,
}: UseMentionMediaSourceOptions): MentionMediaSource {
	const fileData = getMentionFileData(data)
	const extension =
		fileData?.file_extension ||
		uploadFile?.type.split("/").pop() ||
		fileData?.file_name.split(".").pop() ||
		""
	const type = getFileType(extension)
	const mediaType: MediaPreviewType | null =
		type === "image" || type === "video" || type === "audio" ? type : null
	const isUploadFile = data.type === MentionItemType.UPLOAD_FILE
	const localUpload =
		isUploadFile &&
		(mediaType !== "image" ||
			Boolean(uploadFile) ||
			(fileData as UploadFileMentionData | null)?.upload_status !== "done")
	const isUserFile = data.type === MentionItemType.USER_FILE
	const editorStore = useOptionalMessageEditorStore()
	const messageFiles = useMessageListProjectFilesStore()
	const fileStore = editorStore?.fileUploadStore.getProjectFilesStore() ?? messageFiles
	const projectData =
		data.type === MentionItemType.PROJECT_FILE
			? (fileData as ProjectFileMentionData)
			: undefined
	const sourceProjectId = projectData?.source_project_id || projectData?.project_id
	const canonicalFile =
		!isUserFile &&
		(!sourceProjectId || fileStore.currentSelectedProject?.id === sourceProjectId)
			? fileStore.filePresentationIndex.attachments.getItemByKey(
					projectData?.source_file_id || fileData?.file_id || "",
				)
			: undefined
	const remoteFile: FileMediaMetadata | null =
		fileData && !localUpload
			? {
					spaceType: isUserFile ? "user" : "project",
					fileId: fileData.file_id,
					identity: projectData?.source_file_id,
					projectId: projectData?.source_project_id || projectData?.project_id,
					fileName: fileData.file_name,
					fileExtension: extension,
					isAIImage:
						(canonicalFile?.source ?? projectData?.source) === AttachmentSource.AI,
					fileVersion: projectData?.file_version,
					updatedAt: projectData?.updated_at,
					resourceVersion:
						projectData?.resource_version ||
						(projectData?.version != null ? String(projectData.version) : undefined),
					path: fileData.file_path,
				}
			: null
	const source = useFileMediaSource(remoteFile, { enabled, loadThumbnail })
	const objectUrl = useObjectUrl(enabled && isUploadFile && mediaType ? uploadFile || null : null)

	// 实时上传继续使用本地 File；共享远端加载不能覆盖未完成上传的本地预览。
	return useMemo(
		() =>
			localUpload
				? {
						mediaType,
						thumbnailUrl: objectUrl,
						previewUrl: objectUrl,
						resourceKey: uploadFile
							? `local:${fileData?.file_id}:${uploadFile.lastModified}:${uploadFile.size}`
							: undefined,
						imageActions:
							mediaType === "image" && uploadFile && objectUrl
								? {
										load: async ({ signal }: { signal: AbortSignal }) =>
											signal.aborted ? null : { url: objectUrl },
										onDownload: async () => {
											const result = await downloadBlobFile(
												uploadFile,
												uploadFile.name,
											)
											if (!result.success)
												throw new Error("Local image download failed")
										},
									}
								: undefined,
						audioUrl: mediaType === "audio" ? objectUrl : null,
						isLoading: false,
						hasError: Boolean(mediaType && !objectUrl && uploadFile),
					}
				: (source ?? { mediaType, isLoading: false, hasError: false }),
		[localUpload, mediaType, objectUrl, uploadFile, source, fileData?.file_id],
	)
}

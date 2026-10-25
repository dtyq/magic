import { FileResourceIcon } from "@/pages/superMagic/components/TopicFilesButton/components/FileResourceIcon"
import { resolveFilePresentation } from "@/pages/superMagic/components/TopicFilesButton/utils/file-presentation"
import { NodeViewWrapper } from "@/infrastructure/editors/tiptap/react"
import { observer } from "mobx-react-lite"
import { useCallback, type MouseEvent, type ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { X } from "lucide-react"
import { MediaPreviewTrigger, type MediaPreviewSource } from "@/components/base/MediaPreview"
import {
	getMentionDisplayName,
	type MentionNodeViewRendererProps,
	type TiptapMentionAttributes,
} from "@/components/business/MentionPanel/tiptap-plugin/types"
import {
	MentionItemType,
	type ProjectFileMentionData,
	type UserFileMentionData,
	type UploadFileMentionData,
} from "@/components/business/MentionPanel/types"
import { useIsMobile } from "@/hooks/useIsMobile"
import { cn } from "@/utils/cn"
import { useOptionalMessageEditorStore } from "../../../stores"
import { toDisplayUploadProgress } from "../../../utils/uploadProgress"
import { useMentionMediaSource } from "../../MentionMedia/useMentionMediaSource"
import {
	MESSAGE_FILE_MENTION_NAME_CLASSES,
	MESSAGE_FILE_MENTION_ROOT_CLASS,
	MESSAGE_FILE_MENTION_VISUAL_BASE_CLASSES,
	MESSAGE_FILE_MENTION_VISUAL_CLASS,
	MESSAGE_FILE_MENTION_DESKTOP_CLASSES,
} from "@/components/business/MentionPanel/messageMentionVisual"

type FileMentionData = ProjectFileMentionData | UploadFileMentionData | UserFileMentionData

function FileMentionNodeView({ attrs, deleteNode, selected }: MentionNodeViewRendererProps) {
	const isMobile = useIsMobile()
	const { t } = useTranslation("super")
	const editorStore = useOptionalMessageEditorStore()
	const mention = attrs as TiptapMentionAttributes
	const data = attrs.data as FileMentionData
	const isUpload = attrs.type === MentionItemType.UPLOAD_FILE
	const uploadData = isUpload ? (data as UploadFileMentionData) : undefined
	const liveFile = uploadData
		? editorStore?.fileUploadStore.getFileById(uploadData.file_id)
		: undefined
	const fileName = liveFile?.name || getMentionDisplayName(mention)
	const file = liveFile?.file || uploadData?.file || null
	const mediaSource = useMentionMediaSource({
		data: mention,
		uploadFile: file,
	})
	const { mediaType } = mediaSource
	const status = liveFile?.status ?? uploadData?.upload_status
	const progress = toDisplayUploadProgress(liveFile?.progress ?? uploadData?.upload_progress) ?? 0
	const isUploading = isUpload && (status === "init" || status === "uploading")
	const isError = isUpload && status === "error"

	const handleMouseDown = useCallback((event: MouseEvent) => {
		// Mentions are atomic nodes; prevent the browser and ProseMirror from
		// turning a pointer drag into a text selection.
		event.preventDefault()
		event.stopPropagation()
	}, [])

	const handleRemove = useCallback(
		(event: MouseEvent<HTMLButtonElement>) => {
			event.preventDefault()
			event.stopPropagation()
			deleteNode?.()
		},
		[deleteNode],
	)

	const fileStore = editorStore?.fileUploadStore.getProjectFilesStore()
	const fileIcon = (
		<FileResourceIcon
			presentation={resolveFilePresentation(
				{
					...data,
					space_type: attrs.type === MentionItemType.USER_FILE ? "user" : undefined,
					file_name: fileName,
					file_extension: data.file_extension || fileName.split(".").pop() || "",
				},
				{
					context: isUpload ? undefined : fileStore?.filePresentationContext,
					index: isUpload ? undefined : fileStore?.filePresentationIndex,
				},
			)}
			size={16}
			className="shrink-0"
		/>
	)
	const previewSource: MediaPreviewSource | null = mediaType
		? (mediaSource as MediaPreviewSource)
		: null
	const renderVisual = (thumbnail: ReactNode) => (
		<span
			className={cn(
				MESSAGE_FILE_MENTION_VISUAL_CLASS,
				MESSAGE_FILE_MENTION_VISUAL_BASE_CLASSES,
				isMobile
					? "mb-1 rounded-full bg-muted py-0.5 pl-2 pr-1 text-sm text-foreground"
					: MESSAGE_FILE_MENTION_DESKTOP_CLASSES,
				!isMobile && isUploading && "bg-muted text-muted-foreground",
				isError && "bg-destructive/10 text-destructive",
				selected && "ring-1 ring-primary/40",
			)}
			data-testid={isUpload ? "upload-file-mention-visual" : "file-mention-visual"}
		>
			{isUploading && (
				<span
					className={cn(
						"pointer-events-none absolute inset-y-0 left-0 transition-[width] duration-200 ease-out",
						isMobile ? "bg-primary/10" : "bg-primary/15",
					)}
					style={{ width: `${progress}%` }}
					data-testid={
						isUpload
							? "upload-file-mention-progress-background"
							: "file-mention-progress-background"
					}
				/>
			)}
			<span className="relative z-10 flex shrink-0 items-center">{thumbnail}</span>
			<span
				className={MESSAGE_FILE_MENTION_NAME_CLASSES}
				title={attrs.type === MentionItemType.USER_FILE ? data.file_path : fileName}
			>
				{fileName}
			</span>
			{isUploading && (
				<span
					className="relative z-10 shrink-0 text-[0.85em] tabular-nums leading-none text-muted-foreground"
					data-testid={
						isUpload ? "upload-file-mention-progress" : "file-mention-progress"
					}
				>
					{progress}%
				</span>
			)}
			{isError && (
				<span className="relative z-10 shrink-0 text-xs">
					{t("fileUpload.uploadFailed")}
				</span>
			)}
			{isMobile && typeof deleteNode === "function" && (
				<button
					type="button"
					className="relative z-10 inline-flex size-4 shrink-0 items-center justify-center rounded-full"
					onMouseDown={handleMouseDown}
					onClick={handleRemove}
					aria-label={t("uploadModal.removeFile")}
				>
					<X size={16} />
				</button>
			)}
		</span>
	)

	const content = (
		<MediaPreviewTrigger
			fileName={fileName}
			source={previewSource}
			fallback={fileIcon}
			renderTrigger={renderVisual}
			labels={{
				errorMessage: t("common.fileNotFoundOrLoadFailed", "文件不存在或加载错误"),
				audioLabels: {
					play: t("filePreview.play", "播放"),
					pause: t("filePreview.pause", "暂停"),
					loading: t("common.loading", "加载中"),
					progress: t("filePreview.progress", "播放进度"),
				},
			}}
			enableTouchTrigger
		/>
	)

	return (
		<NodeViewWrapper
			as="span"
			className={cn(
				"magic-mention relative !-top-px !inline-flex max-w-full !cursor-grab select-none !overflow-visible !bg-transparent !p-0 !align-middle active:cursor-grabbing",
				MESSAGE_FILE_MENTION_ROOT_CLASS,
				mention.pending && "opacity-50",
			)}
			contentEditable={false}
			data-mention-node-view="file"
			data-type={attrs.type}
			data-data={JSON.stringify(attrs.data || {})}
			draggable={false}
			data-magic-editor-node
			onMouseDown={handleMouseDown}
		>
			{content}
		</NodeViewWrapper>
	)
}

export default observer(FileMentionNodeView)

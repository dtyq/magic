import { memo, useEffect, useRef } from "react"
import { Loader2 } from "lucide-react"
import PreviewDetailPopup, {
	type PreviewDetailPopupRef,
} from "@/pages/superMagicMobile/components/PreviewDetailPopup"
import { detectContentTypeRender } from "@/pages/superMagic/components/Detail/components/FilesViewer/utils/preview"
import type { FileItem } from "@/pages/superMagic/components/Detail/components/FilesViewer/types"
import type { AttachmentItem } from "@/pages/superMagic/components/TopicFilesButton/hooks/types"
import AiCanvasDocumentStatus from "@/pages/superMagic/pages/TopicPage/components/AiCanvasDocumentStatus"
import type { ProjectListItem, Topic } from "@/pages/superMagic/pages/Workspace/types"

interface MobileAiCanvasPanelProps {
	/** The project's canvas folder (useAiCanvasDocument); null until found or created. */
	canvasFolder: AttachmentItem | null
	isCreating: boolean
	creationError: boolean
	onRetry: () => void
	attachmentTree: AttachmentItem[]
	attachmentList: AttachmentItem[]
	selectedProject: ProjectListItem | null
	selectedTopic: Topic | null
	setUserSelectDetail: (detail: Parameters<PreviewDetailPopupRef["open"]>[0] | null) => void
}

/** Same detail the files tab builds for a content-type folder (MobileProjectDetailFilesView). */
function buildCanvasDetail(folder: AttachmentItem, attachments: AttachmentItem[]) {
	const fileItem: FileItem = {
		file_id: folder.file_id || "",
		file_name: folder.name || folder.file_name || "",
		display_filename: folder.name || folder.file_name,
		is_directory: folder.is_directory,
		children: folder.children as FileItem[] | undefined,
		relative_file_path: folder.relative_file_path,
		parent_id: folder.parent_id ?? undefined,
		display_config: folder.display_config,
		file_extension: folder.file_extension,
		file_size: folder.file_size,
	}
	const config = detectContentTypeRender(fileItem)
	if (!config) return null
	const transformed = config.dataTransformer ? config.dataTransformer(fileItem) : folder
	return {
		type: config.detailType,
		data: {
			...folder,
			...transformed,
			file_id: folder.file_id,
			file_name: folder.name || folder.file_name,
			display_config: folder.display_config,
		},
		currentFileId: folder.file_id || "",
		attachments,
	} as Parameters<PreviewDetailPopupRef["open"]>[0]
}

/**
 * Canvas tab of an AI canvas project on H5: the project's single canvas rendered in place by the
 * shared preview (the design viewer is read-only and fits the screen on mobile). While the canvas
 * is being created, or creation failed, it shows the same status as the desktop page.
 */
function MobileAiCanvasPanel({
	canvasFolder,
	isCreating,
	creationError,
	onRetry,
	attachmentTree,
	attachmentList,
	selectedProject,
	selectedTopic,
	setUserSelectDetail,
}: MobileAiCanvasPanelProps) {
	const previewRef = useRef<PreviewDetailPopupRef>(null)
	const canvasFileId = canvasFolder?.file_id

	// Opens the canvas when the tab mounts and again only if the canvas itself changes; later file
	// tree updates refresh the preview's file context below without reloading the canvas.
	useEffect(() => {
		if (!canvasFolder) return
		const detail = buildCanvasDetail(canvasFolder, attachmentTree)
		if (detail) previewRef.current?.open(detail, attachmentTree, attachmentList)
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [canvasFileId])

	useEffect(() => {
		previewRef.current?.updateAttachments(attachmentTree, attachmentList)
	}, [attachmentList, attachmentTree])

	if (!canvasFolder) {
		if (isCreating || creationError) {
			return <AiCanvasDocumentStatus isCreating={isCreating} onRetry={onRetry} />
		}
		return (
			<div className="flex h-full items-center justify-center text-muted-foreground">
				<Loader2 className="size-6 animate-spin" aria-hidden="true" />
			</div>
		)
	}

	return (
		<PreviewDetailPopup
			ref={previewRef}
			inline
			selectedProject={selectedProject}
			selectedTopic={selectedTopic}
			// Mobile canvases are read-only; the design viewer enforces it as well.
			allowEdit={false}
			setUserSelectDetail={setUserSelectDetail}
		/>
	)
}

export default memo(MobileAiCanvasPanel)

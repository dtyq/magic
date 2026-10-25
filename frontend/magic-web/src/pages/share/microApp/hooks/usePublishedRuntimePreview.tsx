import { useCallback, useEffect, useRef, useState, type ReactNode } from "react"

import { getToolDetailSelectionTarget } from "@/pages/superMagic/components/MessageList/components/Nodes/toolDetailSelection"
import type { FileManagerContext } from "@/pages/superMagic/components/Detail/components/FilesViewer/types"
import type { AttachmentItem } from "@/pages/superMagic/components/TopicFilesButton/hooks"
import type { ProjectListItem, Topic } from "@/pages/superMagic/pages/Workspace/types"
import type { AttachmentLoadState } from "@/stores/projectFiles/types"
import { canEditProject } from "@/pages/superMagic/utils/permission"
import PreviewDetailPopup, {
	type PreviewDetail,
	type PreviewDetailPopupRef,
} from "@/pages/superMagicMobile/components/PreviewDetailPopup"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import PublishedMicroAppFileManagerPopup from "../components/PublishedMicroAppFileManagerPopup"
import { buildRuntimeFilePreviewDetail, resolveRuntimeFileOpen } from "./resolveRuntimeFileOpen"

export { buildRuntimeFilePreviewDetail } from "./resolveRuntimeFileOpen"

interface UsePublishedRuntimePreviewOptions {
	enabled: boolean
	selectedProject?: ProjectListItem | null
	selectedTopic?: Topic | null
	fileTree: AttachmentItem[]
	fileList: AttachmentItem[]
	attachmentLoadState?: AttachmentLoadState
}

export function usePublishedRuntimePreview({
	enabled,
	selectedProject,
	selectedTopic,
	fileTree,
	fileList,
	attachmentLoadState,
}: UsePublishedRuntimePreviewOptions): {
	handleSelectDetail: (detail: unknown) => void
	handleOpenFile: (file?: unknown) => void
	openPreviewDetail: (detail: unknown) => void
	previewPopup: ReactNode
	fileManagerPopup: ReactNode
} {
	const previewDetailPopupRef = useRef<PreviewDetailPopupRef>(null)
	const [fileManagerContext, setFileManagerContext] = useState<FileManagerContext | null>(null)
	const selectedProjectId = selectedProject?.id
	const canEdit = canEditProject(selectedProject?.user_role)

	useEffect(() => {
		setFileManagerContext(null)
	}, [enabled, selectedProjectId])
	const openPreviewDetail = useCallback(
		(detail: unknown) => {
			if (!detail || typeof detail !== "object") return
			previewDetailPopupRef.current?.open(detail as PreviewDetail, fileTree, fileList)
		},
		[fileList, fileTree],
	)
	const handleSelectDetail = useCallback(
		(detail: unknown) => {
			if (getToolDetailSelectionTarget(detail) === "file") return
			openPreviewDetail(detail)
		},
		[openPreviewDetail],
	)
	const handleOpenFile = useCallback(
		(file?: unknown) => {
			const result = resolveRuntimeFileOpen(file)
			if (result.kind === "file-manager") {
				setFileManagerContext(result.context)
				return
			}
			if (result.kind === "preview") openPreviewDetail(result.detail)
		},
		[openPreviewDetail],
	)

	useEffect(() => {
		if (!enabled) return
		const handleOpenFileTab = (data: {
			fileId?: string
			fileData?: Record<string, unknown>
		}) => {
			const detail = buildRuntimeFilePreviewDetail(data)
			if (detail) openPreviewDetail(detail)
		}
		const handleOpenFileTabByPath = (data: {
			filePath?: string
			fileName?: string
			action?: "open" | "download"
		}) => {
			if (data.action === "download" || !data.filePath) return
			const targetPath = data.filePath.replace(/^\//, "")
			const matched = fileList.find(
				(item) => (item.relative_file_path || "").replace(/^\//, "") === targetPath,
			)
			if (matched) handleOpenFile(matched)
		}
		pubsub.subscribe(PubSubEvents.Open_File_Tab, handleOpenFileTab)
		pubsub.subscribe(PubSubEvents.Open_File_Tab_By_Path, handleOpenFileTabByPath)
		pubsub.subscribe(PubSubEvents.Open_Playback_Tab, openPreviewDetail)
		return () => {
			pubsub.unsubscribe(PubSubEvents.Open_File_Tab, handleOpenFileTab)
			pubsub.unsubscribe(PubSubEvents.Open_File_Tab_By_Path, handleOpenFileTabByPath)
			pubsub.unsubscribe(PubSubEvents.Open_Playback_Tab, openPreviewDetail)
		}
	}, [enabled, fileList, handleOpenFile, openPreviewDetail])

	const previewPopup = enabled ? (
		<PreviewDetailPopup
			ref={previewDetailPopupRef}
			setUserSelectDetail={openPreviewDetail}
			selectedProject={selectedProject}
			selectedTopic={selectedTopic}
			allowEdit={canEdit}
		/>
	) : null
	const fileManagerPopup =
		enabled && fileManagerContext ? (
			<PublishedMicroAppFileManagerPopup
				context={fileManagerContext}
				attachments={fileTree}
				attachmentLoadState={attachmentLoadState}
				selectedProject={selectedProject}
				selectedTopic={selectedTopic}
				onOpenFile={handleOpenFile}
				onClose={() => setFileManagerContext(null)}
			/>
		) : null

	return {
		handleSelectDetail,
		handleOpenFile,
		openPreviewDetail,
		previewPopup,
		fileManagerPopup,
	}
}

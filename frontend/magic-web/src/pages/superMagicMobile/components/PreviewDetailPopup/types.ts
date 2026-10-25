import type { DetailData } from "@/pages/superMagic/components/Detail/types"
import type { AttachmentItem } from "@/pages/superMagic/components/TopicFilesButton/hooks/types"
import type { ProjectListItem, Topic } from "@/pages/superMagic/pages/Workspace/types"

export interface PreviewDetail<T extends keyof DetailData = keyof DetailData> {
	type: T
	data: DetailData[T]
	currentFileId: string
	isFromNode?: boolean
	topicId?: string
	name?: string
}

export interface PreviewDetailPopupRef {
	open: (
		options: PreviewDetail,
		attachmentTree: AttachmentItem[],
		attachmentList: AttachmentItem[],
	) => void
	/** Refreshes the file context without closing or reopening the current preview. */
	updateAttachments: (attachmentTree: AttachmentItem[], attachmentList: AttachmentItem[]) => void
}

export interface PreviewDetailPopupProps {
	setUserSelectDetail: (detail: PreviewDetail | null) => void
	onClose?: () => void
	selectedTopic?: Topic | null
	isFileShare?: boolean
	enableImmersiveShareChrome?: boolean
	isImmersiveFullscreen?: boolean
	selectedProject?: ProjectListItem | null
	onOpenNewPopup?: (
		detail: PreviewDetail,
		attachmentTree: AttachmentItem[],
		attachmentList: AttachmentItem[],
	) => void
	projectId?: string
	allowDownload?: boolean
	hideHeader?: boolean
	showFileHeader?: boolean
	forceFullscreenMode?: boolean
	/** Allows pure-share preview content to expand into the browser page. */
	documentFlowFullscreen?: boolean
	allowEdit?: boolean
	onPreviewFileChange?: (fileId: string | null) => void
	onPreviewFullscreenChange?: (isFullscreen: boolean) => void
	/** Raise above another open dialog, such as the file manager or conversation sheet. */
	zIndex?: number
	/**
	 * Renders the preview in place (filling its parent) instead of a bottom sheet, e.g. the AI
	 * canvas tab of the H5 project page. It owns no overlay layer and has no close action.
	 */
	inline?: boolean
}

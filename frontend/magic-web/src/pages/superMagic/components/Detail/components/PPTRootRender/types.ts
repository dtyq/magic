import type { DetailHTMLData } from "../../types"
import type { ProjectListItem, Topic } from "@/pages/superMagic/pages/Workspace/types"

export interface PPTRootRenderProps {
	data: DetailHTMLData
	attachments?: any[]
	type?: string
	currentIndex?: number
	onPrevious?: () => void
	onNext?: () => void
	onFullscreen?: () => void
	onDownload?: (fileId?: string, fileVersion?: number) => void
	totalFiles?: number
	hasUserSelectDetail?: boolean
	setUserSelectDetail?: (detail: any) => void
	isFromNode?: boolean
	onClose?: () => void
	isFullscreen?: boolean
	attachmentList?: any[]
	allowEdit?: boolean
	saveEditContent?: (
		data: any,
		fileId?: string,
		enable_shadow?: boolean,
		fetchFileVersions?: (fileId: string) => void,
		isPPTEditMode?: boolean,
	) => Promise<void>
	className?: string
	metadata?: any
	openFileTab?: (fileItem: any, autoEdit?: boolean) => void
	selectedProject?: ProjectListItem | null
	selectedTopic?: Topic | null
	activeFileId?: string | null
	isPlaybackMode?: boolean
	exportFile?: (fileId: string, fileVersion?: number) => void
	exportPdf?: (fileId: string) => void
	exportPpt?: (fileId: string) => void
	onActiveFileChange?: (fileId: string | null) => void
	isTabActive?: boolean
	allowDownload?: boolean
	projectId?: string
}

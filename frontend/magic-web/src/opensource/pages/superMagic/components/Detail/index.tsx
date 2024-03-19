import { memo, useRef, useImperativeHandle, forwardRef } from "react"
import FilesViewer, { type FilesViewerRef } from "./components/FilesViewer"
import { useDetailActions } from "./hooks/useDetailActions"
import useDetailHandlers from "./hooks/useDetailHandlers"
import { TaskStatus, ProjectListItem, Topic } from "../../pages/Workspace/types"
import useShareRoute from "../../hooks/useShareRoute"
import { useResponsive } from "ahooks"
import { cn } from "@/opensource/lib/utils"

// Define the Detail component props interface
interface DetailProps {
	disPlayDetail: any
	setUserSelectDetail?: (detail: any) => void
	userSelectDetail?: any
	attachments?: any[] // Topic attachments - tree structure
	attachmentList?: any[] // Topic attachments - array list
	// File sharing props
	topicId?: string
	baseShareUrl?: string
	// 新增播放控制相关props
	currentTopicStatus?: TaskStatus
	messages?: any[] // 消息列表，用于提取工具步骤
	// 新增自动详情参数，用于区分用户选择和自动显示
	autoDetail?: any
	// 是否显示播放器
	showPlaybackControl?: boolean
	allowEdit?: boolean
	selectedTopic?: Topic | null
	selectedProject?: ProjectListItem | null
	isFileShare?: boolean
	// Active file change callback
	activeFileId?: string | null
	onActiveFileChange?: (fileId: string | null) => void
	// Active tab type change callback
	onActiveTabChange?: (tabType: "playback" | "file" | null) => void
	// Fullscreen change callback
	onFullscreenChange?: (isFullscreen: boolean) => void
	// Topic name for share scenario
	topicName?: string
	projectId?: string
	// 是否允许下载（用于分享页面权限控制）
	allowDownload?: boolean
	// 是否显示空内容
	showFallbackWhenEmpty?: boolean
}

// Forward ref type for Detail component
export interface DetailRef {
	scrollToFile: (fileId: string) => void // 保留用于向后兼容
	openFileTab: (fileItem?: any) => void
	closeFileTab: (fileId: string) => void
	switchToTab: (fileId: string) => void
	openPlaybackTab: (options?: { toolData?: any; forceActivate?: boolean }) => void
	closePlaybackTab: () => void
}

const Detail = forwardRef<DetailRef, DetailProps>((props, ref) => {
	const {
		disPlayDetail,
		setUserSelectDetail,
		userSelectDetail,
		attachments,
		attachmentList,
		topicId,
		baseShareUrl,
		currentTopicStatus,
		messages = [],
		autoDetail,
		showPlaybackControl = true,
		allowEdit,
		selectedTopic,
		selectedProject,
		isFileShare,
		activeFileId,
		onActiveFileChange,
		onActiveTabChange,
		onFullscreenChange,
		topicName,
		projectId,
		allowDownload,
		showFallbackWhenEmpty,
	} = props

	const filesViewerRef = useRef<FilesViewerRef>(null)

	const { isShareRoute } = useShareRoute()
	const responsive = useResponsive()
	const isMobile = responsive.md === false

	// Use hooks to encapsulate operation logic - only keep what FilesViewer needs
	const { handleDownload, handleViewModeChange, getFileViewMode } = useDetailActions({
		disPlayDetail,
		setUserSelectDetail,
		attachments,
		filesViewerRef,
	})

	// 使用处理函数hook
	const { openNewTab } = useDetailHandlers({
		setUserSelectDetail,
		isMobile,
		filesViewerRef,
	})

	// Expose methods
	useImperativeHandle(ref, () => ({
		scrollToFile: (fileItem: any) => {
			// For backward compatibility, delegate to openFileTab
			if (filesViewerRef.current) {
				filesViewerRef.current.openFileTab(fileItem)
			}
		},
		openFileTab: (fileItem: any, autoEdit?: boolean) => {
			if (filesViewerRef.current) {
				filesViewerRef.current.openFileTab(fileItem, autoEdit)
			}
		},
		closeFileTab: (fileId: string) => {
			if (filesViewerRef.current) {
				filesViewerRef.current.closeFileTab(fileId)
			}
		},
		switchToTab: (fileId: string) => {
			if (filesViewerRef.current) {
				filesViewerRef.current.switchToTab(fileId)
			}
		},
		openPlaybackTab: (options?: { toolData?: any; forceActivate?: boolean }) => {
			if (filesViewerRef.current) {
				filesViewerRef.current.openPlaybackTab(options)
			}
		},
		closePlaybackTab: () => {
			if (filesViewerRef.current) {
				filesViewerRef.current.closePlaybackTab()
			}
		},
	}))

	// Return unified files mode with playback tab
	return (
		<div className={cn("relative flex h-full flex-col overflow-hidden rounded-lg border")}>
			<FilesViewer
				ref={filesViewerRef}
				attachments={attachments}
				attachmentList={attachmentList}
				setUserSelectDetail={setUserSelectDetail}
				userSelectDetail={userSelectDetail}
				onDownload={handleDownload}
				handleViewModeChange={handleViewModeChange}
				getFileViewMode={getFileViewMode}
				topicId={topicId}
				baseShareUrl={baseShareUrl}
				allowEdit={allowEdit}
				selectedTopic={selectedTopic}
				selectedProject={selectedProject}
				onActiveFileChange={onActiveFileChange}
				onFullscreenChange={onFullscreenChange}
				openFileTab={openNewTab}
				activeFileId={activeFileId}
				showFileFooter={!isShareRoute && isMobile}
				currentTopicStatus={currentTopicStatus}
				messages={messages}
				autoDetail={autoDetail}
				showPlaybackControl={showPlaybackControl}
				isFileShare={isFileShare}
				onActiveTabChange={onActiveTabChange}
				topicName={topicName}
				projectId={projectId}
				allowDownload={allowDownload}
				showFallbackWhenEmpty={showFallbackWhenEmpty}
			/>
		</div>
	)
})

export default memo(Detail)

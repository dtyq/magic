import type { FileHelpContext } from "@/pages/superMagic/components/TopicFilesButton/utils/magic-system-folder"
import type { AttachmentLoadState } from "@/stores/projectFiles/types"
import { memo, useRef, useImperativeHandle, forwardRef, type ReactNode } from "react"
import FilesViewer, { type FilesViewerRef } from "./components/FilesViewer"
import type { ActiveDetailTabType, FileSidebarControl } from "./components/FilesViewer/types"
import { useDetailActions } from "./hooks/useDetailActions"
import useDetailHandlers from "./hooks/useDetailHandlers"
import { TaskStatus, ProjectListItem, Topic } from "../../pages/Workspace/types"
import useShareRoute from "../../hooks/useShareRoute"
import { cn } from "@/utils/cn"
import { observer } from "mobx-react-lite"
import { useIsMobile } from "@/hooks/useIsMobile"
import type { MagicWidget } from "@magic-web/widget-sdk"
import type { ProjectFilesStore } from "@/stores/projectFiles"

// Define the Detail component props interface
interface DetailProps {
	fileHelpContext?: FileHelpContext
	projectFilesStore?: ProjectFilesStore
	attachmentLoadState?: AttachmentLoadState
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
	onActiveTabChange?: (tabType: ActiveDetailTabType) => void
	// Fullscreen change callback
	onFullscreenChange?: (isFullscreen: boolean) => void
	/** Selects split, fullscreen, or switchable preview presentation. */
	previewMode?: MagicWidget.PreviewMode
	/** Changes whenever the parent starts a new preview session after dismissing the previous one. */
	previewSessionKey?: number
	/** Hides the preview surface while preserving cached tabs and renderer state. */
	onPreviewDismiss?: () => void
	onPreviewCollapse?: () => void
	onPreviewOpen?: () => void
	isPreviewCollapsed?: boolean
	fileSidebarControl?: FileSidebarControl
	canLocateFile?: boolean
	/** Controls whether project-level preview tabs survive a page remount. */
	persistFileTabs?: boolean
	// Topic name for share scenario
	topicName?: string
	projectId?: string
	// 是否允许下载（用于分享页面权限控制）
	allowDownload?: boolean
	// 是否显示空内容
	showFallbackWhenEmpty?: boolean
	/** 当前项目文件 tabs 缓存一轮加载结束 */
	onFileTabsCacheLoaded?: (projectId: string) => void
	/** File ids whose tabs must remain open in the viewer. */
	nonClosableFileIds?: string[]
	/** When false, hides file preview toolbar (CommonHeaderV2) */
	showFileHeader?: boolean
	/** When true, hides FilesViewer tab bar for immersive read-only preview */
	hideTabBar?: boolean
	/** Frame (radius, outline) of the floating preview layer; see FilesViewer `previewSurfaceFrame`. */
	previewSurfaceFrame?: { radius: string; outlineColor?: string; className?: string }
	/** Host UI floated over the preview's top-left corner; see FilesViewer `previewSurfaceOverlay`. */
	previewSurfaceOverlay?: ReactNode
	/** When true, treats the file viewer as fullscreen without requiring URL params */
	forceFullscreenMode?: boolean
	/** Keeps pure share fullscreen content in document flow for whole-page screenshots. */
	documentFlowFullscreen?: boolean
	/** 详情页全屏时允许 fixed 预览层脱离 Safari 的祖先裁剪边界 */
	isFullscreen?: boolean
	/** Overrides default footer visibility (mobile non-share shows footer by default) */
	showFileFooter?: boolean
	/** Class name for the detail container */
	className?: string
	/**
	 * Claims a file opened from inside a preview (e.g. a link in an HTML report) before a tab is
	 * created. Return true when the host handled it; the default opens a tab.
	 */
	interceptFileOpen?: (file: any) => boolean
}

// Forward ref type for Detail component
export interface DetailRef {
	scrollToFile: (fileId: string) => void // 保留用于向后兼容
	openFileTab: (fileItem?: any) => void
	closeFileTab: (fileId: string) => void
	switchToTab: (fileId: string) => void
	openPlaybackTab: (options?: { toolData?: any; forceActivate?: boolean }) => void
	closePlaybackTab: () => void
	openKnowledgeBaseTab: (data: {
		knowledgeBaseId: string
		documentCode?: string
		fileKey?: string
		title: string
		knowledgeBaseName?: string
		fileExtension?: string
	}) => void
	openMicroAppTab: (data: { appId: string; appName?: string }) => void
	/** Promotes the active preview without reopening its tab. */
	enterPreviewFullscreen: () => void
	/** Restores the active preview without dismissing its cached content. */
	exitPreviewFullscreen: () => void
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
		previewMode,
		previewSessionKey,
		onPreviewDismiss,
		onPreviewCollapse,
		onPreviewOpen,
		isPreviewCollapsed,
		fileSidebarControl,
		canLocateFile,
		persistFileTabs,
		topicName,
		projectId,
		allowDownload,
		showFallbackWhenEmpty,
		onFileTabsCacheLoaded,
		nonClosableFileIds,
		showFileHeader,
		hideTabBar,
		previewSurfaceFrame,
		previewSurfaceOverlay,
		forceFullscreenMode,
		documentFlowFullscreen,
		isFullscreen = false,
		showFileFooter: showFileFooterProp,
		className,
	} = props

	const filesViewerRef = useRef<FilesViewerRef>(null)

	const { isShareRoute } = useShareRoute()
	const isMobile = useIsMobile()
	const effectiveAllowDownload = allowDownload !== false

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
		openKnowledgeBaseTab: (data) => {
			if (filesViewerRef.current) {
				filesViewerRef.current.openKnowledgeBaseTab(data)
			}
		},
		openMicroAppTab: (data) => {
			if (filesViewerRef.current) {
				filesViewerRef.current.openMicroAppTab(data)
			}
		},
		enterPreviewFullscreen: () => {
			filesViewerRef.current?.enterPreviewFullscreen()
		},
		exitPreviewFullscreen: () => {
			filesViewerRef.current?.exitPreviewFullscreen()
		},
	}))

	// Return unified files mode with playback tab
	return (
		<div
			className={cn(
				documentFlowFullscreen
					? "relative flex min-h-dvh flex-col overflow-visible"
					: "relative flex h-full flex-col rounded-lg",
				isFullscreen || documentFlowFullscreen ? "overflow-visible" : "overflow-hidden",
				className,
			)}
		>
			<FilesViewer
				projectFilesStore={props.projectFilesStore}
				fileHelpContext={props.fileHelpContext}
				attachmentLoadState={props.attachmentLoadState}
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
				previewMode={previewMode}
				previewSessionKey={previewSessionKey}
				onPreviewDismiss={onPreviewDismiss}
				onPreviewCollapse={onPreviewCollapse}
				onPreviewOpen={onPreviewOpen}
				isPreviewCollapsed={isPreviewCollapsed}
				fileSidebarControl={fileSidebarControl}
				canLocateFile={canLocateFile}
				persistFileTabs={persistFileTabs}
				openFileTab={openNewTab}
				interceptFileOpen={props.interceptFileOpen}
				activeFileId={activeFileId}
				showFileFooter={showFileFooterProp ?? (!isShareRoute && isMobile)}
				showFileHeader={showFileHeader}
				hideTabBar={hideTabBar}
				previewSurfaceFrame={previewSurfaceFrame}
				previewSurfaceOverlay={previewSurfaceOverlay}
				forceFullscreenMode={forceFullscreenMode}
				documentFlowFullscreen={documentFlowFullscreen}
				currentTopicStatus={currentTopicStatus}
				messages={messages}
				autoDetail={autoDetail}
				showPlaybackControl={showPlaybackControl}
				isFileShare={isFileShare}
				onActiveTabChange={onActiveTabChange}
				topicName={topicName}
				projectId={projectId}
				allowDownload={effectiveAllowDownload}
				showFallbackWhenEmpty={showFallbackWhenEmpty}
				onFileTabsCacheLoaded={onFileTabsCacheLoaded}
				nonClosableFileIds={nonClosableFileIds}
			/>
		</div>
	)
})

export default observer(Detail)

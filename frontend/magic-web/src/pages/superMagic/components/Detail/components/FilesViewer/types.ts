import type { FileHelpContext } from "@/pages/superMagic/components/TopicFilesButton/utils/magic-system-folder"
import type { ReactNode, CSSProperties, RefObject } from "react"
import type { AttachmentLoadState } from "@/stores/projectFiles/types"
import type {
	FileManagerLocationSnapshot,
	FileManagerSnapshot,
} from "@/models/config/repositories/SuperProjectStateTypes"
import type { MagicWidget } from "@magic-web/widget-sdk"
import type {
	DownloadImageMode,
	ProjectListItem,
	Topic,
	TaskStatus,
} from "@/pages/superMagic/pages/Workspace/types"
import { AttachmentSource } from "../../../TopicFilesButton/hooks/types"
import type { AttachmentItem } from "../../../TopicFilesButton/hooks/types"
import type { FileScope } from "@/apis/modules/fileScope"
import type { FileReference, FileReferenceResult } from "@/apis/modules/superMagic"
import type { HtmlNavigationRequest } from "../../contents/HTML/utils/html-navigation"
import type { ProjectFilesStore } from "@/stores/projectFiles"

// Base interfaces
export interface FileSidebarControl {
	isCollapsed: boolean
	onToggle: () => void
	triggerRef: RefObject<HTMLButtonElement>
}

export interface BaseComponentProps {
	className?: string
	style?: CSSProperties
	children?: ReactNode
}

/** Preview policy declared by the opener and executed by FilesViewer, independent of file source. */
export interface FilePreviewPolicy {
	temporary?: boolean
	/** 允许使用调用方提供的完整文件信息打开，不依赖当前项目附件树。 */
	standalone?: boolean
	/** 是否参与文件编辑状态上报和编辑冲突检测。 */
	editingPresence?: boolean
	/** 是否允许发起文件分享。 */
	allowShare?: boolean
	/** 是否允许查看和切换文件历史版本。 */
	allowVersionHistory?: boolean
	/** 文件编辑保存时使用的文件空间。 */
	fileScope?: FileScope
	persistTab?: boolean
	syncWithAttachments?: boolean
	keepLocalContent?: boolean
	restoreAsActive?: boolean
	readonly?: boolean
	awaitAttachmentSync?: boolean
	awaitAttachmentPath?: string
}

export interface WebsitePreset {
	id: string
	title?: string
	titleKey?: string
	url: string
	description?: string
	descriptionKey?: string
	iconSrc?: string
}

export type UserSpaceView = "files" | "memory"
export type FileManagerContext =
	| {
			spaceType: "user"
			view: UserSpaceView
			directoryId?: string
			projectId?: string
			projectName?: string
			topicId?: string
	  }
	| {
			spaceType: "project"
			projectId: string
			directoryId?: string
			area?: FileManagerLocationSnapshot["area"]
	  }

export interface FileManagerAreaRequest {
	requestId: number
	area: FileManagerLocationSnapshot["area"]
}

export interface FileManagerOpenRequest {
	file_manager: FileManagerContext
}

export interface FileManagerStateChangeOptions {
	/** 滚动只更新最新快照并合并写入，目录与布局操作及时保存。 */
	deferred?: boolean
	userInteraction?: boolean
}
export type FileViewerTabType =
	"file" | "website" | "knowledge_base" | "playback" | "file_manager" | "micro_app"
export type ActiveDetailTabType = FileViewerTabType | null

// File item interface
export interface FileItem {
	recycleBin?: { id: string; identityKey: string; projectId?: string }
	/** 文件引用身份独立于 previewPolicy.fileScope 的编辑策略。 */
	file_reference?: FileReference
	space_type?: FileReference["space_type"]
	file_id: string
	file_name: string
	file_key?: string
	display_filename?: string
	filename?: string
	file_extension?: string
	file_url?: string
	relative_file_path?: string
	url?: string
	is_directory?: boolean
	children?: FileItem[]
	content?: string
	updated_at?: string
	resource_version?: string | null
	version?: string | null
	display_config?: {
		type?: "slide" | "slide-template" | "design" | "dashboard" | "audio" | "video" | string
		name?: string
		description?: string
		previewPolicy?: FilePreviewPolicy
	}
	file_size?: number
	parent_id?: string | number
	source?: AttachmentSource
	project_id?: string
	is_hidden?: boolean
	/** Runtime-only navigation context for HTML previews; never persist this field. */
	htmlNavigation?: HtmlNavigationRequest
}

/** 右键操作只读取目标文件的元数据，不改变当前活动标签。 */
export interface TabFileContext {
	item: AttachmentItem & { file_id: string }
	fileName: string
	canShowInfo: boolean
	canCopyPath: boolean
	canLocate: boolean
}

// Tab item interface
export interface TabItem {
	userIdentityKey?: string | null
	fileManager?: FileManagerContext
	/** 本次显式打开的区域；请求不进入持久化，恢复仍使用浏览快照。 */
	fileManagerAreaRequest?: FileManagerAreaRequest
	fileManagerState?: FileManagerSnapshot
	returnTabId?: string
	id: string
	type?: FileViewerTabType
	name?: string // 组件中使用，但未在接口中定义，先补充，待确认是否删除
	title: string
	fileData: FileItem
	active: boolean
	closeable: boolean
	/**
	 * 原始的相对路径，用于计算
	 */
	filePath?: string
	/**
	 * 计算出来的相对路径，用于显示
	 */
	calvedRelativePath?: string
	/**
	 * 标记文件是否已被删除
	 */
	isDeleted?: boolean
	/**
	 * Cached tab has no matching file while the first attachment pass is still loading.
	 */
	isLoading?: boolean
	/**
	 * 用于强制重新挂载 Render 组件的刷新键
	 */
	refreshKey?: string
	/**
	 * 文件的元数据
	 */
	display_config?: any
	/**
	 * Tab 创建时间戳（毫秒）
	 */
	create_at?: number
	/**
	 * Tab 最后激活时间戳（毫秒）
	 */
	active_at?: number
}

// Playback tab item interface - 演示模式tab
export interface PlaybackTabItem extends TabItem {
	type: "playback"
	topicId: string
	topicName: string
	isPlaybackTab: true
	toolData?: any
}

// FilesViewer component props
export interface FilesViewerProps extends BaseComponentProps {
	fileHelpContext?: FileHelpContext
	projectFilesStore?: ProjectFilesStore
	attachmentLoadState?: AttachmentLoadState
	attachments?: FileItem[]
	attachmentList?: FileItem[]
	setUserSelectDetail?: (detail: any) => void
	userSelectDetail?: any
	onDownload?: (fileId?: string, fileVersion?: number, mode?: DownloadImageMode) => void

	// File sharing props
	topicId?: string
	baseShareUrl?: string

	// ViewMode related props
	handleViewModeChange?: (fileId: string, mode: "code" | "desktop" | "phone") => void
	getFileViewMode?: (fileId: string) => "code" | "desktop" | "phone"

	// Active file change callback
	onActiveFileChange?: (fileId: string | null) => void

	// Fullscreen change callback
	onFullscreenChange?: (isFullscreen: boolean) => void
	/** Selects the stable desktop presentation strategy for Widget previews. */
	previewMode?: MagicWidget.PreviewMode
	/** Changes whenever the parent starts a new preview session after dismissing the previous one. */
	previewSessionKey?: number
	/** Hides the preview surface while preserving its cached tabs and content. */
	onPreviewDismiss?: () => void
	/** 用户收起仅隐藏预览，保留标签及内容实例。 */
	onPreviewCollapse?: () => void
	/** 明确打开预览时恢复显示，附件同步和缓存恢复不触发。 */
	onPreviewOpen?: () => void
	isPreviewCollapsed?: boolean
	fileSidebarControl?: FileSidebarControl
	/** 宿主文件树能够承接项目文件定位时才提供入口。 */
	canLocateFile?: boolean
	/** Controls whether project-level preview tabs are restored and persisted across mounts. */
	persistFileTabs?: boolean
	onTabsEmpty?: () => void

	// Render component props
	allowEdit?: boolean
	selectedTopic?: Topic | null
	selectedProject?: ProjectListItem | null
	openFileTab?: (fileItem: any, autoEdit?: boolean) => void
	activeFileId?: string | null
	showFileFooter?: boolean
	/** When true, treats the file viewer as fullscreen without requiring URL params */
	forceFullscreenMode?: boolean
	/** Lets a pure share fill the viewport while expanding with document content. */
	documentFlowFullscreen?: boolean
	/** When false, hides CommonHeaderV2 inside file preview (URL param still works as fallback) */
	showFileHeader?: boolean
	/** Claims a file before a tab opens (links inside previews); return true when handled. */
	interceptFileOpen?: (file: any) => boolean
	/** When true, hides the file tab bar for single-file immersive read-only views */
	hideTabBar?: boolean
	/**
	 * Frame of the floating layer that keeps cached previews (e.g. the canvas) mounted. The layer
	 * lives in a body portal positioned over the panel, so the panel's own rounded clip and outline
	 * cannot reach it; hosts that frame their panel pass the same radius and outline color here so
	 * the layer draws the frame itself. Defaults to a square, unframed layer.
	 */
	previewSurfaceFrame?: { radius: string; outlineColor?: string; className?: string }
	/** Host UI floated over the preview's top-left corner; hidden in fullscreen. */
	previewSurfaceOverlay?: ReactNode

	// Playback tab related props
	currentTopicStatus?: TaskStatus
	messages?: any[]
	autoDetail?: any
	showPlaybackControl?: boolean
	isFileShare?: boolean
	onActiveTabChange?: (tabType: ActiveDetailTabType) => void
	topicName?: string // 话题名称（用于分享场景）
	projectId?: string
	// 是否允许下载（用于分享页面权限控制）
	allowDownload?: boolean

	// 是否显示空内容
	showFallbackWhenEmpty?: boolean

	/** 当前项目 tabs 缓存已加载完成时的回调用 */
	onFileTabsCacheLoaded?: (projectId: string) => void

	/** File ids whose tabs cannot be removed by any close action. */
	nonClosableFileIds?: string[]
}

// FilesViewer ref interface
export interface FilesViewerRef {
	openFileTab: (fileItem: any, autoEdit?: boolean, activate?: boolean) => void
	closeFileTab: (fileId: string) => void
	switchToTab: (fileId: string) => void
	clearAllTabs: () => void
	closeOtherTabs: (tabId: string) => void
	closeTabsToRight: (tabId: string) => void
	isFullscreen: boolean
	// 缓存相关方法
	getCacheStats: () => { size: number; maxSize: number; keys: string[] }
	clearCache: () => void
	handleRefresh: () => void
	// Playback tab相关方法
	openPlaybackTab: (options?: { toolData?: any; forceActivate?: boolean }) => void
	closePlaybackTab: () => void
	openWebsiteTab: (preset: WebsitePreset) => void
	// Knowledge base tab相关方法
	openKnowledgeBaseTab: (data: {
		knowledgeBaseId: string
		documentCode?: string
		fileKey?: string
		title: string
		knowledgeBaseName?: string
		fileExtension?: string
	}) => void
	closeKnowledgeBaseTab: (tabId: string) => void
	openMicroAppTab: (data: { appId: string; appName?: string }) => void
	closeMicroAppTab: (tabId: string) => void
	/** Promotes the currently active file or playback tab without recreating it. */
	enterPreviewFullscreen: () => void
	/** Restores the current preview to its non-fullscreen layout without dismissing it. */
	exitPreviewFullscreen: () => void
}

// Tab component props
export interface TabComponentProps extends BaseComponentProps {
	tabs: TabItem[]
	activeTabId?: string
	onTabClick: (tabId: string) => void
	onTabClose: (tabId: string) => void
	maxTabs?: number
}

// File content area props
export interface FileContentProps extends BaseComponentProps {
	activeTab?: TabItem
	attachments?: FileItem[]
	attachmentList?: FileItem[]
	setUserSelectDetail?: (detail: any) => void
	userSelectDetail?: any
	onDownload?: (fileId?: string) => void

	// File sharing props
	topicId?: string
	baseShareUrl?: string

	// ViewMode related props
	handleViewModeChange?: (fileId: string, mode: "code" | "desktop" | "phone") => void
	getFileViewMode?: (fileId: string) => "code" | "desktop" | "phone"

	// Render component props
	allowEdit?: boolean
	selectedThreadInfo?: any
}

// FilesViewer state interface
export interface FilesViewerState {
	tabs: TabItem[]
	activeTabId?: string
	maxTabs: number
	loading: boolean
	error?: string
}

// Event handler types
export type TabEventHandler = (tabId: string) => void
export type FileEventHandler = (fileId: string) => void

// Tab action types
export enum TabActionType {
	ADD_TAB = "ADD_TAB",
	REMOVE_TAB = "REMOVE_TAB",
	SWITCH_TAB = "SWITCH_TAB",
	UPDATE_TAB = "UPDATE_TAB",
	CLEAR_TABS = "CLEAR_TABS",
	CLOSE_OTHER_TABS = "CLOSE_OTHER_TABS",
	CLOSE_TABS_TO_RIGHT = "CLOSE_TABS_TO_RIGHT",
	SYNC_TABS_DATA = "SYNC_TABS_DATA",
	REORDER_TABS = "REORDER_TABS",
	DEACTIVATE_ALL = "DEACTIVATE_ALL",
	SYNC_USER_FILE_REFERENCES = "SYNC_USER_FILE_REFERENCES",
	RESTORE_USER_FILE_TABS = "RESTORE_USER_FILE_TABS",
	RESTORE_PROJECT_TABS = "RESTORE_PROJECT_TABS",
}

// Tab reducer action interface
export interface TabAction {
	type: TabActionType
	payload?: {
		tab?: TabItem
		userFileResults?: Record<string, FileReferenceResult>
		userIdentityKey?: string
		userTabPositions?: Record<string, number>
		tabOrder?: string[]
		restoreActive?: boolean
		userInteraction?: boolean
		restoredActiveTabId?: string
		tabId?: string
		tabs?: TabItem[]
		allFiles?: FileItem[]
		fromIndex?: number
		toIndex?: number
		[key: string]: any
	}
}

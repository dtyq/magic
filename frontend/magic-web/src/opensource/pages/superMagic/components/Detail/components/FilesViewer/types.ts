import type { ReactNode, CSSProperties } from "react"
import type {
	DownloadImageMode,
	ProjectListItem,
	Topic,
	TaskStatus,
} from "@/opensource/pages/superMagic/pages/Workspace/types"
import { AttachmentSource } from "../../../TopicFilesButton/hooks/types"

// Base interfaces
export interface BaseComponentProps {
	className?: string
	style?: CSSProperties
	children?: ReactNode
}

// File item interface
export interface FileItem {
	file_id: string
	file_name: string
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
	metadata?: {
		type?: "slide" | "design" | "dashboard" | "audio" | "video" | string
		name?: string
	}
	file_size?: number
	parent_id?: string | number
	source?: AttachmentSource
	project_id?: string
}

// Tab item interface
export interface TabItem {
	id: string
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
	 * 用于强制重新挂载 Render 组件的刷新键
	 */
	refreshKey?: string
	/**
	 * 文件的元数据
	 */
	metadata?: any
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

	// Render component props
	allowEdit?: boolean
	selectedTopic?: Topic | null
	selectedProject?: ProjectListItem | null
	openFileTab?: (fileItem: any, autoEdit?: boolean) => void
	activeFileId?: string | null
	showFileFooter?: boolean

	// Playback tab related props
	currentTopicStatus?: TaskStatus
	messages?: any[]
	autoDetail?: any
	showPlaybackControl?: boolean
	isFileShare?: boolean
	onActiveTabChange?: (tabType: "playback" | "file" | null) => void
	topicName?: string // 话题名称（用于分享场景）
	projectId?: string
	// 是否允许下载（用于分享页面权限控制）
	allowDownload?: boolean

	// 是否显示空内容
	showFallbackWhenEmpty?: boolean
}

// FilesViewer ref interface
export interface FilesViewerRef {
	openFileTab: (fileItem: any, autoEdit?: boolean) => void
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
}

// Tab reducer action interface
export interface TabAction {
	type: TabActionType
	payload?: {
		tab?: TabItem
		tabId?: string
		tabs?: TabItem[]
		allFiles?: FileItem[]
		fromIndex?: number
		toIndex?: number
		[key: string]: any
	}
}

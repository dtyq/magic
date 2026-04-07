import type { ReactNode, CSSProperties } from "react"
import type { I18nTexts, LocaleInput } from "./i18n/types"
import type { Marker, MarkerType } from "@/components/CanvasDesign/canvas/types"

// Base interfaces
export interface BaseComponentProps {
	className?: string
	style?: CSSProperties
	children?: ReactNode
}

// Panel state enum
export enum PanelState {
	DEFAULT = "default",
	SEARCH = "search",
	FOLDER = "directory",
	MCP = "mcp",
	AGENT = "agent",
	SKILLS = "skills",
	TOOLS = "tools",
	UPLOAD_FILES = "upload_files",
	HISTORIES = "histories",
	TABS = "tabs",
}

// Item types
export enum MentionItemType {
	FOLDER = "project_directory",
	MCP = "mcp",
	AGENT = "agent",
	SKILL = "skill",
	TOOL = "tool",
	PROJECT_FILE = "project_file",
	UPLOAD_FILE = "upload_file",
	CLOUD_FILE = "cloud_file",
	DESIGN_MARKER = "design_marker",

	// internal item types
	TITLE = "title",
	DIVIDER = "divider",
	TABS = "tabs",
	HISTORIES = "histories",
}

// Built-in item IDs
export enum BuiltinItemId {
	PERSONAL_DRIVE = "personal-drive",
	ENTERPRISE_DRIVE = "enterprise-drive",
	ORGANIZATION_DRIVE = "organization-drive",
	PROJECT_FILES = "project-files",
	MCP_EXTENSIONS = "mcp-extensions",
	AGENTS = "agents",
	SKILLS = "skills",
	TOOLS = "tools",
	UPLOAD_FILES = "upload-files",
	HISTORIES = "histories",
	TABS = "tabs",
}

// Mention data types based on 超级麦吉对接方案
export interface McpMentionData {
	id: string
	name: string
	icon: string
	description?: string
	require_fields: { field_name: string; field_value?: string }[]
	check_require_fields?: boolean // 是否需要校验必填字段
	check_auth?: boolean // 是否需要校验权限
}

export interface SkillMentionData {
	id: string
	name: string
	icon: string
	description: string
	mention_source?: SkillMentionSource
}

export type SkillMentionSource = "system" | "agent" | "mine"

export interface AgentMentionData {
	agent_id: string
	agent_name: string
	agent_avatar: string
	agent_description: string
}

export interface ToolMentionData {
	id: string
	name: string
	icon?: string
	description?: string
}

export interface ProjectFileMentionData {
	file_id: string
	file_name: string
	file_path: string
	file_extension: string
	file_size?: number
}

export interface DirectoryMentionData {
	directory_id: string
	directory_name: string
	directory_path: string
	directory_metadata?: { type: "slide" }
}

export interface UploadFileMentionData {
	file_id: string
	file_name: string
	file_extension: string
	file_path?: string
	file_size?: number
	file?: File
	// 上传状态相关字段
	upload_progress?: number // 上传进度 0-100
	upload_status?: "init" | "uploading" | "done" | "error"
	upload_error?: string
}

export interface CloudFileMentionData {
	file_id?: string
	file_name?: string
	file_path?: string
	file_size?: number
	file_type?: string
	cloud_provider?: "personal" | "enterprise" | "shared"
	created_at?: string
	modified_at?: string
	[key: string]: unknown // 待定字段
}

/** 在消息编辑器里面的数据 */
export interface CanvasMarkerMentionData {
	loading?: boolean // 加载状态
	project_id?: string // 项目 ID
	topic_id?: string // 话题 ID
	design_project_id?: string // 设计项目 ID
	mark_number?: number // 标记编号
	image_path?: string // 图片路径
	element_width?: number // 元素的实际宽度
	element_height?: number // 元素的实际高度
	data: Marker // 标记数据
}

/** 在消息列表里面的数据 */
export interface TransformedCanvasMarkerMentionData {
	image: string
	label: string
	kind: "object" | "part" | "custom"
	bbox?: {
		x: number
		y: number
		width: number
		height: number
	}
	mark_type?: MarkerType
	area?: [number, number, number, number]
	mark?: [number, number]
	mark_number?: number
}

// Union type for all mention data types
export type MentionData =
	| McpMentionData
	| AgentMentionData
	| SkillMentionData
	| ProjectFileMentionData
	| UploadFileMentionData
	| CloudFileMentionData
	| DirectoryMentionData
	| CanvasMarkerMentionData

// Generic mention result format
export interface MentionResult<T extends string = string> {
	type: T
	data: T extends "mcp"
		? McpMentionData
		: T extends "agent"
			? AgentMentionData
			: T extends "skill"
				? SkillMentionData
				: T extends "project_file"
					? ProjectFileMentionData
					: T extends "upload_file"
						? UploadFileMentionData
						: T extends "cloud_file"
							? CloudFileMentionData
							: MentionData
}

// Navigation item interface
export interface NavigationItem {
	id: string
	name: string
	state: PanelState
	parentId?: string // 用于文件夹导航时记录父级文件夹ID
}

// Enhanced mention item interface with support for structured data
export interface MentionItem {
	id: string
	type: MentionItemType
	name: string
	icon?: string | ReactNode
	/**
	 * 是否不可选择，对于标题和分割线，默认不可选择
	 */
	unSelectable?: boolean
	description?: string
	children?: MentionItem[]
	metadata?: Record<string, unknown>
	hasChildren?: boolean
	isSelected?: boolean

	// New structured data field for mention results
	data?: MentionData

	// Additional UI properties
	path?: string // For file/directory paths
	size?: number // For file sizes
	createdAt?: string // Creation date
	modifiedAt?: string // Last modified date
	parentId?: string // Parent directory ID

	// File-specific properties
	extension?: string // File extension
	mimeType?: string // MIME type
	isFolder?: boolean // Whether this is a directory

	// MCP/Agent specific properties
	version?: string // MCP/Agent version
	status?: "active" | "inactive" | "error" // Status
	provider?: string // Provider name

	// History tracking properties
	tags?: string[] // Tags for categorization (e.g., "history", "recent")
}

// Type-safe mention item interfaces for different types
export interface McpMentionItem extends MentionItem {
	type: MentionItemType.MCP
	data: McpMentionData
}

export interface AgentMentionItem extends MentionItem {
	type: MentionItemType.AGENT
	data: AgentMentionData
}

export interface SkillMentionItem extends MentionItem {
	type: MentionItemType.SKILL
	data: SkillMentionData
}

export interface ProjectFileMentionItem extends MentionItem {
	type: MentionItemType.PROJECT_FILE
	data: ProjectFileMentionData
}

export interface UploadFileMentionItem extends MentionItem {
	type: MentionItemType.UPLOAD_FILE
	data: UploadFileMentionData
}

export interface CloudFileMentionItem extends MentionItem {
	type: MentionItemType.CLOUD_FILE
	data: CloudFileMentionData
}

export interface DirectoryMentionItem extends MentionItem {
	type: MentionItemType.FOLDER
	data: DirectoryMentionData
}

// Panel state interface
export interface MentionPanelState {
	currentState: PanelState
	selectedIndex: number
	searchQuery: string
	navigationStack: NavigationItem[]
	items: MentionItem[]
	originalItems: MentionItem[] // Store the complete dataset for current panel (for context-aware search)
	loading: boolean
	error?: string
}

// Hook return interface
export interface UseMentionPanelReturn {
	state: MentionPanelState
	actions: {
		selectItem: (index: number) => void
		confirmSelection: (options?: { enterFolder?: boolean }) => void
		navigateBack: () => void
		navigateToBreadcrumb: (index: number) => void
		enterFolder: () => void
		search: (query: string) => void
		exit: () => void
		reset: () => void
		deleteHistoryItem: (item: MentionItem) => Promise<void>
	}
	computed: {
		canNavigateBack: boolean
		canEnterFolder: boolean
		hasSelection: boolean
	}
	dataSource: {
		items: MentionItem[]
		loading: boolean
		error?: string
		loadDefaultItems: () => Promise<void>
		searchItems: (query: string) => Promise<void>
		loadFolderItems: (directoryId: string) => Promise<void>
		loadMcpExtensions: () => Promise<void>
		loadAgents: () => Promise<void>
		loadSkills: () => Promise<void>
		clearError: () => void
		refreshData: () => Promise<void>
	}
	focus: {
		shouldFocusSearch: boolean
		clearFocusTrigger: () => void
	}
}

// Component ref interface
export interface MentionPanelRef {
	open: () => void
	close: () => void
	search: (query: string) => void
	reset: () => void
	isVisible: () => boolean
	getCurrentState: () => PanelState
}

// Component props interfaces
export interface MentionPanelProps extends BaseComponentProps {
	visible?: boolean
	onSelect?: (item: MentionItem, context?: { reset?: () => void }) => void
	onClose?: () => void
	initialState?: PanelState
	searchPlaceholder?: string
	triggerRef?: React.RefObject<HTMLElement>
	language?: LocaleInput
	disableKeyboardShortcuts?: boolean
	lastHistoryIndex?: number
	/**
	 * Data service for the mention panel
	 */
	dataService?: DataService
}

export interface MenuListProps extends BaseComponentProps {
	items: MentionItem[]
	selectedIndex: number
	onSelect: (index: number) => void
	loading?: boolean
}

export interface MenuItemProps extends BaseComponentProps {
	item: MentionItem
	selected?: boolean
	onClick?: (event?: React.MouseEvent) => void
	onDelete?: (item: MentionItem) => void
	isSearch?: boolean
	t: I18nTexts
}

export interface PanelHeaderProps extends BaseComponentProps {
	state: PanelState
	navigationStack: NavigationItem[]
	searchQuery: string
	onSearch?: (query: string) => void
	searchPlaceholder?: string
}

export interface KeyboardHintsProps extends BaseComponentProps {
	state: PanelState
	hasSelection?: boolean
	canNavigateBack?: boolean
	canEnterFolder?: boolean
}

export interface PanelContainerProps extends BaseComponentProps {
	visible?: boolean
	maxHeight?: number
	width?: number
}

// Data service interfaces
export interface DataService {
	fetchMcpList: () => void
	setRefreshHandler?: (handler: (() => void) | undefined) => void
	getDefaultItems: (t: I18nTexts) => Promise<MentionItem[]> | MentionItem[]
	searchItems: (query: string) => Promise<MentionItem[]> | MentionItem[]
	getFolderItems: (directoryId: string) => Promise<MentionItem[]> | MentionItem[]
	getUploadFiles: () => Promise<MentionItem[]> | MentionItem[]
	getMcpExtensions: () => Promise<MentionItem[]> | MentionItem[]
	getAgents: () => Promise<MentionItem[]> | MentionItem[]
	getSkills: () => Promise<MentionItem[]> | MentionItem[]
	refreshSkills?: () => Promise<MentionItem[]> | MentionItem[]
	getToolItems: (collectionId: string) => Promise<MentionItem[]> | MentionItem[]
	preLoadList: () => void
	getAllHistory: () => Promise<MentionItem[]> | MentionItem[]
	getCurrentTabs: () => Promise<MentionItem[]> | MentionItem[]
	hasAgent: (agentId: string) => boolean
	hasMcp: (mcpId: string) => boolean
	hasSkill: (skillId: string) => boolean
	hasTool: (toolId: string) => boolean
	hasUploadFile: (fileId: string) => boolean
	hasProjectFile: (fileId: string) => boolean
	hasFolder: (directoryId: string) => boolean
	removeFromHistory: (itemId: string) => void
}

// Event handler types
export type SelectHandler = (item: MentionItem) => void
export type NavigationHandler = () => void
export type SearchHandler = (query: string) => void
export type KeyboardEventHandler = (event: KeyboardEvent) => void

// Keyboard action types
export enum KeyboardAction {
	SELECT_PREVIOUS = "selectPrevious",
	SELECT_NEXT = "selectNext",
	CONFIRM = "confirm",
	NAVIGATE_BACK = "navigateBack",
	ENTER_FOLDER = "enterFolder",
	EXIT = "exit",
}

// Constants types
export interface KeyboardMapping {
	[key: string]: KeyboardAction
}

export interface IconMapping {
	[key: string]: string | ReactNode
}

// Animation types
export interface AnimationConfig {
	duration: number
	easing: string
}

// Theme types
export interface MentionPanelTheme {
	colors: {
		background: string
		selectedBackground: string
		text: string
		secondaryText: string
		hintText: string
		border: string
	}
	fonts: {
		primary: string
		secondary: string
	}
	sizes: {
		itemHeight: number
		padding: number
		borderRadius: number
	}
	shadows: {
		panel: string
	}
}

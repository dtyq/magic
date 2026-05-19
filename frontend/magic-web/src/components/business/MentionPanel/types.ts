import type { ReactNode, CSSProperties } from "react"
import type { I18nTexts, LocaleInput } from "./i18n/types"
import type { MarkerType } from "@/components/CanvasDesign/canvas/types"
import type { MentionItemRenderer } from "./renderers/types"
import type { MentionPanelItemType as MentionPanelItemTypeValue } from "./runtime/builtin/panel-item-types"

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
	CATALOG = "catalog",
}

export type MentionPanelStateValue = PanelState

// Core item types
export const MentionCoreItemType = {
	FOLDER: "project_directory",

	// internal item types
	TITLE: "title",
	DIVIDER: "divider",
} as const

export type MentionCoreItemType = (typeof MentionCoreItemType)[keyof typeof MentionCoreItemType]

// Business item types
export const MentionBusinessItemType = {
	MCP: "mcp",
	AGENT: "agent",
	SKILL: "skill",
	TOOL: "tool",
	PROJECT_FILE: "project_file",
	UPLOAD_FILE: "upload_file",
	CLOUD_FILE: "cloud_file",
	DESIGN_MARKER: "design_marker",
} as const

export type MentionBusinessItemType =
	(typeof MentionBusinessItemType)[keyof typeof MentionBusinessItemType]

// Full item types
export const MentionItemType = {
	...MentionCoreItemType,
	...MentionBusinessItemType,
} as const

export type MentionItemType = (typeof MentionItemType)[keyof typeof MentionItemType]

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
	/** Internal: source project for project-file mentions pasted outside their original project. */
	source_project_id?: string
	/** Internal: source file id before copying into the target project. */
	source_file_id?: string
	/** Internal: marks a project-file mention that must be copied before sending. */
	pending_project_copy?: boolean
}

export interface DirectoryMentionData {
	directory_id: string
	directory_name: string
	directory_path: string
	directory_metadata: DirectoryMentionMetadata
	/** Internal: source project for directory mentions pasted outside their original project. */
	source_project_id?: string
	/** Internal: source directory id before copying into the target project. */
	source_directory_id?: string
	/** Internal: marks a directory mention that must be copied before sending. */
	pending_project_copy?: boolean
}

export interface DirectoryMentionMetadata {
	version?: string | number
	type?: string
	name?: string
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

export interface CanvasMarkerMentionSuggestion {
	label: string
	kind: "object" | "part" | "custom"
	bbox?: {
		x: number
		y: number
		width: number
		height: number
	}
}

/** 画布 marker mention 数据：消息体中只保留渲染、定位和恢复所需字段，避免继续持久化完整 Marker 对象 */
export interface CanvasMarkerMentionData {
	image: string
	image_relative?: string
	design_project_id?: string
	label: string
	kind: CanvasMarkerMentionSuggestion["kind"]
	bbox?: CanvasMarkerMentionSuggestion["bbox"]
	mark_type?: MarkerType
	area?: [number, number, number, number]
	mark?: [number, number]
	mark_number?: number
	/** 画布交互定位仍需要 marker/element id，不能只保留 label、bbox 等展示字段 */
	marker_id?: string
	element_id?: string
	loading?: boolean
	project_id?: string
	topic_id?: string
	element_width?: number
	element_height?: number
	suggestions?: CanvasMarkerMentionSuggestion[]
	selected_suggestion_index?: number
	error?: string
}

export interface MentionCoreItemDataMap {
	[MentionCoreItemType.FOLDER]: DirectoryMentionData
}

export interface MentionBusinessItemDataMap {
	[MentionBusinessItemType.MCP]: McpMentionData
	[MentionBusinessItemType.AGENT]: AgentMentionData
	[MentionBusinessItemType.SKILL]: SkillMentionData
	[MentionBusinessItemType.TOOL]: ToolMentionData
	[MentionBusinessItemType.PROJECT_FILE]: ProjectFileMentionData
	[MentionBusinessItemType.UPLOAD_FILE]: UploadFileMentionData
	[MentionBusinessItemType.CLOUD_FILE]: CloudFileMentionData
	[MentionBusinessItemType.DESIGN_MARKER]: CanvasMarkerMentionData
}

export interface MentionItemDataMap extends MentionCoreItemDataMap, MentionBusinessItemDataMap {}

export type MentionCoreDataItemType = keyof MentionCoreItemDataMap
export type MentionBusinessDataItemType = keyof MentionBusinessItemDataMap
export type MentionDataItemType = keyof MentionItemDataMap

// Union type for all mention data types
export type MentionData = MentionItemDataMap[MentionDataItemType]

export type MentionItemDataByType<T extends MentionPanelItemTypeValue> =
	T extends MentionDataItemType ? MentionItemDataMap[T] : never

// Generic mention result format
export interface MentionResult<T extends MentionDataItemType = MentionDataItemType> {
	type: T
	data: MentionItemDataMap[T]
}

export interface MentionPanelLoadStateOptions<TCatalogId extends string = string> {
	catalogId?: TCatalogId
	itemId?: string
	query?: string
	silent?: boolean
}

export interface MentionStoreRequestBuildOptions<TCatalogId extends string = string> {
	state: MentionPanelStateValue
	catalogId?: TCatalogId
	itemId?: string
	query?: string
	/** 与 `SearchRequest.scopeFolderId` 对应：目录内搜索时传入当前文件夹 id */
	scopeFolderId?: string
	t?: I18nTexts
}

export interface StateTransition<TCatalogId extends string = string> {
	state: MentionPanelStateValue
	catalogId?: TCatalogId
}

export interface MentionPanelCatalogBehaviorArgs<TCatalogId extends string = string> {
	currentState: MentionPanelStateValue
	currentCatalogId?: TCatalogId
	selectedItem: MentionItem
	enterFolder: boolean
}

export interface MentionPanelCatalogBehavior<TCatalogId extends string = string> {
	getStaticTransition?: (args: {
		currentState: MentionPanelStateValue
		itemId: string
	}) => StateTransition<TCatalogId> | null
	getDynamicTransition?: (
		args: MentionPanelCatalogBehaviorArgs<TCatalogId>,
	) => StateTransition<TCatalogId> | null
	shouldEnterFolderDirectly?: (args: MentionPanelCatalogBehaviorArgs<TCatalogId>) => boolean
	shouldSelectItemDirectly?: (args: MentionPanelCatalogBehaviorArgs<TCatalogId>) => boolean
}

export interface MentionPanelCatalogHeaderMeta {
	hint: string | null
	icon: string | null
}

export type MentionItemRendererResolver = (type: string) => MentionItemRenderer

export interface MentionPanelRuntime<TCatalogId extends string = string> {
	dataService?: DataService
	catalogBehavior?: MentionPanelCatalogBehavior<TCatalogId>
	buildStoreRequest?: (
		options: MentionStoreRequestBuildOptions<TCatalogId>,
	) => import("./dispatch").MentionStoreRequest | null
	getItemRenderer?: MentionItemRendererResolver
	getCatalogHeaderMeta?: (
		catalogId: TCatalogId | undefined,
		t: I18nTexts,
	) => MentionPanelCatalogHeaderMeta
}

// Navigation item interface
export interface NavigationItem<TCatalogId extends string = string> {
	id: string
	name: string
	state: MentionPanelStateValue
	catalogId?: TCatalogId
	parentId?: string // 用于文件夹导航时记录父级文件夹ID
}

// Enhanced mention item interface with support for structured data
export interface MentionItem<T extends MentionPanelItemTypeValue = MentionPanelItemTypeValue> {
	id: string
	type: T
	name: string
	icon?: string | ReactNode
	/**
	 * 是否不可选择，对于标题和分割线，默认不可选择
	 */
	unSelectable?: boolean
	description?: string
	children?: MentionItem[]
	displayConfig?: Record<string, unknown>
	hasChildren?: boolean
	isSelected?: boolean

	// New structured data field for mention results
	data?: MentionItemDataByType<T>

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

	// Skill specific properties
	package_name?: string // Package name
}

export interface MentionCoreItem<
	T extends MentionCoreItemType = MentionCoreItemType,
> extends MentionItem<T> {}

export interface MentionBusinessItem<
	T extends MentionBusinessItemType = MentionBusinessItemType,
> extends MentionItem<T> {}

// Type-safe mention item interfaces for different types
export interface McpMentionItem extends MentionBusinessItem<typeof MentionBusinessItemType.MCP> {
	type: typeof MentionBusinessItemType.MCP
	data: McpMentionData
}

export interface AgentMentionItem extends MentionBusinessItem<
	typeof MentionBusinessItemType.AGENT
> {
	type: typeof MentionBusinessItemType.AGENT
	data: AgentMentionData
}

export interface SkillMentionItem extends MentionBusinessItem<
	typeof MentionBusinessItemType.SKILL
> {
	type: typeof MentionBusinessItemType.SKILL
	data: SkillMentionData
}

export interface ToolMentionItem extends MentionBusinessItem<typeof MentionBusinessItemType.TOOL> {
	type: typeof MentionBusinessItemType.TOOL
	data: ToolMentionData
}

export interface ProjectFileMentionItem extends MentionBusinessItem<
	typeof MentionBusinessItemType.PROJECT_FILE
> {
	type: typeof MentionBusinessItemType.PROJECT_FILE
	data: ProjectFileMentionData
}

export interface UploadFileMentionItem extends MentionBusinessItem<
	typeof MentionBusinessItemType.UPLOAD_FILE
> {
	type: typeof MentionBusinessItemType.UPLOAD_FILE
	data: UploadFileMentionData
}

export interface CloudFileMentionItem extends MentionBusinessItem<
	typeof MentionBusinessItemType.CLOUD_FILE
> {
	type: typeof MentionBusinessItemType.CLOUD_FILE
	data: CloudFileMentionData
}

export interface DirectoryMentionItem extends MentionCoreItem<typeof MentionCoreItemType.FOLDER> {
	type: typeof MentionCoreItemType.FOLDER
	data: DirectoryMentionData
}

export interface DesignMarkerMentionItem extends MentionBusinessItem<
	typeof MentionBusinessItemType.DESIGN_MARKER
> {
	type: typeof MentionBusinessItemType.DESIGN_MARKER
	data: CanvasMarkerMentionData
}

// Panel state interface
export interface MentionPanelState<TCatalogId extends string = string> {
	currentState: MentionPanelStateValue
	selectedIndex: number
	searchQuery: string
	navigationStack: NavigationItem<TCatalogId>[]
	items: MentionItem[]
	originalItems: MentionItem[] // Store the complete dataset for current panel (for context-aware search)
	loading: boolean
	error?: string
}

// Hook return interface
export interface UseMentionPanelReturn<TCatalogId extends string = string> {
	state: MentionPanelState<TCatalogId>
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
		loadStateItems: (
			state: MentionPanelStateValue,
			options?: MentionPanelLoadStateOptions<TCatalogId>,
		) => Promise<void>
		loadDefaultItems: () => Promise<void>
		searchItems: (query: string) => Promise<void>
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
	getCurrentState: () => MentionPanelStateValue
}

export interface MentionSelectContext {
	reset?: () => void
	mcpValidated?: boolean
	batch?: {
		index: number
		total: number
	}
}

// Component props interfaces
export interface MentionPanelProps<TCatalogId extends string = string> extends BaseComponentProps {
	visible?: boolean
	onSelect?: (item: MentionItem, context?: MentionSelectContext) => void
	onClose?: () => void
	initialState?: MentionPanelStateValue
	initialLoadOptions?: MentionPanelLoadStateOptions<TCatalogId>
	initialNavigationStack?: NavigationItem<TCatalogId>[]
	searchPlaceholder?: string
	triggerRef?: React.RefObject<HTMLElement | null>
	language?: LocaleInput
	disableKeyboardShortcuts?: boolean
	/**
	 * 为 true 时禁止 Radix 因「外部」交互自动关闭（画布内嵌套 Portal 易出现误判）。
	 * 仍可通过 onClose / 键盘退出等显式关闭。
	 */
	lockDismissToExplicitClose?: boolean
	lastHistoryIndex?: number
	runtime?: MentionPanelRuntime<TCatalogId>
	/**
	 * Data service for the mention panel
	 */
	dataService?: DataService
	catalogBehavior?: MentionPanelCatalogBehavior<TCatalogId>
	buildStoreRequest?: (
		options: MentionStoreRequestBuildOptions<TCatalogId>,
	) => import("./dispatch").MentionStoreRequest | null
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
	/** 移动端多选：行首多选框 */
	showCheckbox?: boolean
	checkboxChecked?: boolean
	/** 一级入口行：右侧箭头旁已选数量角标（仅 >0 时展示） */
	rootPendingBadgeCount?: number
}

export interface PanelHeaderProps extends BaseComponentProps {
	state: MentionPanelStateValue
	navigationStack: NavigationItem[]
	searchQuery: string
	onSearch?: (query: string) => void
	searchPlaceholder?: string
}

export interface KeyboardHintsProps extends BaseComponentProps {
	state: MentionPanelStateValue
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
	dispatch: (
		request: import("./dispatch").MentionStoreRequest,
	) => Promise<import("./dispatch").MentionStoreResult> | import("./dispatch").MentionStoreResult
	setRefreshHandler?: (handler: (() => void) | undefined) => void
	preLoadList?: () => void | Promise<void>
	removeFromHistory?: (itemId: string) => void
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

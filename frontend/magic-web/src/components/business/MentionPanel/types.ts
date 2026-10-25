import type { ReactNode, CSSProperties } from "react"
import type { I18nTexts, LocaleInput } from "./i18n/types"
import type { MarkerType } from "@/components/CanvasDesign/runtime/document/types"
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
	MICRO_APP: "micro_app",
	PROJECT: "project",
	PROJECT_FILE: "project_file",
	USER_FILE: "user_file",
	USER_DIRECTORY: "user_directory",
	MEMORY_FILE: "memory_file",
	MEMORY_DIRECTORY: "memory_directory",
	UPLOAD_FILE: "upload_file",
	CLOUD_FILE: "cloud_file",
	DESIGN_MARKER: "design_marker",
	TEXT: "text",
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
	agent_code?: string
	agent_name: string
	agent_avatar: string
	agent_description: string
	agent_source?: "digital_employee"
}

export interface ToolMentionData {
	id: string
	name: string
	icon?: string
	description?: string
}

export interface MicroAppMentionData {
	app_id: string
	app_name?: string
}

export interface ProjectMentionData {
	project_id: string
	/** Display name retained for rendering the mention chip after insertion. */
	project_name?: string
}

export interface ProjectFileMentionData {
	/** 原附件来源用于沿用 AI 图片下载策略，不从名称或 URL 猜测。 */
	source?: import("@/pages/superMagic/components/TopicFilesButton/hooks/types").AttachmentSource
	file_id: string
	file_name: string
	file_path: string
	relative_file_path?: string
	file_extension: string
	/** File metadata used to prevent stale signed-URL reuse across editor/canvas entry points. */
	updated_at?: string
	resource_version?: string | null
	version?: string | null
	file_version?: number
	/** Project that owns this file. Optional for compatibility with historical mention data. */
	project_id?: string
	/** Frontend-only source project name used to render cross-project mention chips. */
	project_name?: string
	file_size?: number
	is_hidden?: boolean
	/** Internal: source project for project-file mentions pasted outside their original project. */
	source_project_id?: string
	/** Internal: source file id before copying into the target project. */
	source_file_id?: string
	/** Internal: marks a project-file mention that must be copied before sending. */
	pending_project_copy?: boolean
}

/** 用户引用没有项目或复制语义；路径由真实用户根元数据生成。 */
export interface UserFileMentionData {
	file_id: string
	file_name: string
	file_path: string
	file_extension: string
	project_id?: never
	source_project_id?: never
	source_file_id?: never
	pending_project_copy?: never
}

export interface UserDirectoryMentionData {
	directory_id: string
	directory_name: string
	directory_path: string
	project_id?: never
	source_project_id?: never
	source_directory_id?: never
	pending_project_copy?: never
}

export type UserFileReferenceMention =
	| { type: typeof MentionBusinessItemType.USER_FILE; data: UserFileMentionData }
	| { type: typeof MentionBusinessItemType.USER_DIRECTORY; data: UserDirectoryMentionData }

/** 记忆文件 mention 数据。 */
export interface MemoryFileMentionData {
	file_id: string
	file_name: string
	file_path: string
	file_extension: string
}

/** 记忆目录 mention 数据。 */
export interface MemoryDirectoryMentionData {
	directory_id: string
	directory_name: string
	directory_path: string
}

export interface DirectoryMentionData {
	directory_id: string
	directory_name: string
	directory_path: string
	directory_metadata: DirectoryMentionMetadata
	/** Project that owns this directory. */
	project_id?: string
	/** Frontend-only source project name used to render cross-project mention chips. */
	project_name?: string
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
	relative_file_path?: string
	is_hidden?: boolean
	// 上传状态相关字段
	upload_progress?: number // 上传进度 0-100
	upload_status?: "init" | "uploading" | "done" | "error"
	upload_error?: string
	/** Local HTML screenshot identity; not an upload task. */
	is_html_screenshot?: boolean
	storage_id?: string
	/** Internal marker for canvas clipboard attachments; never promote to project mention. */
	is_canvas_clipboard?: boolean
	/** IndexedDB screenshot. Region shots stage after confirm; save on send. */
	is_html_screenshot?: boolean
	storage_id?: string
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

/** Stores the SDK-provided display label, send text, and stable business identifier. */
export interface TextMentionData {
	label: string
	text: string
	id: string
	[key: string]: unknown
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
	[MentionBusinessItemType.MICRO_APP]: MicroAppMentionData
	[MentionBusinessItemType.SKILL]: SkillMentionData
	[MentionBusinessItemType.TOOL]: ToolMentionData
	[MentionBusinessItemType.PROJECT]: ProjectMentionData
	[MentionBusinessItemType.PROJECT_FILE]: ProjectFileMentionData
	[MentionBusinessItemType.USER_FILE]: UserFileMentionData
	[MentionBusinessItemType.USER_DIRECTORY]: UserDirectoryMentionData
	[MentionBusinessItemType.MEMORY_FILE]: MemoryFileMentionData
	[MentionBusinessItemType.MEMORY_DIRECTORY]: MemoryDirectoryMentionData
	[MentionBusinessItemType.UPLOAD_FILE]: UploadFileMentionData
	[MentionBusinessItemType.CLOUD_FILE]: CloudFileMentionData
	[MentionBusinessItemType.DESIGN_MARKER]: CanvasMarkerMentionData
	[MentionBusinessItemType.TEXT]: TextMentionData
}

export interface MentionItemDataMap extends MentionCoreItemDataMap, MentionBusinessItemDataMap {}

export type MentionCoreDataItemType = keyof MentionCoreItemDataMap
export type MentionBusinessDataItemType = keyof MentionBusinessItemDataMap
export type MentionDataItemType = keyof MentionItemDataMap

// Union type for all mention data types
export type MentionData = MentionItemDataMap[MentionDataItemType]

export type MentionItemDataByType<T extends MentionPanelItemTypeValue> =
	T extends MentionDataItemType ? MentionItemDataMap[T] : never

export interface MentionImageSourceCrop {
	x: number
	y: number
	width: number
	height: number
	displayWidth?: number
	displayHeight?: number
}

export interface CanvasElementMentionSourcePreview {
	kind: "canvas-element"
	designProjectId?: string
	elementId: string
	mediaType: "image" | "video" | "audio"
	src: string
	crop?: MentionImageSourceCrop
}

export type MentionItemSourcePreview = CanvasElementMentionSourcePreview

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
	/** Direct HTTPS image URL for custom icons. Takes precedence over icon token. */
	iconUrl?: string
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
	metadata?: Record<string, unknown>
	sourcePreview?: MentionItemSourcePreview

	// Skill specific properties
	package_name?: string // Package name
}

/** One labelled group inside a scene catalog, e.g. "Interviewed personas". */
export interface MentionSceneCatalogGroup {
	id: string
	title: string
	items: MentionItem[]
}

/**
 * Entry a page pins at the top of its own @ panel, e.g. "This study" on the research page.
 * Items are ordinary mention items (usually project_file), so sending needs no new type.
 */
export interface MentionSceneCatalog {
	name: string
	icon?: ReactNode
	groups: MentionSceneCatalogGroup[]
}

/** What the @ panel knows about a project entry when a scene wants to relabel it. */
export interface ProjectFileDisplayInput {
	/** Real workspace path without a leading slash, e.g. "studies/x/report.html". */
	path: string
	/** Real file or folder name. */
	name: string
	isDirectory: boolean
}

/** Display-only override of a project entry; the real path and ids are never touched. */
export interface ProjectFileDisplay {
	/** Row label. Files also use it as the chip label, like scene catalog items do. */
	name?: string
	icon?: ReactNode
	/** Drops the entry (and anything the resolver also hides below it) from the panel. */
	hidden?: boolean
}

export type ProjectFileDisplayResolver = (
	input: ProjectFileDisplayInput,
) => ProjectFileDisplay | null | undefined

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

export interface ProjectMentionItem extends MentionBusinessItem<
	typeof MentionBusinessItemType.PROJECT
> {
	type: typeof MentionBusinessItemType.PROJECT
	data: ProjectMentionData
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

export enum MentionPanelViewMode {
	/* 列表模式 */
	LIST = "list",
	/* 画廊模式 */
	GALLERY = "gallery",
}

export interface MentionPanelGalleryOptions {
	/* 是否启用预览弹窗 */
	enablePreviewModal?: boolean
}

/** 多选面板顶部摘要支持的资源类型。 */
export type MentionPanelSelectionAssetType = "image" | "video" | "audio"

/**
 * 多选面板的资源数量摘要。
 *
 * `currentCounts` 是打开面板前已经占用的数量，暂存项会在渲染时增量计算。
 * 资源类型和「已存在」判断由宿主提供，MentionPanel 本身不依赖具体文件格式。
 */
export interface MentionPanelSelectionSummary {
	currentCounts: Record<MentionPanelSelectionAssetType, number>
	limits: Partial<Record<MentionPanelSelectionAssetType, number>>
	/** 所有资源类型的总上限；与 per-type 独立，非有限值表示无总上限。 */
	totalLimit?: number
	getItemAssetType?: (item: MentionItem) => MentionPanelSelectionAssetType | undefined
	isItemAlreadySelected?: (item: MentionItem) => boolean
}

/** 多选会话在目录导航时的保留策略。 */
export type MentionPanelMultiSelectNavigationPolicy = "clear" | "preserve"

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
	/** 是否允许多选。默认 true；单槽替换等一换一场景可关闭。 */
	enableMultiSelect?: boolean
	/** 目录切换时是否保留本次面板会话的多选项；默认兼容旧行为并清空。 */
	multiSelectNavigationPolicy?: MentionPanelMultiSelectNavigationPolicy
	/** 多选会话的资源作用域；作用域变化时会丢弃旧会话，避免跨资源提交。 */
	selectionScopeId?: string
	/** 多选时显示在文件列表下方的资源数量摘要。 */
	selectionSummary?: MentionPanelSelectionSummary
	/**
	 * 为 true 时禁止 Radix 因「外部」交互自动关闭（画布内嵌套 Portal 易出现误判）。
	 * 仍可通过 onClose / 键盘退出等显式关闭。
	 */
	lockDismissToExplicitClose?: boolean
	canToggleMultiSelectItem?: (item: MentionItem) => boolean
	/* 面板模式 */
	viewMode?: MentionPanelViewMode
	/* 画廊模式相关选项 */
	galleryOptions?: MentionPanelGalleryOptions
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
	onCheckboxClick?: (event?: React.MouseEvent) => void
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

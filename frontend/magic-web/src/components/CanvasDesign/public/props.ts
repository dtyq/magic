import type { Node as TiptapNode } from "@/infrastructure/editors/tiptap/core"
import type { ComponentType, RefObject } from "react"
import type { ModifierAlias } from "../runtime/interaction/shortcuts/types"
import type { Canvas } from "../runtime/core/Canvas"
import type { CanvasAssetMediaType, MagicConfig } from "./magic-types"
import type { ResolveCanvasResourceReference } from "./resource-reference"
import type {
	CanvasDeviceInfo,
	CanvasDesignPluginModuleConfig,
	CanvasConnection,
	CanvasDocument,
	LayerElement,
	Marker,
	PaddingInsetConfig,
} from "../runtime/document/types"
import type { NameLabelIconResolver } from "../runtime/interaction/labels/nameLabelTypes"
import type { ElementDetailsProvenance } from "../runtime/document/elementDetailsProvenance"
import type { CanvasElementNameChange } from "../runtime/core/EventEmitter"
import type { TFunction } from "./i18n-types"
import type {
	CanvasDocumentMergeConnectionConflictReason,
	CanvasDocumentMergeElementConflictReason,
} from "../runtime/document/index"
import type {
	ReferenceAssetPerTypeLimits,
	ReferenceAssetTypeCounts,
	ReferenceResourceTypeFilter,
} from "../ui/editors/message/reference-assets/reference-resource.types"
import type {
	CanvasReferenceMentionPanelState,
	CanvasReferenceMentionProjectFileType,
} from "../ui/editors/message/reference-assets/canvasReferenceMention.constants"

export type {
	CanvasDeviceFormFactor,
	CanvasDeviceInfo,
	CanvasDeviceLayout,
} from "../runtime/document/types"
export type {
	NameLabelIconContext,
	NameLabelIconDescriptor,
	NameLabelIconResolver,
} from "../runtime/interaction/labels/nameLabelTypes"

/**
 * Mention 面板语言入参（与宿主 MentionPanel LocaleInput 约定一致，避免依赖业务包）
 */
export type MentionPanelLocaleInput =
	| "en"
	| "zh-CN"
	| "zh"
	| "zh_CN"
	| "zh-cn"
	| "zh_cn"
	| "en_US"
	| "en-US"
	| "en-us"
	| "en_us"
	| string

/**
 * 宿主侧 MentionPanel DataService 能力形状；列表项与 i18n 入参用 any，避免拉取 MentionPanel 类型树。
 * 实现类应对齐业务包中 MentionPanel 的 DataService 定义。
 */
/* eslint-disable @typescript-eslint/no-explicit-any -- 与宿主 DataService 结构对齐的注入边界，不用业务 MentionItem/I18nTexts */
export interface CanvasDesignMentionDataServiceBase {
	dispatch: (request: any) => Promise<any> | any
	setRefreshHandler?: (handler: (() => void) | undefined) => void
	preLoadList?: () => void | Promise<void>
	removeFromHistory?: (itemId: string) => void
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/**
 * 项目附件树节点（与超级麦吉 FileItem 树对应），供 @ / 参考资源面板按目录浏览。
 * 文件夹的 id 使用 relative_file_path，与 MentionPanel getFolderItems(folderId) 约定一致。
 */
export interface ProjectAttachmentMentionNode {
	/** 文件为 file_id；文件夹为 relative_file_path（用于展开子级） */
	id: string
	/** 附件 file_id（目录、文件均有） */
	fileId: string
	name: string
	/** relative_file_path */
	path: string
	extension?: string
	isDirectory: boolean
	/** 与 FileItem.metadata 一致，供 MentionPanel 渲染 design/slide 等目录图标 */
	display_config?: { type?: string; name?: string }
	children?: ProjectAttachmentMentionNode[]
}

export interface ReferenceResourcePanelFileData {
	file_id: string
	file_name: string
	file_path: string
	file_extension: string
	/** 资产 URI 不携带扩展名时的显式媒体类型。 */
	media_type?: CanvasAssetMediaType | null
	file_size?: number
	project_id?: string
	source_project_id?: string
	source_file_id?: string
	relative_file_path?: string
	pending?: boolean
	pending_id?: string
	upload_progress?: number
	upload_status?: "init" | "uploading" | "done" | "error"
	upload_error?: string
}

export interface ReferenceResourcePanelItem {
	type: CanvasReferenceMentionProjectFileType
	data: ReferenceResourcePanelFileData
}

export type ReferenceResourcePanelAssetType = "image" | "video" | "audio"

/**
 * 画布参考资源面板的多选数量摘要；保持在 renderer 边界内，避免宿主直接依赖
 * MentionPanel 的业务数据结构。
 */
export interface ReferenceResourcePanelSelectionSummary {
	currentCounts: Record<ReferenceResourcePanelAssetType, number>
	limits: Partial<Record<ReferenceResourcePanelAssetType, number>>
	/** 所有资源类型的总上限；与 per-type 独立，非有限值表示无总上限。 */
	totalLimit?: number
	getItemAssetType?: (
		item: ReferenceResourcePanelItem,
	) => ReferenceResourcePanelAssetType | undefined
	isItemAlreadySelected?: (item: ReferenceResourcePanelItem) => boolean
}

export interface ReferenceResourcePanelListItem extends ReferenceResourcePanelItem {
	id: string
	name: string
	icon?: string
	extension?: string
	hasChildren?: boolean
	isFolder?: boolean
	unSelectable?: boolean
}

export interface ReferenceResourcePanelLimitInfo {
	maxReferenceFiles?: number
	currentReferenceFiles?: string[]
	isReferenceFileLimitReached?: boolean
	referenceResourceType?: ReferenceResourceTypeFilter
	referenceFileInfos?: Array<{
		src: string
		fileName: string
		path: string
	}>
	assetLimits?: ReferenceAssetPerTypeLimits
	currentAssetCounts?: ReferenceAssetTypeCounts
	/** 宿主资源解析器，用于区分工作区根路径与当前画布相对路径。 */
	resolveResourceReference?: ResolveCanvasResourceReference
	/** 面包屑等展示用文案前缀（如「当前项目文件」） */
	projectFilesPathPrefix?: string
	/**
	 * 当前设计根目录显示名（如「新建画布」），用于 @ 列表副标题在 DSL 相对路径前拼接父级路径
	 */
	mentionFileSubtitleParentPrefix?: string
}

export interface CanvasReferenceElementsContext {
	canvasName?: string
	rootFolderId?: string
	getCanvasDocument: () => CanvasDocument | null | undefined
}

/**
 * MentionPanel DataService 能力 + 画布侧可选回调（CanvasDesignMentionDataService 等）。
 */
export type MentionDataServicePort = CanvasDesignMentionDataServiceBase & {
	setLimitInfoGetter?(
		getter: (() => ReferenceResourcePanelLimitInfo | undefined) | undefined,
	): void
	setRefreshHandler?(handler: (() => void) | undefined): void
	requestRefresh?(): void
	/** 画布元素数据变化时清空 @ 文件面板内的画布元素快照 */
	invalidateCanvasElementsCache?(): void
	/** 更新项目附件根（不换实例，避免 TipTap Mention 扩展重建失焦） */
	syncProjectAttachmentRoots?(roots: ProjectAttachmentMentionNode[]): void
	/** 更新当前画布元素数据源；用于 @ 文件面板展示当前画布可引用元素 */
	setCanvasReferenceElementsContext?(context: CanvasReferenceElementsContext | undefined): void
}

/** Mention 数据服务构造函数，由外部传入以实现隔离 */
export type MentionDataServiceCtor = new (
	attachmentRoots: ProjectAttachmentMentionNode[],
) => MentionDataServicePort

export interface ReferenceResourcePanelSelectContext {
	reset?: () => void
	batch?: {
		index: number
		total: number
	}
}

export interface ReferenceResourcePanelInitialLoadOptions {
	itemId: string
}

export type ReferenceResourcePanelStateValue = CanvasReferenceMentionPanelState

export interface ReferenceResourcePanelNavigationItem {
	id: string
	name: string
	state: ReferenceResourcePanelStateValue
	catalogId?: string
	parentId?: string
}

export interface ReferenceResourcePanelSelectableItem {
	type?: string
	isFolder?: boolean
}

export interface ReferenceResourcePanelCatalogBehaviorArgs {
	currentState?: ReferenceResourcePanelStateValue
	currentCatalogId?: string
	selectedItem: ReferenceResourcePanelSelectableItem
	enterFolder: boolean
}

export interface ReferenceResourcePanelCatalogBehavior {
	getStaticTransition?: (args: {
		currentState?: ReferenceResourcePanelStateValue
		itemId: string
	}) => { state: ReferenceResourcePanelStateValue; catalogId?: string } | null
	getDynamicTransition?: (
		args: ReferenceResourcePanelCatalogBehaviorArgs,
	) => { state: ReferenceResourcePanelStateValue; catalogId?: string } | null
	shouldEnterFolderDirectly?: (args: ReferenceResourcePanelCatalogBehaviorArgs) => boolean
	shouldSelectItemDirectly?: (args: ReferenceResourcePanelCatalogBehaviorArgs) => boolean
}

/**
 * Host renderer boundary for Canvas reference-resource panels.
 *
 * CanvasDesign owns the shared runtime for inline "@" mentions and "select from
 * project". Host adapters should consume these props as-is and stay
 * presentation-only; do not rebuild default-directory, filtering, limit, or
 * folder-navigation logic inside the adapter.
 */
export interface ReferenceResourcePanelRendererProps {
	visible: boolean
	triggerRef?: RefObject<HTMLElement | null>
	language?: string
	/** 是否允许面板多选。默认 true；单槽替换场景传 false。 */
	enableMultiSelect?: boolean
	/** 连续选择会话的资源作用域；作用域变化时面板自动丢弃暂存项。 */
	selectionScopeId?: string
	/** 多选时显示在路径面包屑右侧的资源数量摘要。 */
	selectionSummary?: ReferenceResourcePanelSelectionSummary
	dataService?: MentionDataServicePort
	initialLoadOptions?: ReferenceResourcePanelInitialLoadOptions
	initialNavigationStack?: ReferenceResourcePanelNavigationItem[]
	catalogBehavior?: ReferenceResourcePanelCatalogBehavior
	onSelect: (
		item: ReferenceResourcePanelItem,
		context?: ReferenceResourcePanelSelectContext,
	) => void
	onClose: () => void
}

export type ReferenceResourcePanelRenderer = ComponentType<ReferenceResourcePanelRendererProps>

/**
 * CanvasDesign 对宿主 mention 扩展暴露的最小 attrs 形状，避免直接依赖业务 MentionPanel 类型。
 */
export interface CanvasMentionAttributes {
	type?: string
	data?: unknown
	mentionSuggestionChar?: string
}

/**
 * CanvasDesign 对宿主 mention 扩展 options 的最小能力抽象。
 */
export interface CanvasMentionExtensionRuntimeOptions {
	renderText?: (props: {
		options: CanvasMentionExtensionRuntimeOptions
		node: { attrs: CanvasMentionAttributes }
	}) => string
	nodeViewRenderers?: Partial<Record<string, CanvasMentionNodeViewRenderer>>
}

/**
 * CanvasDesign 仅消费 node attrs / extension options 两类数据，保持与宿主 NodeView props 解耦。
 */
export interface CanvasMentionNodeViewRendererProps {
	node: { attrs: CanvasMentionAttributes }
	extension: { options: CanvasMentionExtensionRuntimeOptions }
}

export type CanvasMentionNodeViewRenderer = ComponentType<CanvasMentionNodeViewRendererProps>

export interface MentionExtensionOptions {
	language: MentionPanelLocaleInput
	getParentContainer: () => HTMLElement
	dataService: MentionDataServicePort
}

/** TipTap `Mention.extend(...)` 产物，由宿主注入；options 形状由宿主扩展定义 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- 宿主 Mention 扩展的 options/storage 由业务定义
export type MentionExtensionCtor = TiptapNode<any, any>

/** 分割线 */
export const Divider = "Divider"

/** 快捷键显示配置（用于 UI） */
export interface ShortcutDisplay {
	key: string
	modifiers?: ModifierAlias[]
}

/** 稳定的元素工具业务身份。顶部、底部和版本工具共用这一套 ID。 */
export const ElementToolTypeEnum = {
	ElementResize: "element.resize",
	ElementAlign: "element.align",
	ElementDistribute: "element.distribute",

	FrameCreate: "frame.create",
	FrameRemove: "frame.remove",
	FrameDownload: "frame.download",
	FrameStoryboardVideoBatch: "frame.storyboard-video-batch",

	TextFillColor: "text.fill-color",
	TextFontFamily: "text.font-family",
	TextFontStyle: "text.font-style",
	TextFontSize: "text.font-size",
	TextAlign: "text.align",
	TextAdvanced: "text.advanced",
	TextDownload: "text.download",
	TextContentOptimization: "text.content-optimization",

	ShapeStrokeColor: "shape.stroke-color",
	ShapeStyle: "shape.style",

	ContentReplace: "content.replace",
	ContentDownload: "content.download",
	ContentCrop: "content.crop",
	ContentExtend: "content.extend",
	ContentRemoveBackground: "content.remove-background",
	ContentEraser: "content.eraser",
	ContentEnhance: "content.enhance",
	ContentPromptExtraction: "content.prompt-extraction",
	ContentMediaOriginalSize: "content.media-original-size",

	GenerationQuickEdit: "generation.quick-edit",
	GenerationReEdit: "generation.re-edit",
	GenerationGenerateAgain: "generation.generate-again",
	GenerationGenerateFinal: "generation.generate-final",

	VersionPrevious: "version.previous",
	VersionNext: "version.next",
	VersionCount: "version.count",
	VersionSetMain: "version.set-main",
	VersionDelete: "version.delete",
} as const

export type ElementToolType = (typeof ElementToolTypeEnum)[keyof typeof ElementToolTypeEnum]

export interface CanvasResourceRefreshItem {
	path: string
	mediaType: "image" | "video" | "audio"
}

export interface CanvasDesignRef {
	/** 删除指定的 marker */
	removeMarker: (markerId: string) => void
	/** 清空所有 marker */
	clearMarkers: () => void
	/** 批量添加 markers；options.silent 为 true 时不触发 marker:created */
	addMarkers: (markers: Marker[], options?: { silent?: boolean }) => void
	/** 获取所有 marker */
	getMarkers: () => Marker[]
	/** 获取指定的 marker */
	getMarker: (id: string) => Marker | null
	/** 更新指定的 marker */
	updateMarker: (markerId: string, updates: Partial<Marker>) => Marker | null
	/** 聚焦到指定元素 */
	focusElement: (
		elementIds: string[],
		options?: {
			selectElement?: boolean | string[]
			animated?: boolean
			padding?: PaddingInsetConfig
			panOnly?: boolean
			/** 当 viewport 放大导致元素无法完全显示时，是否自动缩小以完整展示元素（默认: true） */
			ensureFullyVisible?: boolean
		},
	) => void
	/** 适配屏幕 */
	fitToScreen: () => void
	/** 热更新画布数据，远端快照可使用 replace 模式确保嵌套元素完整同步 */
	updateData: (
		data: CanvasDocument,
		options?: {
			mode?: "smart" | "replace"
			/** 文件操作已在服务端发生，不生成只能撤销画布引用的历史步骤。 */
			historyPolicy?: "include" | "exclude"
			/** sidecar 解析出的运行时来源；不会写入画布 DSL */
			elementDetailsProvenance?: ElementDetailsProvenance
		},
	) => void
	/** 导出当前画布文档；用于宿主在页面卸载前保存本地草稿 */
	exportCurrentDocument: () => CanvasDocument | null
	/** 获取当前 Canvas 实例；用于跨 React 树的画布资源预览 */
	getCanvasInstance: () => Canvas | null
	/** 按资源路径强制刷新画布内已缓存的图片/视频/音频资源 */
	refreshResources: (resources: CanvasResourceRefreshItem[]) => Promise<void>
	/** 如果元素不在可视区域，则移动到可视区域 */
	ensureElementVisible: (
		elementId: string,
		options?: {
			animated?: boolean
			padding?: PaddingInsetConfig
		},
	) => void
	/** 异步获取图片元素的 OSS URL（如果还没有则触发换取） */
	getImageOssUrl: (elementId: string) => Promise<string | null>
	/** 获取图片元素的信息（异步，如未加载则触发加载） */
	getElementImageInfo: (elementId: string) => Promise<{
		imageInfo?: {
			naturalWidth: number
			naturalHeight: number
			fileSize?: number
			mimeType?: string
			filename?: string
		}
		ossUrl?: string
		image?: HTMLImageElement | ImageBitmap
	} | null>
}

export interface CanvasDesignElementActionHint {
	id?: string
	elementId: string
	reason?: CanvasDocumentMergeElementConflictReason
	status?: "unresolved" | "resolved"
	tone?: "warning" | "info" | "error"
	localExists?: boolean
	remoteExists?: boolean
}

export interface CanvasDesignConnectionActionHint {
	id?: string
	connectionId: string
	sourceElementId?: string
	targetElementId?: string
	reason?: CanvasDocumentMergeConnectionConflictReason
	status?: "unresolved" | "resolved"
	tone?: "warning" | "info" | "error"
	localExists?: boolean
	remoteExists?: boolean
}

export type CanvasCapability =
	| "document.read"
	| "document.write"
	| "document.delete"
	| "interaction.select"
	| "interaction.preview"
	| "interaction.switchContent"
	| "interaction.playback"
	| "sideEffect.download"
	| "sideEffect.copy"
	| "sideEffect.generate"

export type CanvasAccessMode = "edit" | "readonly" | "share" | "history"

export interface CanvasAccessContext {
	mode: CanvasAccessMode
	capabilities: ReadonlySet<CanvasCapability>
	can: (capability: CanvasCapability) => boolean
}

export interface CanvasDesignProps {
	/** 设计项目 ID，用于隔离画布级缓存、SW 离线资源与跨画布粘贴校验 */
	id: string
	/** Optional semantic mode used to derive default capabilities. */
	accessMode?: CanvasAccessMode
	/** Fine-grained interaction capabilities. */
	capabilities?: Partial<Record<CanvasCapability, boolean>>
	/** Magic 配置 */
	magic?: MagicConfig
	/** 插件配置，由宿主注入系统内置插件，并可声明用户插件资源目录 */
	plugins?: CanvasDesignPluginModuleConfig
	/** 可选的名称标签图标 resolver；不传时名称标签保持纯文本 */
	nameLabelIconResolver?: NameLabelIconResolver
	/** 数据 配置 */
	data?: {
		/** 默认画布数据，用于初始化画布 */
		defaultData?: CanvasDocument
		/** sidecar 解析出的运行时来源；不会写入画布 DSL */
		elementDetailsProvenance?: ElementDetailsProvenance
		/** 当前会话成功提交新任务后同步运行时来源，供宿主在 Canvas 重建时继续使用 */
		onElementDetailsProvenanceChange?: (provenance: ElementDetailsProvenance) => void
		/** 画布数据变化回调 */
		onCanvasDesignDataChange?: (
			canvasData: CanvasDocument,
			meta?: CanvasDesignDataChangeMeta,
		) => void
		/** 画布数据增量变化回调；宿主接入后可避免普通元素提交时 full export */
		onCanvasDesignDataPatchChange?: (
			patch: CanvasDesignDataPatch,
			meta?: CanvasDesignDataChangeMeta,
		) => void
		/** 当前画布选中元素变化；宿主可将选中元素映射为业务引用。 */
		onSelectionChange?: (elementIds: string[]) => void
		/** 项目附件树根节点列表，用于 @ / 参考资源面板（保留目录层级） */
		projectAttachmentMentionTree?: ProjectAttachmentMentionNode[]
		/** `@文件` 默认进入的项目目录 id，通常为当前设计项目目录 */
		defaultProjectAttachmentFolderId?: string
		/** `@文件` 默认进入的项目目录名称，用于面包屑显示 */
		defaultProjectAttachmentFolderName?: string
		/** Mention 数据服务构造函数，由外部传入以实现隔离 */
		mentionDataServiceCtor?: MentionDataServiceCtor
		/** Mention 扩展类（通过依赖注入传入，实现组件隔离） */
		mentionExtension?: MentionExtensionCtor
		/** 项目侧资源选择面板渲染器（通过依赖注入传入，实现组件隔离） */
		referenceResourcePanelRenderer?: ReferenceResourcePanelRenderer
		/** 元素锚点动作提示；仅展示和回调，不改变元素交互能力 */
		elementActionHints?: CanvasDesignElementActionHint[]
		onElementActionHintAction?: (elementId: string, actionKey: string) => void
		/** 连接线锚点动作提示；仅展示和回调，不改变连接线交互能力 */
		connectionActionHints?: CanvasDesignConnectionActionHint[]
		onConnectionActionHintAction?: (connectionId: string, actionKey: string) => void
	}
	/** marker 配置 */
	marker?: {
		/** 由父组件传入的 markers */
		defaultMarkers?: Marker[]
		/** 创建 marker 前的回调 */
		beforeMarkerCreate?: (marker: Marker) => void
		/** marker 创建回调 */
		onMarkerCreated?: (marker: Marker) => void
		/** marker 删除回调 */
		onMarkerDeleted?: (id: string) => void
		/** marker 数据更新回调（仅在更新时触发） */
		onMarkerUpdated?: (marker: Marker, markers: Marker[]) => void
		/** marker 从 storage 恢复成功回调 */
		onMarkerRestored?: (markers: Marker[]) => void
	}
	/** viewport 配置 */
	viewport?: {
		/** 自动加载缓存的 viewport */
		autoLoadCacheViewport?: boolean
		/**
		 * 浮层碰撞边界；Popover 等悬浮面板会以该元素作为可用区域，
		 * 但 Portal 仍挂载在 CanvasDesign 自身的 UI 容器中。
		 */
		floatingBoundary?: HTMLElement | null
	}
	/** 翻译函数 */
	t?: TFunction
	/** 获取设备形态、布局和输入能力 */
	getDevice?: () => CanvasDeviceInfo
	/**
	 * 宿主底部存在 fixed 层（如分享页「由超级麦吉创建」徽标）时置为 true，
	 * 缩放控件上移避免被遮挡；由宿主判断场景后传入，CanvasDesign 不依赖业务路由。
	 */
	shareHostBottomChrome?: boolean
}

export type CanvasDesignDataChangeSource =
	| "element:change"
	| "canvas:clear"
	| "element:temporary:converted"
	| "connection:change"
	| "document:restored"

export interface CanvasDesignDataChangeMeta {
	source: CanvasDesignDataChangeSource
	changedElementIds?: string[]
	deletedElementIds?: string[]
	changedConnectionIds?: string[]
	deletedConnectionIds?: string[]
	elementNameChanges?: CanvasElementNameChange[]
}

export interface CanvasDesignDataPatch {
	upserts: Array<{ element: LayerElement; parentId: string | null }>
	deletedElementIds: string[]
	changedElementIds: string[]
	elementNameChanges?: CanvasElementNameChange[]
	connectionUpserts?: CanvasConnection[]
	deletedConnectionIds?: string[]
	changedConnectionIds?: string[]
}

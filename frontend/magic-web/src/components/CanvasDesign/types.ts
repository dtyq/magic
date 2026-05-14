import type { Node as TiptapNode } from "@tiptap/core"
import type { ComponentType, RefObject } from "react"
import type { ModifierAlias } from "./canvas/interaction/shortcuts/types"
import type { MagicConfig } from "./types.magic"
import type { CanvasDocument, Marker, PaddingInsetConfig } from "./canvas/types"
import type { TFunction } from "./context/I18nContext"
import type {
	ReferenceAssetPerTypeLimits,
	ReferenceAssetTypeCounts,
	ReferenceResourceTypeFilter,
} from "./components/MessageEditor/reference-assets/reference-resource.types"

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
	file_size?: number
}

export interface ReferenceResourcePanelItem {
	type: "project_file"
	data: ReferenceResourcePanelFileData
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
	/** 面包屑等展示用文案前缀（如「当前项目文件」） */
	projectFilesPathPrefix?: string
	/**
	 * 当前设计根目录显示名（如「新建画布」），用于 @ 列表副标题在 DSL 相对路径前拼接父级路径
	 */
	mentionFileSubtitleParentPrefix?: string
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
	/** 更新项目附件根（不换实例，避免 TipTap Mention 扩展重建失焦） */
	syncProjectAttachmentRoots?(roots: ProjectAttachmentMentionNode[]): void
}

/** Mention 数据服务构造函数，由外部传入以实现隔离 */
export type MentionDataServiceCtor = new (
	attachmentRoots: ProjectAttachmentMentionNode[],
) => MentionDataServicePort

export interface ReferenceResourcePanelSelectContext {
	reset?: () => void
}

export interface ReferenceResourcePanelRendererProps {
	visible: boolean
	triggerRef?: RefObject<HTMLElement | null>
	language?: string
	dataService?: MentionDataServicePort
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

/** 元素工具 */
export const ElementToolTypeEnum = {
	RichTextFillColor: "rich-text-fill-color", // 富文本填充颜色
	StrokeColor: "stroke-color", // 描边颜色
	SizeEditButton: "size-edit-button", // 编辑尺寸（Popover 内预设 + 宽高）
	FrameCreateButton: "frame-create-button", // 创建画框按钮
	FrameRemoveButton: "frame-remove-button", // 解除画框按钮
	RichTextFontFamily: "rich-text-font-family", // 富文本字体簇(font-family)
	RichTextFontStyle: "rich-text-font-style", // 富文本文字粗细(font-weight)
	RichTextFontSize: "rich-text-font-size", // 富文本字体大小(font-size)
	RichTextTextAlign: "rich-text-text-align", // 富文本对齐方式(align)
	ElementAlign: "element-align", // 元素对齐
	ElementDistribute: "element-distribute", // 元素分布
	ShapeStyle: "shape-style", // 图形样式配置
	DownloadButton: "download-button", // 下载按钮
	RichTextAdvancedButton: "rich-text-advanced-button", // 富文本高级按钮
	ImageConvertHightButton: "image-convert-hight-button", // 转高清按钮
	ImageConvertHight: "image-convert-hight", // 转高清配置
	ImageCropButton: "image-crop-button", // 裁剪按钮
	ImageCrop: "image-crop", // 裁剪模式提示
	ImageExtendButton: "image-extend-button", // 扩展按钮
	ImageRemoveBackgroundButton: "image-remove-background-button", // 去背景按钮
	ImageEraserButton: "image-eraser-button", // 橡皮工具按钮
	VideoOriginalSizeButton: "video-original-size-button", // 视频原始尺寸按钮
} as const

/** 元素工具类型 */
export type ElementToolType = (typeof ElementToolTypeEnum)[keyof typeof ElementToolTypeEnum]

export interface CanvasResourceRefreshItem {
	path: string
	mediaType: "image" | "video"
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
	updateData: (data: CanvasDocument, options?: { mode?: "smart" | "replace" }) => void
	/** 按资源路径强制刷新画布内已缓存的图片/视频资源 */
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

export interface CanvasDesignProps {
	/** 画布唯一标识，用于跨画布粘贴校验 */
	id?: string
	/** 是否为只读模式 */
	readonly?: boolean
	/** Magic 配置 */
	magic?: MagicConfig
	/** 数据 配置 */
	data?: {
		/** 默认画布数据，用于初始化画布 */
		defaultData?: CanvasDocument
		/** 画布数据变化回调 */
		onCanvasDesignDataChange?: (canvasData: CanvasDocument) => void
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
	}
	/** 翻译函数 */
	t?: TFunction
	/** 是否移动端 */
	getIsMobile?: () => boolean
	/**
	 * 宿主底部存在 fixed 层（如分享页「由超级麦吉创建」徽标）时置为 true，
	 * 缩放控件上移避免被遮挡；由宿主判断场景后传入，CanvasDesign 不依赖业务路由。
	 */
	shareHostBottomChrome?: boolean
}

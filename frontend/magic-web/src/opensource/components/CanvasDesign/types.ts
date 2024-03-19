import type { ModifierAlias } from "./canvas/interaction/shortcuts/types"
import type { CanvasDesignMethods, MagicPermissions } from "./types.magic"
import type { CanvasDocument, Marker, PaddingConfig } from "./canvas/types"
import type { TFunction } from "./context/I18nContext"

/** 项目 images 目录下的图片项，用于 @ 面板 */
export interface ImageFileForMention {
	name: string
	path?: string
}

/** Mention 数据服务需实现的端口（CanvasDesign 内使用，不依赖 MentionPanel） */
export interface MentionDataServicePort {
	getDefaultItems(t?: unknown): unknown[]
	searchItems(query: string): unknown[]
	setLimitInfoGetter?(getter: (() => unknown) | undefined): void
	setRefreshHandler?(handler: (() => void) | undefined): void
	requestRefresh?(): void
}

/** Mention 数据服务构造函数，由外部传入以实现隔离 */
export type MentionDataServiceCtor = new (
	imageFiles: ImageFileForMention[],
) => MentionDataServicePort

/** 分割线 */
export const Divider = "Divider"

/** 快捷键显示配置（用于 UI） */
export interface ShortcutDisplay {
	key: string
	modifiers?: ModifierAlias[]
}

/** 元素工具 */
export const ElementToolTypeEnum = {
	FillColor: "fill-color", // 填充颜色
	StrokeColor: "stroke-color", // 描边颜色
	Size: "size", // 宽高尺寸(width, height)
	SizeSelect: "size-select", // 尺寸选择器
	FrameCreateButton: "frame-create-button", // 创建画框按钮
	FrameRemoveButton: "frame-remove-button", // 解除画框按钮
	FontFamily: "font-family", // 字体簇(font-family)
	FontStyle: "font-style", // 字体样式(font-style)
	FontSize: "font-size", // 字体大小(font-size)
	TextAlign: "text-align", // 对齐方式(align)
	ElementAlign: "element-align", // 元素对齐
	ElementDistribute: "element-distribute", // 元素分布
	ShapeStyle: "shape-style", // 图形样式配置
	DownloadButton: "download-button", // 下载按钮
	TextAdvancedButton: "text-advanced-button", // 文本高级按钮
	ImageConvertHightButton: "image-convert-hight-button", // 转高清按钮
	ImageConvertHight: "image-convert-hight", // 转高清配置
} as const

/** 元素工具类型 */
export type ElementToolType = (typeof ElementToolTypeEnum)[keyof typeof ElementToolTypeEnum]

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
	/** 选择指定的 marker（传入 null 可取消选择） */
	selectMarker: (markerId: string | null) => void
	/** 聚焦到指定元素 */
	focusElement: (
		elementIds: string[],
		options?: {
			selectElement?: boolean | string[]
			animated?: boolean
			padding?: PaddingConfig
			panOnly?: boolean
			/** 当 viewport 放大导致元素无法完全显示时，是否自动缩小以完整展示元素（默认: true） */
			ensureFullyVisible?: boolean
		},
	) => void
	/** 适配屏幕 */
	fitToScreen: () => void
	/** 热更新画布数据（智能差异更新，保留当前状态） */
	updateData: (data: CanvasDocument) => void
	/** 如果元素不在可视区域，则移动到可视区域 */
	ensureElementVisible: (
		elementId: string,
		options?: {
			animated?: boolean
			padding?: PaddingConfig
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
	magic?: {
		/** 方法集合（用于图片生成等） */
		methods?: CanvasDesignMethods
		/** Magic 权限配置 */
		permissions?: MagicPermissions
	}
	/** 数据 配置 */
	data?: {
		/** 默认画布数据，用于初始化画布 */
		defaultData?: CanvasDocument
		/** 画布数据变化回调 */
		onCanvasDesignDataChange?: (canvasData: CanvasDocument) => void
		/** 项目 images 目录下的图片列表，用于 @ 面板 */
		imageFilesForMention?: ImageFileForMention[]
		/** Mention 数据服务构造函数，由外部传入以实现隔离 */
		mentionDataServiceCtor?: MentionDataServiceCtor
		/** Mention 扩展类（通过依赖注入传入，实现组件隔离） */
		mentionExtension?: unknown
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
		/** marker 选中状态变化回调 */
		onMarkerSelectChange?: (markerId: string | null) => void
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
}

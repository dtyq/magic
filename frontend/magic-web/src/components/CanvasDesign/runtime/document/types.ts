import type {
	GenerateImageRequest,
	CanvasDesignMethods,
	MagicPermissions,
	ImageGenerationTaskMeta,
	IdentifyImageMarkResponse,
	GenerateVideoRequest,
	VideoGenerationResultMeta,
	GenerationStatus,
	CanvasAssetComplianceStatus,
	StoredVideoEditorDraft,
} from "../../public/magic-types"
import type { TFunction } from "../../public/i18n-types"
import type { CanvasAccessMode, CanvasCapability } from "../../public/props"
import type { NameLabelIconResolver } from "../interaction/labels/nameLabelTypes"

/** 裁剪矩形配置 */
export interface CropConfig {
	/** 宽度 */
	width: number
	/** 高度 */
	height: number
	/** 横坐标 */
	x: number
	/** 纵坐标 */
	y: number
	/** 裁剪编辑态下的完整显示宽度 */
	displayWidth?: number
	/** 裁剪编辑态下的完整显示高度 */
	displayHeight?: number
}

/** 裁剪信息（不包含显示宽高） */
export type CropConfigWithoutDisplaySize = Omit<CropConfig, "displayWidth" | "displayHeight">

/** 扩展编辑框配置 */
export interface ExtendFrameConfig {
	/** 宽度 */
	width: number
	/** 高度 */
	height: number
	/** 横坐标 */
	x: number
	/** 纵坐标 */
	y: number
}

/** 扩展编辑态会话数据 */
export interface ExtendSession {
	/** 进入扩展会话时锁定的图片 Content，避免异步确认写错版本。 */
	contentId?: string
	frame: ExtendFrameConfig
}

/**
 * Canvas配置
 */
export type CanvasDeviceFormFactor = "phone" | "tablet" | "desktop"

export type CanvasDeviceLayout = "compact" | "regular"

export interface CanvasDeviceInfo {
	formFactor: CanvasDeviceFormFactor
	layout: CanvasDeviceLayout
	input: {
		touch: boolean
		coarsePointer: boolean
		hover: boolean
	}
}

export interface CanvasConfig {
	/** 用于挂载Konva画布的DOM元素 */
	element: HTMLDivElement
	/** 交互作用域根节点，仅在该范围内处理画布外点击 */
	scopeElement?: HTMLElement
	/** 设计项目 ID，用于隔离画布级缓存、SW 离线资源与跨画布粘贴校验 */
	id: string
	accessMode?: CanvasAccessMode
	capabilities?: Partial<Record<CanvasCapability, boolean>>
	/** Magic 配置 */
	magic?: {
		methods?: CanvasDesignMethods
		permissions?: MagicPermissions
	}
	/** Plugin configuration injected by the host application. */
	plugins?: CanvasDesignPluginModuleConfig
	/** 可选的名称标签图标 resolver；不传时名称标签保持纯文本。 */
	nameLabelIconResolver?: NameLabelIconResolver
	/** 获取设备形态、布局和输入能力，如果未提供则使用默认检测 */
	getDevice?: () => CanvasDeviceInfo
	/** 翻译函数 */
	t?: TFunction
}

/** 画布工具 */
export const ToolTypeEnum = {
	Select: "select", // 选择工具
	Hand: "hand", // 抓手工具
	Text: "text", // 文本
	Frame: "frame", // 画框
	ImageGenerator: "image-generator", // 图像生成
	VideoGenerator: "video-generator", // 视频生成
	AudioGenerator: "audio-generator", // 音频生成
	Marker: "Marker", // 标记
	Rect: "rect", // 矩形形状
	Ellipse: "ellipse", // 圆形形状
	Triangle: "triangle", // 三角形形状
	Star: "star", // 星形形状
} as const

/** 画布工具类型 */
export type ToolType = (typeof ToolTypeEnum)[keyof typeof ToolTypeEnum]

/** 工具快捷键 */
export type ToolKey = "v" | "h" | "t" | "f" | "a" | "m" | "space"

/** 工具快捷键事件 */
export type ToolKeyEvent = ToolKey | `${ToolKey}-up`

/** 元素类型枚举 */
export const ElementTypeEnum = {
	/** 画框 */
	Frame: "frame",
	/** 组 */
	Group: "group",
	/** 图片 */
	Image: "image",
	/** 文本 */
	Text: "text",
	/** 矩形 */
	Rectangle: "rectangle",
	/** 圆形 */
	Ellipse: "ellipse",
	/** 三角形 */
	Triangle: "triangle",
	/** 星形 */
	Star: "star",
	/** 视频 */
	Video: "video",
	/** 音频 */
	Audio: "audio",
	/** 分镜 */
	Storyboard: "storyboard",
	/** 视频编辑 */
	VideoEdit: "video-edit",
} as const

/** 元素类型 */
export type ElementType = (typeof ElementTypeEnum)[keyof typeof ElementTypeEnum]

/** 可直接替换资源的画布媒体元素类型。 */
export type MediaElementType =
	typeof ElementTypeEnum.Image | typeof ElementTypeEnum.Video | typeof ElementTypeEnum.Audio

/** 边框位置类型 */
export type StrokePosition = "inside" | "center" | "outside"

/** 交互配置 */
export interface InteractionConfig {
	/** 填充是否透明 */
	fillTransparent?: boolean
	/** 填充颜色格式 */
	fillColorMode?: "hex" | "rgb" | "hsl"
	/** 描边是否透明 */
	strokeTransparent?: boolean
	/** 描边颜色格式 */
	strokeColorMode?: "hex" | "rgb" | "hsl"
	/** 描边位置 */
	strokePosition?: StrokePosition
	/** 是否锁定宽高比 */
	aspectRatioLocked?: boolean
	/** 是否允许作为连接线起点/终点；Group 等纯编组容器固定不可连接 */
	connectable?: boolean
}

/** 基础元素属性 */
export interface BaseElementProps {
	/** 元素唯一标识 */
	id: string
	/** 元素名称 */
	name?: string
	/** 元素类型 */
	type: ElementType
	/** 是否可见 */
	visible?: boolean
	/** 是否锁定 */
	locked?: boolean
	/** 透明度 0-1 */
	opacity?: number
	/** 元素位置 */
	x?: number
	/** 元素位置 */
	y?: number
	/** 元素宽度 */
	width?: number
	/** 元素高度 */
	height?: number
	/** 水平缩放比例 */
	scaleX?: number
	/** 垂直缩放比例 */
	scaleY?: number
	/** 图层层级，数值越大越靠上，默认为 0 */
	zIndex?: number
	/** 交互配置 */
	interactionConfig?: InteractionConfig
}

/** 节点内容的最小公共结构。内容类型由所属 Element 的顶层 type 决定。 */
export interface ElementContentBase {
	contentId: string
}

/** 所有 v3 节点统一使用的内容容器结构。 */
export interface ContentElementProps<TContent extends ElementContentBase> extends BaseElementProps {
	/** 当前渲染和编辑的内容 */
	activeContentId: string | null
	/** 提供给连接、导出和下游任务的稳定内容 */
	mainContentId: string | null
	/** 按创建顺序保存的内容列表 */
	contents: TContent[]
}

export interface FrameElementContent extends ElementContentBase {}

export interface GroupElementContent extends ElementContentBase {}

/** 画框元素 */
export interface FrameElement extends ContentElementProps<FrameElementContent> {
	type: typeof ElementTypeEnum.Frame
	/** 子元素 */
	children?: LayerElement[]
}

/** 组元素 */
export interface GroupElement extends ContentElementProps<GroupElementContent> {
	type: typeof ElementTypeEnum.Group
	/** 子元素 */
	children?: LayerElement[]
}

export interface ShapeElementContent extends ElementContentBase {
	/** 填充色 */
	fill?: string
	/** 描边色 */
	stroke?: string
	/** 描边宽度 */
	strokeWidth?: number
	/** 圆角半径 */
	cornerRadius?: number
}

/** 矩形元素 */
export interface RectangleElement extends ContentElementProps<ShapeElementContent> {
	type: typeof ElementTypeEnum.Rectangle
}

/** 星形元素 */
export interface StarElementContent extends ShapeElementContent {
	/** 边数 */
	sides?: number
	/** 内凹比例（0-1） */
	innerRadiusRatio?: number
}

export interface StarElement extends ContentElementProps<StarElementContent> {
	type: typeof ElementTypeEnum.Star
}

/** 圆形元素 */
export interface EllipseElement extends ContentElementProps<ShapeElementContent> {
	type: typeof ElementTypeEnum.Ellipse
}

/** 三角形元素 */
export interface TriangleElement extends ContentElementProps<ShapeElementContent> {
	type: typeof ElementTypeEnum.Triangle
}

/** 富文本样式 */
export interface TextStyle {
	/** 字体大小 */
	fontSize?: number
	/** 字体粗细 */
	fontWeight?: number | string
	/** 字体颜色 */
	color?: string
	/** 字体家族 */
	fontFamily?: string
	/** 是否加粗 */
	bold?: boolean
	/** 是否斜体 */
	italic?: boolean
	/** 是否下划线 */
	underline?: boolean
	/** 是否删除线 */
	strikethrough?: boolean
	/** 背景色 */
	backgroundColor?: string
	/** 字母间距 */
	letterSpacing?: number
}

/** 富文本文本节点 */
export interface RichTextNode {
	/** 节点类型 */
	type: "text"
	/** 文本内容 */
	text: string
	/** 文本样式 */
	style?: TextStyle
}

/** 富文本段落 */
export interface RichTextParagraph {
	/** 段落内容节点 */
	children?: RichTextNode[]
	/** 段落样式 */
	style?: {
		/** 文本对齐 */
		textAlign?: "left" | "center" | "right"
		/** 行高 */
		lineHeight?: number
		/** 段落间距 */
		paragraphSpacing?: number
		/** 列表类型 */
		listType?: "bullet" | "ordered"
	}
}

export interface TextElementContent extends ElementContentBase {
	/** 富文本内容（段落数组） */
	content?: RichTextParagraph[]
	/** 默认文本样式（作为基础样式） */
	defaultStyle?: TextStyle
}

/** 文本元素 */
export interface TextElement extends ContentElementProps<TextElementContent> {
	type: typeof ElementTypeEnum.Text
}

/** 图片节点中可独立切换的内容 */
export interface ImageElementContent extends ElementContentBase {
	/** 人工废稿标记，仅属于此版本，不改变生成状态或主版本。 */
	discarded?: boolean
	/** 只用于等待超时展示，不改变后端生成状态；任务更换时独立计时。 */
	generationTiming?: {
		startedAt: number
		imageId?: string
		source: "submitted" | "server" | "observed"
	}
	/** 大模型对当前图片 Content 的理解结果；重字段由 sidecar 拆分保存。 */
	visualUnderstanding?: unknown
	/** 图片源(用来换取 ossSrc 的临时 path) */
	src?: string
	/** 当前图片 Content 绑定的素材库资产 ID；不替代 src。 */
	assetId?: string
	/** 未绑定素材时，元素自己记录的合规状态。已绑定 assetId 后以素材服务为准。 */
	complianceStatus?: CanvasAssetComplianceStatus
	/** 未绑定素材时的合规失败原因。 */
	complianceFailedReason?: string | null
	/** 旧版 workspace 合规流程的检查字段；新流程创建素材后统一写入 assetId。 */
	complianceCheckId?: string
	/** 状态 */
	status?: GenerationStatus
	/** 错误信息 */
	errorMessage?: string
	/** 图片生成请求参数（请求成功后保存） */
	generateImageRequest?: GenerateImageRequest
	/** 图片生成任务元数据（用于高清放大 / 去背景 / 橡皮擦 / 扩图） */
	imageGenerationTaskMeta?: ImageGenerationTaskMeta
	/** 源图裁剪区域 */
	crop?: CropConfig
}

export interface ImageElement extends ContentElementProps<ImageElementContent> {
	type: typeof ElementTypeEnum.Image
}

export interface VideoElementContent extends ElementContentBase {
	/** 大模型对当前视频 Content 的理解结果；重字段由 sidecar 拆分保存。 */
	visualUnderstanding?: unknown
	/** 视频源(用来换取 ossSrc 的临时 path) */
	src?: string
	/** 当前视频 Content 绑定的素材库资产 ID；不替代 src。 */
	assetId?: string
	/** 未绑定素材时，元素自己记录的合规状态。已绑定 assetId 后以素材服务为准。 */
	complianceStatus?: CanvasAssetComplianceStatus
	/** 未绑定素材时的合规失败原因。 */
	complianceFailedReason?: string | null
	/** 旧版 workspace 合规流程的检查字段；新流程创建素材后统一写入 assetId。 */
	complianceCheckId?: string
	/** 视频状态 */
	status?: GenerationStatus
	/** 错误信息 */
	errorMessage?: string
	/** 海报源(用来换取 ossSrc 的临时 path) （暂未支持） */
	// poster?: string
	/** 视频生成请求参数（请求成功后保存） */
	generateVideoRequest?: GenerateVideoRequest
	/** 未提交的视频编辑配置，用于重新打开画布后恢复输入。 */
	videoEditorDraft?: StoredVideoEditorDraft
	/** 视频生成结果元信息（计费、生成参数与运行时间） */
	videoGenerationResultMeta?: VideoGenerationResultMeta
}

/** 视频元素 */
export interface VideoElement extends ContentElementProps<VideoElementContent> {
	type: typeof ElementTypeEnum.Video
}

export interface AudioElementContent extends ElementContentBase {
	/** 音频源（用来换取可播放 URL 的临时 path） */
	src?: string
	/** 当前音频 Content 绑定的素材库资产 ID；不替代 src。 */
	assetId?: string
}

/** 音频元素（仅支持上传资源，不持久化播放或上传状态） */
export interface AudioElement extends ContentElementProps<AudioElementContent> {
	type: typeof ElementTypeEnum.Audio
}

/** 分镜单镜头 */
export interface StoryboardShot {
	/** 镜头唯一标识 */
	id: string
	/** 画面描述 */
	description: string
	/** 稳定关联的输出图片元素 ID；缺省表示尚未创建输出元素 */
	outputImageElementId?: string
}

/** 分镜统一使用的图片生成配置 */
export type StoryboardGenerationConfig = Pick<
	GenerateImageRequest,
	"model_id" | "size" | "resolution" | "image_generation_config"
>

export interface StoryboardElementContent extends ElementContentBase {
	/** 对全部分镜生效的图片生成配置 */
	generationConfig?: StoryboardGenerationConfig
	/** 按展示顺序保存的分镜列表；文档校验与元素工厂会保证运行态存在 */
	shots?: StoryboardShot[]
}

/** 分镜元素 */
export interface StoryboardElement extends ContentElementProps<StoryboardElementContent> {
	type: typeof ElementTypeEnum.Storyboard
}

export interface VideoEditElementContent extends ElementContentBase {
	/** 按编辑顺序排列的视频元素 ID；成员资格仍由 CanvasConnection 表达。 */
	videoSequence?: string[]
	/** 按编辑顺序排列的音频元素 ID；成员资格仍由 CanvasConnection 表达。 */
	audioSequence?: string[]
}

/** 视频编辑节点；输入成员由 CanvasConnection 表达，顺序由 Content 中的 sequence 表达。 */
export interface VideoEditElement extends ContentElementProps<VideoEditElementContent> {
	type: typeof ElementTypeEnum.VideoEdit
}

/** 所有节点 Content 的联合类型；Content 本身不重复保存节点 type。 */
export type ElementContent =
	| FrameElementContent
	| GroupElementContent
	| ShapeElementContent
	| StarElementContent
	| TextElementContent
	| ImageElementContent
	| VideoElementContent
	| AudioElementContent
	| StoryboardElementContent
	| VideoEditElementContent

/** 可上传/下载的文件类元素（图片、视频、音频），用于 uploadFiles / downloadFiles 等接口 */
export type CanvasFileElement = ImageElement | VideoElement | AudioElement

/** 图层元素联合类型 */
export type LayerElement =
	| FrameElement
	| GroupElement
	| RectangleElement
	| StarElement
	| EllipseElement
	| TriangleElement
	| TextElement
	| ImageElement
	| VideoElement
	| AudioElement
	| StoryboardElement
	| VideoEditElement

/**
 * ElementManager 的业务更新契约。
 *
 * 外壳字段直接合并到 Element；Content 业务字段由 ElementManager 路由到提交时的
 * active Content。id/type 不属于该类型，运行时仍会防御 JavaScript 调用绕过类型的情况。
 */
export type ElementUpdatePatch = Partial<Omit<BaseElementProps, "id" | "type">> &
	Partial<
		Pick<
			ContentElementProps<ElementContentBase>,
			"contents" | "activeContentId" | "mainContentId"
		>
	> & {
		children?: LayerElement[]
	} & Partial<
		Omit<ImageElementContent, "contentId"> &
			Omit<VideoElementContent, "contentId"> &
			Omit<AudioElementContent, "contentId"> &
			Omit<TextElementContent, "contentId"> &
			Omit<ShapeElementContent, "contentId"> &
			Omit<StarElementContent, "contentId"> &
			Omit<StoryboardElementContent, "contentId"> &
			Omit<VideoEditElementContent, "contentId">
	>

/** 视口状态 */
export interface ViewportState {
	/** 缩放比例 (0.1 - 2.0) */
	scale: number
	/** 画布 X 偏移 */
	x: number
	/** 画布 Y 偏移 */
	y: number
}

/** 标记类型枚举 */
export const MarkerTypeEnum = {
	/** 标记 */
	Mark: 1,
	/** 区域 */
	Area: 2,
} as const

/** 标记类型 */
export type MarkerType = (typeof MarkerTypeEnum)[keyof typeof MarkerTypeEnum]

/** 标记数据结构（包含位置和识别信息） */
export interface MarkerCommon {
	/** 标记唯一标识 */
	id: string
	/** 文件路径 */
	filePath?: string
	/** 关联的元素ID */
	elementId: string
	/** Marker 创建时绑定的图片 Content ID */
	contentId?: string
	/** 标记创建/更新时对应的图片裁剪信息 */
	elementCrop?: CropConfigWithoutDisplaySize
	/** 标记在元素内的相对X位置（0-1，相对于元素宽度的比例） */
	relativeX: number
	/** 标记在元素内的相对Y位置（0-1，相对于元素高度的比例） */
	relativeY: number
	/** 标记识别图片信息 */
	result?: IdentifyImageMarkResponse
	/** 选中下标 */
	selectedSuggestionIndex?: number
	/** 错误信息 */
	error?: string
}

/** 标记点 */
export interface MarkerPoint extends MarkerCommon {
	/** 类型 */
	type: typeof MarkerTypeEnum.Mark
}

/** 区域标记 */
export interface MarkerArea extends MarkerCommon {
	/** 类型 */
	type: typeof MarkerTypeEnum.Area
	/** 区域宽度 */
	areaWidth: number
	/** 区域高度 */
	areaHeight: number
}

/** 标记类型 */
export type Marker = MarkerPoint | MarkerArea

/**
 * 画布元素业务关联线。
 *
 * 该结构只表达持久化的因果语义：sourceElementId -> targetElementId。
 * 视觉上的左右连接点由渲染层根据元素位置实时计算，不写入画布 DSL。
 */
export interface CanvasConnection {
	/** 关联线唯一标识 */
	id: string
	/** 上游/原因/输入元素 ID；默认视觉承接方向为左到右 */
	sourceElementId: string
	/** 下游/结果/消费方元素 ID */
	targetElementId: string
}

/** 画布文档结构 */
export interface CanvasDocument {
	/** 元素 */
	elements?: LayerElement[]
	/** 元素业务关联线 */
	connections?: CanvasConnection[]
}

/**
 * 视口预留值类型：支持数值（像素）或百分比字符串，与 Padding 语义统一
 */
export type PaddingInsetValue = number | `${number}%`

/**
 * 视口预留配置
 * 支持数字与百分比字符串
 */
export interface PaddingInsetConfig {
	left?: PaddingInsetValue
	right?: PaddingInsetValue
	top?: PaddingInsetValue
	bottom?: PaddingInsetValue
	minLeft?: PaddingInsetValue
	minRight?: PaddingInsetValue
	minTop?: PaddingInsetValue
	minBottom?: PaddingInsetValue
	maxLeft?: PaddingInsetValue
	maxRight?: PaddingInsetValue
	maxTop?: PaddingInsetValue
	maxBottom?: PaddingInsetValue
}

/**
 * 视口预留后的智能对齐规则（由 padding 配置及解析后的 insets 推导）：
 * - 仅设置水平方向 padding 时，垂直居中、水平左对齐
 * - 仅设置垂直方向 padding 时，水平居中、垂直顶对齐
 * - 水平与垂直都设置时，根据两侧 inset 大小决定：哪侧 inset 更小则贴哪侧，相等则居中
 * - 都未设置时，水平垂直都居中
 */
export type ViewportPaddingAlignHorizontal = "left" | "center" | "right"
export type ViewportPaddingAlignVertical = "top" | "center" | "bottom"

export interface ViewportPaddingAlignment {
	horizontal: ViewportPaddingAlignHorizontal
	vertical: ViewportPaddingAlignVertical
}

/** 解析后的四边 inset（像素），用于智能对齐推导 */
export interface ViewportPaddingInsets {
	left: number
	right: number
	top: number
	bottom: number
}

export type CanvasDesignPluginSource = "builtin" | "user"

export type CanvasDesignPluginLocaleMessages = Record<string, string>

export type CanvasDesignPluginLocales = Record<string, CanvasDesignPluginLocaleMessages>

export interface CanvasDesignPluginCategory {
	key: string
	label?: string
}

export type CanvasDesignPluginCapability =
	| "ui.toast"
	| "ui.close"
	| "ui.setHeight"
	| "resources.resolve"
	| "assets.pickFiles"
	| "assets.uploadFile"
	| "assets.fetchBlob"
	| "ai.getImageModels"
	| "ai.generateAndPlace"
	| "ai.completeImagePrompt"
	| "plugin.storage"

export type CanvasDesignPluginRuntimeVersion = number

export interface CanvasDesignPluginConfig {
	name: string
	/** Runtime processor version. It selects CanvasDesign's versioned plugin handler, e.g. runtime/v1. */
	version: CanvasDesignPluginRuntimeVersion
	/** Single-character emoji or a relative path to a media asset inside the plugin package. */
	icon?: string
	category?: CanvasDesignPluginCategory
	tags?: string[]
	label: string
	description: string
	/** Relative path to the plugin runtime entry script. */
	entry: string
	/** Relative stylesheet path or paths inside the plugin package. */
	styles?: string | string[]
	/** Host capabilities the plugin is allowed to call through the runtime bridge. */
	capabilities?: string[]
	/** Browser-resolved runtime URL for built-in plugin iframe loading. */
	runtimeUrl?: string
	/** Browser-resolved base URL for resolving resources inside the plugin package. */
	resourceBaseUrl?: string
	/** Inline runtime script content for built-in or imported user plugins. */
	runtimeCode?: string
	/** Inline stylesheet content loaded from styles entries. */
	styleCode?: string[]
	/** Resolve a relative resource path inside the plugin package to a browser URL. */
	resolveResourceUrl?: (path: string) => string | Promise<string>
	/** Plugin locale messages declared in manifest.json. */
	locales?: CanvasDesignPluginLocales
}

export interface CanvasDesignPlugin extends CanvasDesignPluginConfig {
	/** Plugin source: built-in plugin or user plugin. */
	source: CanvasDesignPluginSource
}

export interface CanvasDesignUserPluginLoadConfig {
	/** Topic-file resource directory that contains user plugins, usually ./plugins. */
	rootPath: string
	/** Plugin folder names under rootPath. Each folder is one user plugin package. */
	directories?: string[]
}

export interface CanvasDesignPluginModuleConfig {
	/** Built-in plugins registered by the host application. */
	builtin?: CanvasDesignPlugin[]
	/** User plugins loaded from the topic-file resource directory. */
	user?: CanvasDesignUserPluginLoadConfig
}

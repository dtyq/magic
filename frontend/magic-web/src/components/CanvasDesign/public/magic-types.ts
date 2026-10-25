import type {
	Marker,
	ViewportState,
	CanvasFileElement,
	MarkerTypeEnum,
	CropConfig,
	ElementType,
} from "../runtime/document/types"
import type {
	CanvasResourceReferenceResolverSnapshot,
	ResolveCanvasResourceReference,
} from "./resource-reference"

// 附件来源
export const AttachmentSource = {
	DEFAULT: 0,
	// 1 和 2 为用户上传
	HOME: 1,
	PROJECT_DIRECTORY: 2,
	// Agent容器生成
	AGENT: 3,
	COPY: 4,
	/* AI生成文件 */
	AI: 5,
}

// 附件来源枚举值
export type AttachmentSourceEnum = (typeof AttachmentSource)[keyof typeof AttachmentSource]

/**
 * 模型状态枚举
 */
export type ImageModelStatus = "normal" | "disabled" | "deleted"

/**
 * 模型状态枚举值
 */
export const ImageModelStatus = {
	/** 正常 */
	Normal: "normal",
	/** 禁用 */
	Disabled: "disabled",
	/** 删除 */
	Deleted: "deleted",
} as const

/**
 * 图片/视频生成状态枚举
 */
export type GenerationStatus = "pending" | "processing" | "completed" | "failed" | "terminated"

/**
 * 图片/视频生成状态枚举值
 */
export const GenerationStatus = {
	/** 待处理 */
	Pending: "pending",
	/** 处理中 */
	Processing: "processing",
	/** 已完成 */
	Completed: "completed",
	/** 失败 */
	Failed: "failed",
	/** 已终止（用户终止任务 / 任务转向，节点保留） */
	Terminated: "terminated",
} as const

/**
 * 生图模型项
 * CanvasDesign 内部定义的类型，用于完全隔离外部依赖
 */
export interface ImageModelGroupInfo {
	/** 分组ID */
	id: string
	/** 分组名称 */
	name: string
	/** 分组图标 */
	icon?: string
	/** 分组排序 */
	sort?: number
	/** 分组来源 */
	source?: "official" | "custom"
}

export interface ImageModelItem {
	/** 模型ID */
	id: string
	/** 分组ID */
	group_id: string
	/** 模型标识 */
	model_id: string
	/** 模型名称 */
	model_name: string
	/** 服务商模型ID */
	provider_model_id: string
	/** 模型描述 */
	model_description: string
	/** 模型图标 */
	model_icon: string
	/** 模型状态 */
	model_status: ImageModelStatus
	/** 排序 */
	sort: number
	/** 模型来源 */
	model_source?: "official" | "custom"
	/** 模型分组信息 */
	model_group?: ImageModelGroupInfo
	/** 图片尺寸配置 */
	image_size_config?: {
		/** 默认分辨率 */
		default_scale?: string
		/** 图片生成配置 */
		image_settings?: {
			/** 配置项 key, 如 "image_generation_config.quality" */
			key: string
			/** 配置项标签 */
			label: string
			/** 配置项描述 */
			description: string
			/** 组件类型 */
			component: "single_select"
			/** 组件变体 */
			variant: "segmented"
			/** 默认值 */
			default: string
			/** 选项列表 */
			options: {
				label: string
				value: string // "auto"、"high"、"medium"、"low"
			}[]
		}[]
		/** 最大参考图数量 */
		max_reference_images?: number
		/** 最大生成数量 */
		max_output_images?: number
		/** 尺寸列表 */
		sizes: {
			label: string // "1:1"
			value: string // "1024x1024"
			scale?: string // "2K"、"4K"
		}[]
	}
	/** 标签 */
	tags?: unknown[]
}

/**
 * 视频模型项
 * CanvasDesign 内部定义的类型，用于完全隔离外部依赖
 */
export interface VideoModelItem {
	/** 模型ID */
	id: string
	/** 分组ID */
	group_id: string
	/** 模型标识 */
	model_id: string
	/** 模型名称 */
	model_name: string
	/** 服务商模型ID */
	provider_model_id: string
	/** 模型描述 */
	model_description: string
	/** 模型图标 */
	model_icon: string
	/** 模型状态 */
	model_status: ImageModelStatus
	/** 排序 */
	sort: number
	/** 模型来源 */
	model_source?: "official" | "custom"
	/** 模型分组信息 */
	model_group?: ImageModelGroupInfo
	/** 视频生成能力配置 */
	video_generation_config?: VideoGenerationConfig
	/** 标签 */
	tags?: unknown[]
}

/** 视频输入模式 */
export type VideoInputMode =
	| "standard"
	| "image_reference"
	| "omni_reference"
	| "video_edit"
	| "keyframe_guided"
	| "draft_task"

/** 输入模式下允许提交的素材字段 */
export type VideoInputModeSupportedField =
	"reference_images" | "reference_videos" | "reference_audios" | "frames" | "draft_task"

/**
 * 模式级/变体级生成参数限制。
 *
 * 约定：
 * - 未下发某字段：沿用 `video_generation_config.generation` 顶层能力
 * - 下发空数组：该维度在当前模式/变体下不可选，前端应隐藏并避免提交
 */
export interface VideoGenerationConstraints {
	resolutions?: string[]
	aspect_ratios?: string[]
	durations?: number[]
	sizes?: VideoGenerationSizeOption[]
}

/** 素材数量约束 */
export interface VideoInputModeFieldLimit {
	min?: number
	max?: number
}

/** 同一 input_mode 下的素材组合约束 */
export interface VideoInputModeVariant {
	/** 组合编码，如 images_only / image_and_video */
	code?: string
	/** 组合说明文案，可直接展示 */
	description?: string
	/** 组合命中后各素材字段的 min/max 数量限制 */
	limits?: Partial<Record<VideoInputModeSupportedField, VideoInputModeFieldLimit>>
	/** 组合级生成参数限制，优先级高于 mode 级 */
	generation_constraints?: VideoGenerationConstraints
}

/** 参考图业务类型 */
export type VideoReferenceImageType = "asset" | "style"

/** 输入模式配置 */
export interface VideoInputModeConfig {
	/** 模式说明 */
	description?: string
	/** 当前模式允许提交的字段 */
	supported_fields?: VideoInputModeSupportedField[]
	/** 当前模式默认任务类型，如 standard/omni 通常为 generate，video_edit 通常为 edit */
	task?: GenerateVideoTask
	/** 参考图限制 */
	reference_images?: {
		max_count?: number
		reference_types?: VideoReferenceImageType[]
		style_supported?: boolean
	}
	/** omni 模式下所有参考素材总上限 */
	max_count?: number
	/** 模式内不同素材组合约束；命中逻辑由前端根据当前已上传素材动态匹配 */
	variants?: VideoInputModeVariant[]
	/** 模式级生成参数限制；若变体也下发限制，则优先使用变体限制 */
	generation_constraints?: VideoGenerationConstraints
	/**
	 * keyframe 模式下各帧槽位是否开放：`start` 为首帧、`end` 为尾帧。
	 * 例如 `['start', 'end']` 表示同时支持首帧与尾帧；仅 `['start']` 则只支持首帧。
	 */
	frame_roles?: Array<GenerateVideoFrameInput["role"]>
}

/**
 * input_modes 字典：
 * - 已知模式使用强类型（standard / omni_reference / video_edit / keyframe_guided ...）
 * - 同时允许后端下发新模式，避免前端因新增 mode 崩溃
 */
export type VideoInputModesMap = Partial<Record<VideoInputMode, VideoInputModeConfig>> & {
	[mode: string]: VideoInputModeConfig | undefined
}

/**
 * 视频模型 constraints（输入与参数组合约束）。
 *
 * 注意：历史/灰度数据里该字段可能为数组（如 `[]`），因此做宽松兼容。
 */
export interface VideoGenerationConfigConstraints {
	/** 使用参考图时要求的时长。可能是开关（true）或指定秒数（如 8） */
	reference_images_requires_duration_seconds?: boolean | number
	/** 高分辨率时要求的时长。可能是开关（true）或指定秒数 */
	high_resolution_requires_duration_seconds?: boolean | number
	/** 视频扩展任务的输出分辨率 */
	video_extension_output_resolution?: string
}

/** 参考图能力配置（部分模型可能异常下发为空数组） */
export interface VideoReferenceImagesConfig {
	/** 参考图最大张数 */
	max_count?: number
	/** 允许的参考图类型 */
	reference_types?: VideoReferenceImageType[]
	/** 是否支持风格类参考 */
	style_supported?: boolean
}

/** 视频生成可选输出尺寸（宽高比与分辨率的像素组合，与后端下发对齐） */
export interface VideoGenerationSizeOption {
	/** 宽高比标签，如 16:9 */
	label: string
	/** 像素串，如 1280x720 */
	value: string
	width: number
	height: number
	/** 分辨率档位，如 720p、1080p、4k */
	resolution: string
}

/** 视频生成时长范围（秒） */
export interface VideoGenerationDurationRange {
	min: number
	max: number
	step: number
}

export type VideoGenerationDurations = number[] | VideoGenerationDurationRange
export interface VideoGenerationSwitchConfig {
	type: "switch"
	default: boolean
	name: string
	description?: string
	/** 开关启用时进一步收窄当前模式可选的生成参数。 */
	constraints?: VideoGenerationConstraints
}
/**
 * 视频模型元数据：能力、可选生成参数与约束
 */
export interface VideoGenerationConfig {
	/** 模型支持的原始输入能力标识（用于保留后端元数据） */
	supported_inputs?: string[]
	/** 后端下发的输入模式与每模式下的字段约束 */
	input_modes?: VideoInputModesMap
	/** 参考图能力与限制 */
	reference_images?: VideoReferenceImagesConfig | []
	/** 生成侧可选参数（宽高比、分辨率、时长等） */
	generation?: {
		/** 可选宽高比列表，如 16:9 */
		aspect_ratios?: string[]
		/** 可选时长（秒）；离散选项或范围 */
		durations?: VideoGenerationDurations
		/** 时长选择模式；未下发时由 durations 结构推导 */
		duration_type?: "options" | "range"
		/** 默认时长（秒） */
		default_duration_seconds?: number
		/** 是否生成音频 */
		generate_audio?: VideoGenerationSwitchConfig
		/** 是否启用网络搜索 */
		web_search?: VideoGenerationSwitchConfig
		/** 样片模式开关（仅由服务端声明该能力的模型支持）：先出低分辨率样片，再出正片 */
		draft?: VideoGenerationSwitchConfig
		/** 可选分辨率列表，如 1080p */
		resolutions?: string[]
		/** 可选输出尺寸（与 aspect_ratios、resolutions 组合一一对应时可优先使用） */
		sizes?: VideoGenerationSizeOption[]
		/** 默认分辨率 */
		default_resolution?: string
		/** 是否支持 seed */
		supports_seed?: boolean
		/** seed 合法区间 */
		seed_range?: [number, number]
		/** 是否支持负向提示词 */
		supports_negative_prompt?: boolean
		/** 是否支持生成音频 */
		supports_generate_audio?: boolean
		/** 是否支持人物生成相关选项 */
		supports_person_generation?: boolean
		/** 人物生成可选值 */
		person_generation_options?: string[]
		/** 是否支持提示词增强 */
		supports_enhance_prompt?: boolean
		/** 是否支持压缩质量 */
		supports_compression_quality?: boolean
		/** 压缩质量可选值 */
		compression_quality_options?: string[]
		/** 是否支持缩放模式 */
		supports_resize_mode?: boolean
		/** 缩放模式可选值 */
		resize_mode_options?: string[]
		/** 是否支持生成条数 */
		supports_sample_count?: boolean
		/** 生成条数合法区间 */
		sample_count_range?: [number, number]
	}
	/** 不同输入或参数组合的互斥、依赖约束 */
	constraints?: VideoGenerationConfigConstraints | []
}

/** 视频生成任务类型 */
export type GenerateVideoTask = "generate" | "extend" | "edit" | "upscale"

/** 单帧输入（首尾帧） */
export interface GenerateVideoFrameInput {
	/** 帧角色：首帧或尾帧 */
	role: "start" | "end"
	/** 资源 URI（PATH）；DSL 中存相对路径，发请求时会还原为工作区绝对路径 */
	uri: string
}

/** 参考图输入项 */
export interface GenerateVideoReferenceImageInput {
	/** 资源 URI；工作区路径发请求时还原为绝对路径，opaque asset URI 原样透传 */
	uri: string
	/** 参考图类型，如 asset / style */
	reference_type?: VideoReferenceImageType
}

/** 参考视频输入项 */
export interface GenerateVideoReferenceVideoInput {
	/** 资源 URI（PATH）；DSL 中存相对路径，发请求时会还原为工作区绝对路径 */
	uri: string
}

/** 参考音频输入项 */
export interface GenerateVideoReferenceAudioInput {
	/** 资源 URI（PATH）；DSL 中存相对路径，发请求时会还原为工作区绝对路径 */
	uri: string
}

/** 视频生成请求中的多模态输入 */
export interface GenerateVideoInputs {
	/** 首尾帧等帧序列 */
	frames?: GenerateVideoFrameInput[]
	/** 参考图列表；DSL 中存相对路径，发请求时会还原为工作区绝对路径 */
	reference_images?: GenerateVideoReferenceImageInput[]
	/** 参考视频列表 */
	reference_videos?: GenerateVideoReferenceVideoInput[]
	/** 参考音频列表 */
	reference_audios?: GenerateVideoReferenceAudioInput[]
	/** 源视频（扩展、编辑等） */
	video?: {
		/** 资源 URI（PATH）；DSL 中存相对路径，发请求时会还原为工作区绝对路径 */
		uri: string
	}
	/** 遮罩资源 */
	mask?: {
		/** 资源 URI（PATH）；DSL 中存相对路径，发请求时会还原为工作区绝对路径 */
		uri: string
	}
	/** 样片成片输入；优先使用业务 video_id，旧数据可回退工作区 URI。 */
	draft_task?: {
		video_id?: string
		uri?: string
	}
	/** 音频资源列表 */
	audio?: Array<{
		/** 资源 URI（PATH）；DSL 中存相对路径，发请求时会还原为工作区绝对路径 */
		uri: string
	}>
}

/** 单次视频生成的参数（与 inputs 并列） */
export interface GenerateVideoGeneration {
	/** 是否生成样片；样片视频在画布播放器中显示样片标识。 */
	draft?: boolean
	/** 宽高比，如 16:9 */
	aspect_ratio?: string
	/** 分辨率，如 1080p */
	resolution?: string
	/** 时长（秒） */
	duration_seconds?: number
	/** 随机种子 */
	seed?: number
	/** 负向提示词 */
	negative_prompt?: string
	/** 是否生成音频 */
	generate_audio?: boolean
	/** 是否启用网络搜索 */
	web_search?: boolean
	/** 是否以样片模式生成；仅在模型能力声明 draft 时发送 */
	draft?: boolean
	/** 人物生成策略 */
	person_generation?: string
	/** 是否增强提示词 */
	enhance_prompt?: boolean
	/** 压缩质量 */
	compression_quality?: string
	/** 缩放模式 */
	resize_mode?: string
	/** 生成样本数量 */
	sample_count?: number
}

/** 视频生成结果计费信息 */
export interface VideoGenerationBillingInfo {
	/** 本次生成消耗积分；null 表示后端未返回/无需展示 */
	points?: number | null
}

/** 视频生成结果参数信息 */
export interface VideoGenerationInfo {
	/** 任务类型 */
	task?: GenerateVideoTask | string
	/** 输入模式 */
	input_mode?: VideoInputMode | string
	/** 宽高比，如 16:9 */
	aspect_ratio?: string
	/** 分辨率，如 480p */
	resolution?: string
	/** 时长（秒） */
	duration_seconds?: number | null
}

/** 视频生成运行时间信息 */
export interface VideoGenerationRuntimeInfo {
	/** 开始时间，格式如 2026-06-25 14:32:08 */
	started_at?: string | null
	/** 完成时间，格式如 2026-06-25 14:36:20 */
	finished_at?: string | null
	/** 生成耗时（秒） */
	elapsed_seconds?: number | null
}

/** 画布保存的视频生成结果元信息 */
export interface VideoGenerationResultMeta {
	billing?: VideoGenerationBillingInfo | null
	generation_info?: VideoGenerationInfo | null
	runtime?: VideoGenerationRuntimeInfo | null
}

/**
 * 根存储中持久化的默认生视频偏好（非完整 API 请求体）
 */
export interface DefaultGenerateVideoConfig {
	/** 默认模型 id */
	model_id?: string
	/** 默认输入模式 */
	input_mode?: VideoInputMode
	/** 默认任务类型 */
	task?: GenerateVideoTask
	/** 默认宽高比与分辨率 */
	generation?: Pick<GenerateVideoGeneration, "aspect_ratio" | "resolution">
}

/**
 * 发起图片生成请求参数
 */
export interface GenerateImageRequest {
	/** 该版本的生成名称；最终文件名仍由生成结果确定。 */
	name?: string
	/** 项目 id */
	project_id?: string
	/** 图片 id */
	image_id?: string
	/** 模型 id */
	model_id?: string
	/** 提示词 */
	prompt?: string
	/** 大小，格式为: 宽度x高度，如: 1024x1024 */
	size?: string
	/** 分辨率（对应 scale 值） */
	resolution?: string
	/** 任务发起时间；建单后更新为后端返回的真实起点。 */
	start_time?: string
	/** 预期完成时间，后端写入的 ISO 8601 日期时间（如 2026-09-28T20:44:16+08:00），用于估算进度 */
	expected_finished_at?: string
	/** 文件目录，一定是本项目存在的目录 */
	file_dir?: string
	/** 参考图；DSL 中存相对路径，发请求时会还原为工作区绝对路径 */
	reference_images?: string[]
	/** 参考图参数 */
	reference_image_options?: ReferenceImageOptions
	/** 图片生成配置 */
	image_generation_config?: {
		[key: string]: string
	}
}

/**
 * 发起图片生成响应数据
 */
export interface GenerateImageResponse {
	/** 项目 id */
	project_id: string
	/** 图片 id */
	image_id: string
	/** 模型 id */
	model_id: string
	/** 提示词 */
	prompt: string
	/** 大小 */
	size: string
	/** 文件目录 */
	file_dir: string
	/** 文件名 */
	file_name: string
	/** 参考图 */
	reference_images: string[]
	/** 状态 */
	status: GenerationStatus
	/** 错误信息 */
	error_message: string | null
	/** 创建时间 */
	created_at: string
	/** 更新时间 */
	updated_at: string
	/** 文件 URL */
	file_url: string | null
	/** ID */
	id: string
	/** 任务发起时间（ISO 8601 日期时间），与 expected_finished_at 配对计算进度 */
	started_at?: string
	/** 预期完成时间（ISO 8601 日期时间），后端下发，用于估算进度；聊天工具卡用的是同一个值 */
	expected_finished_at?: string
}

export interface GeneratedImageResultItem {
	/** 结果序号，从 1 开始 */
	index: number
	/** 文件名 */
	file_name: string
	/** 文件 URL */
	file_url: string | null
}

/**
 * 发起多图生成请求参数
 */
export interface GenerateImagesRequest extends GenerateImageRequest {
	/** 本次请求生成图片数量 */
	generate_num: number
}

/**
 * 发起多图生成响应数据
 */
export interface GenerateImagesResponse {
	/** 项目 id */
	project_id: string
	/** 图片任务 id */
	image_id: string
	/** 模型 id */
	model_id: string
	/** 提示词 */
	prompt: string
	/** 大小 */
	size: string
	/** 分辨率 */
	resolution?: string
	/** 文件目录 */
	file_dir: string
	/** 生成数量 */
	generate_num: number
	/** 状态 */
	status: GenerationStatus
	/** 错误信息 */
	error_message: string | null
	/** 已返回的图片列表 */
	images: GeneratedImageResultItem[]
	/** 任务发起时间（ISO 8601 日期时间），与 expected_finished_at 配对计算进度 */
	started_at?: string
	/** 预期完成时间（ISO 8601 日期时间），后端下发，用于估算进度 */
	expected_finished_at?: string
}

/**
 * AI 补全图片提示词请求参数
 */
export interface CompleteImagePromptRequest {
	/** 项目 id */
	project_id?: string
	/**
	 * 当前场景拼装后的用户提示词。
	 *
	 * 推荐使用后端建议的 5 段结构：
	 * 1. 任务目标：说明要生成、补全或优化哪类生图提示词
	 * 2. 当前输入：用户输入框已有内容；为空时写“用户当前未填写”
	 * 3. 参考图角色：说明参考图用于主体 / 风格 / 背景 / 构图 / 材质 / 分别套用等
	 * 4. 业务限制：当前场景必须遵守的限制，保持简短
	 * 5. 补全方向：希望补充的画面维度
	 *
	 * 示例：
	 * 任务目标：为商品换背景的文生背景输入框生成或补全一段背景提示词。
	 * 当前输入：用户当前未填写
	 * 参考图角色：共有 1 张商品图，用于理解商品类别、材质、颜色、软硬属性和商业气质；这些商品会分别生成图片，不会放进同一张图。
	 * 业务限制：背景应适合“自动摆放”；不要描述商品之间的搭配、并排或同框关系；不要改变商品本身颜色、款式、logo、图案或材质。
	 * 补全方向：补充一个具体可拍摄的商业摄影背景，包括空间、材质、少量道具、光线、色彩氛围、构图留白和物理承托关系。
	 */
	user_prompt: string
	/** 可选模型 id */
	model_id?: string
	/** 参考图 */
	reference_images?: string[]
	/** 参考图参数 */
	reference_image_options?: ReferenceImageOptions
}

/**
 * AI 补全图片提示词响应
 */
export interface CompleteImagePromptResponse {
	/** 最终可直接写入输入框的提示词 */
	prompt: string
}

/**
 * AI 优化文本内容请求参数
 */
export interface CompleteTextContentRequest {
	/** 当前场景拼装后的用户提示词 */
	user_prompt: string
	/** 可选模型 id */
	model_id?: string
}

/**
 * AI 优化文本内容响应
 */
export interface CompleteTextContentResponse {
	/** 最终可直接写入文本元素的内容 */
	text: string
}

/** 单条参考图参数 */
export interface ReferenceImageOptionEntry {
	path: string
	/** 基于源图像素的裁剪区 */
	crop?: Pick<CropConfig, "width" | "height" | "x" | "y">
}

/** 参考图参数列表 */
export type ReferenceImageOptions = ReferenceImageOptionEntry[]

/**
 * 发起去背景请求参数
 */
export interface RemoveBackgroundRequest {
	/** 项目 id */
	project_id?: string
	/** 图片任务 id（客户端生成 uuid） */
	image_id?: string
	/** 文件目录；省略时由宿主解析为当前设计项目下的 `images` 目录（与生图一致） */
	file_dir?: string
	/** 待去背景的图片文件路径(原图片的ImageElementData.src) */
	file_path?: string
	/** 新图尺寸，如 1024x1024 */
	size?: string
	/** 参考图参数 */
	reference_image_options?: ReferenceImageOptions
}

/**
 * 发起橡皮擦除请求参数（与去背景同级，由宿主补全 project_id / file_dir）
 */
export interface EraserRequest {
	/** 项目 id */
	project_id?: string
	/** 图片任务 id（客户端生成 uuid） */
	image_id?: string
	/** 文件目录；省略时由宿主解析为当前设计项目下的 `images` 目录（与生图一致） */
	file_dir?: string
	/** 待擦除的图片文件路径（ImageElementData.src） */
	file_path?: string
	/** 标记图路径 */
	mark_path?: string
	/** 新图尺寸，如 1024x1024 */
	size?: string
	/** 参考图参数 */
	reference_image_options?: ReferenceImageOptions
}

/** 发起扩展图片生成请求参数 */
export interface GenerateExtendedImageRequest {
	/** 项目 id */
	project_id?: string
	/** 图片任务 id（客户端生成 uuid） */
	image_id?: string
	/** 文件目录；省略时由宿主解析为当前设计项目下的 `images` 目录（与生图一致） */
	file_dir?: string
	/** 待扩图的图片文件路径（ImageElementData.src） */
	file_path?: string
	/** 白底扩图合成图路径（白底扩展框 + 图片） */
	canvas_path?: string
	/** 白底位置蒙版图路径（白底扩展框 + 图片位置黑色矩形） */
	mask_path?: string
	/** 新图尺寸，如 1024x1024 */
	size?: string
	/** 参考图参数 */
	reference_image_options?: ReferenceImageOptions
}

export const ImageGenerationTaskTypeMap = {
	High: "high",
	RemoveBackground: "remove-background",
	Eraser: "eraser",
	Expand: "expand",
	Batch: "batch",
} as const

export type ImageGenerationTaskType =
	(typeof ImageGenerationTaskTypeMap)[keyof typeof ImageGenerationTaskTypeMap]

/**
 * 图片生成任务元数据
 * 用于持久化轮询、重试与部分 UI 回显所需的最小信息
 */
export interface ImageGenerationTaskMeta {
	/** 任务类型 */
	type: ImageGenerationTaskType
	/** 图片任务 id */
	image_id?: string
	/** 源文件路径 */
	file_path?: string
	/** 白底扩图合成图路径（扩图时使用） */
	canvas_path?: string
	/** 标记图路径（橡皮擦除时使用） */
	mark_path?: string
	/** 蒙版图路径（扩图时使用） */
	mask_path?: string
	/** 新图尺寸，如 1024x1024 */
	size?: string
	/** 参考图参数（高清 / 去背景 / 橡皮擦除 / 扩图） */
	reference_image_options?: ReferenceImageOptions
	/** 批量生成结果序号，从 1 开始 */
	output_index?: number
	/** 批量生成总数 */
	output_count?: number
}

/**
 * 发起高清图片生成请求参数
 */
export interface GenerateHightImageRequest {
	/** 项目 id */
	project_id?: string
	/** 图片 */
	image_id?: string
	/** 文件目录 */
	file_dir?: string
	/** 文件路径 */
	file_path?: string
	/** 大小，格式为: 宽度x高度，如: 1024x1024 */
	size?: string
	/** 参考图参数 */
	reference_image_options?: ReferenceImageOptions
}

/**
 * 发起高清图片生成响应数据
 */
export interface GenerateHightImageResponse extends GenerateImageResponse {}

/**
 * 发起视频生成请求参数
 */
export interface GenerateVideoRequest {
	/** 项目 id */
	project_id?: string
	/** 视频 id */
	video_id?: string
	/** 模型 id */
	model_id?: string
	/** 提示词 */
	prompt?: string
	/** 输入模式 */
	input_mode?: VideoInputMode
	/** 任务类型 */
	task?: GenerateVideoTask
	/** 文件目录 */
	file_dir?: string
	/** 文件名 */
	file_name?: string
	/** 输入素材 */
	inputs?: GenerateVideoInputs
	/** 生成参数 */
	generation?: GenerateVideoGeneration
	/** 回调配置 */
	callbacks?: Record<string, unknown>
	/** 执行配置 */
	execution?: Record<string, unknown>
	/** 画布合成输入快照；数组顺序即合并顺序 */
	composition?: GenerateVideoComposition
	/** 扩展配置 */
	extensions?: {
		output_file_name?: string
		[key: string]: unknown
	}
	/** 画布合成任务类型 */
	generation_type?: "canvas_composition" | string
	/** 当前话题 id（画布合成任务使用） */
	topic_id?: string
}

export interface GenerateVideoCompositionInput {
	/** 项目文件根目录下的规范化绝对路径 */
	path: string
}

export interface GenerateVideoComposition {
	/** 按合并顺序排列的视频 */
	videos: GenerateVideoCompositionInput[]
	/** 按处理顺序排列的音频 */
	audios?: GenerateVideoCompositionInput[]
}

/**
 * 发起视频生成响应数据
 */
export interface GenerateVideoResponse {
	/** 项目 id */
	project_id: string
	/** 视频 id */
	video_id: string
	/** 模型 id */
	model_id: string | null
	/** 提示词 */
	prompt: string | null
	/** 输入模式 */
	input_mode?: VideoInputMode
	/** 任务类型 */
	task?: GenerateVideoTask
	/** 文件目录 */
	file_dir: string | null
	/** 文件名 */
	file_name: string | null
	/** 输入素材 */
	inputs?: GenerateVideoInputs
	/** 生成参数 */
	generation?: GenerateVideoGeneration
	/** 状态 */
	status: GenerationStatus
	/** 错误信息 */
	error_message: string | null
	/** 创建时间 */
	created_at: string
	/** 更新时间 */
	updated_at: string
	/** 文件 URL */
	file_url: string | null
	/** 画布合成任务类型 */
	generation_type?: "canvas_composition" | string
	/** ID */
	id: string
}

/**
 * 视频积分预估明细
 */
export interface EstimateVideoPointsDetail {
	/** 计费模式 */
	mode?: string
	[key: string]: unknown
}

/**
 * 视频积分预估响应数据
 */
export interface EstimateVideoPointsResponse {
	/** 资源类型 */
	resource_type?: string
	/** 预估积分 */
	points: number
	/** 预估明细 */
	detail?: EstimateVideoPointsDetail
}

/**
 * 图片源尺寸
 */
export interface CanvasImageSourceDimensions {
	width: number
	height: number
}

/**
 * 下载图片选项
 */
export interface DownloadImageOptions {
	sourceDimensionsByElementId?: Record<string, CanvasImageSourceDimensions>
	/** 下载模式由菜单语义决定：default 对齐项目文件普通下载，normal 为 AI 带水印。 */
	downloadMode?: "default" | "normal"
}

/**
 * 获取高清图片生成配置响应数据
 */
export interface GetConvertHightConfigResponse {
	/** 后台是否开启转高清能力 */
	enabled: boolean
	/** 支持的尺寸配置列表 */
	image_size_config?: {
		sizes: {
			/** 尺寸比例标签，如 "1:1", "16:9" */
			label: string
			/** 尺寸值，格式为 "宽度x高度"，如 "1024x1024" */
			value: string
			/** 分辨率等级，如 "1K", "2K", "4K" */
			scale: string | null
		}[]
	}
}

/** 获取 AI 能力可用性响应数据 */
export interface AiAbilityAvailability {
	abilities: {
		/** 是否支持 Seedance 合规校验。关闭时元素菜单和素材库操作菜单都不提供该操作。 */
		volcengine_ark_assets?: {
			enabled?: boolean
		}
		image_convert_high: GetConvertHightConfigResponse
		image_remove_background: {
			enabled: boolean
		}
		image_eraser: {
			enabled: boolean
		}
		image_expand: {
			enabled: boolean
		}
	}
}

/**
 * 查询图片生成结果请求参数
 */
export interface GetImageGenerationResultParams {
	/** 项目 id */
	project_id?: string
	/** 图片 id */
	image_id?: string
}

/**
 * 查询图片生成结果响应数据
 */
export interface ImageGenerationResultResponse {
	/** 项目 id */
	project_id: string
	/** 图片 id */
	image_id: string
	/** 模型 id */
	model_id: string
	/** 提示词 */
	prompt: string
	/** 大小 */
	size: string
	/** 文件目录 */
	file_dir: string
	/** 文件名 */
	file_name: string
	/** 参考图 */
	reference_images: string[]
	/** 状态 */
	status: GenerationStatus
	/** 错误信息 */
	error_message: string | null
	/** 创建时间 */
	created_at: string
	/** 更新时间 */
	updated_at: string
	/** 文件 URL */
	file_url: string
	/** ID */
	id: string
	/** 任务发起时间（ISO 8601 日期时间），与 expected_finished_at 配对计算进度 */
	started_at?: string
	/** 预期完成时间（ISO 8601 日期时间），用于估算进度 */
	expected_finished_at?: string
}

/**
 * 查询多图生成结果请求参数
 */
export interface GetImageGenerationResultsParams {
	/** 项目 id */
	project_id: string
	/** 图片任务 id */
	image_id: string
}

/**
 * 查询多图生成结果响应数据
 */
export interface ImageGenerationResultsResponse {
	/** 项目 id */
	project_id: string
	/** 图片任务 id */
	image_id: string
	/** 模型 id */
	model_id: string
	/** 提示词 */
	prompt: string
	/** 大小 */
	size: string
	/** 分辨率 */
	resolution?: string
	/** 文件目录 */
	file_dir: string
	/** 生成数量 */
	generate_num: number
	/** 状态：pending 待处理，processing 处理中，completed 已完成，failed 失败 */
	status: GenerationStatus
	/** 错误信息 */
	error_message: string | null
	/** 已返回的图片列表 */
	images: GeneratedImageResultItem[]
	/** 任务发起时间（ISO 8601 日期时间），与 expected_finished_at 配对计算进度 */
	started_at?: string
	/** 预期完成时间（ISO 8601 日期时间），用于估算进度 */
	expected_finished_at?: string
}

/**
 * 查询视频生成结果请求参数
 */
export interface GetVideoGenerationResultParams {
	/** 项目 id */
	project_id?: string
	/** 视频 id */
	video_id?: string
}

/**
 * 查询视频生成结果响应数据
 */
export interface VideoGenerationResultResponse {
	/** 项目 id */
	project_id: string
	/** 视频 id */
	video_id: string
	/** 模型 id */
	model_id: string | null
	/** 提示词 */
	prompt: string | null
	/** 任务类型 */
	task?: GenerateVideoTask
	/** 文件目录 */
	file_dir: string | null
	/** 文件名 */
	file_name: string | null
	/** 输入素材 */
	inputs?: GenerateVideoInputs
	/** 生成参数 */
	generation?: GenerateVideoGeneration
	/** 类型 */
	type: unknown
	/** 状态 */
	status: GenerationStatus
	/** 错误信息 */
	error_message: string | null
	/** 创建时间 */
	created_at: string
	/** 更新时间 */
	updated_at: string
	/** 文件 URL */
	file_url: string | null
	/** ID */
	file_id: string
	/** 海报文件 ID */
	poster_file_id: string
	/** 海报文件 URL */
	poster_file_url: string
	/** 计费信息 */
	billing?: VideoGenerationBillingInfo | null
	/** 生成参数信息 */
	generation_info?: VideoGenerationInfo | null
	/** 运行时间信息 */
	runtime?: VideoGenerationRuntimeInfo | null
	/** 画布合成任务类型 */
	generation_type?: "canvas_composition" | string
}

/**
 * 上传文件信息
 */
export interface GetFileInfoResponse {
	/** oss src */
	src: string
	/** 文件名称 */
	fileName: string
	/** 过期时间 格式为: 2026-03-03 11:14:03，可选（无则视为永不过期） */
	expires_at?: string
	/**
	 * 文件来源（与项目附件列表 FileItem.source 一致）
	 * 由路径解析到附件项时填充
	 */
	source?: AttachmentSourceEnum
	/** get-file-url 原始版本字段；当前 superMagic 可能返回 null */
	version?: string | null
	/**
	 * 稳定资源版本；由宿主根据强版本/hash 或附件元信息生成。
	 * CanvasDesign 只把它当作不透明 token，不依赖宿主 file_id。
	 */
	resource_version?: string
	/** 宿主附件更新时间；仅作为 resource_version 的来源之一，CanvasDesign 不直接依赖该字段 */
	updated_at?: string
	/** 压缩资源长度或附件大小；用于辅助版本判断 */
	content_length?: number
}

export type FileUrlRequestPriority = "critical" | "visible" | "near" | "background"

/** 资产库媒体类型。资产路径本身不携带媒体类型，类型必须来自资产元数据或显式引用。 */
export type CanvasAssetMediaType = "image" | "video" | "audio"

/** 资产库合规状态；仅在调用方明确要求合规的生成能力中参与前置校验。 */
export type CanvasAssetComplianceStatus = "UNVERIFIED" | "PROCESSING" | "PASS" | "FAILED"

/** 单素材异步合规轮询结果。 */
export interface CanvasAssetComplianceState {
	assetId: string
	status: CanvasAssetComplianceStatus
	failedReason: string | null
}

/** CanvasDesign 运行时使用的资产详情，不包含可持久化的 workspace 路径。 */
export interface CanvasAssetResourceInfo {
	/** 资产服务中的稳定 ID。 */
	assetId: string
	/** 由资产接口返回的媒体类型；null 表示接口暂未提供类型。 */
	mediaType: CanvasAssetMediaType | null
	/** 当前会话可用的签名资源地址；不得写入 Canvas 文档或离线缓存。 */
	fileUrl: string | null
	/** 后端可选返回的签名地址过期时间；旧后端缺失时保持 undefined。 */
	expiresAt?: string
	fileName?: string
	complianceStatus?: CanvasAssetComplianceStatus | null
	complianceFailedReason?: string | null
}

/** 请求宿主打开“保存到素材库”弹窗时携带的当前图片或视频信息。 */
export interface CanvasOpenSaveAssetDialogParams {
	/** 打开弹窗时捕获的媒体元素 ID。 */
	elementId: string
	/** 打开弹窗时捕获的媒体 Content ID。 */
	contentId: string
	/** Canvas 文档中保存的媒体路径，仅允许宿主可解析的工作区文件。 */
	path: string
	/** 用作弹窗默认值的素材名称。 */
	name?: string
}

/** 对已有工作区图片或视频发起合规校验；后端会创建素材并返回其 assetId。 */
export interface CanvasStartWorkspaceMediaComplianceParams {
	/** Canvas 文档中保存的媒体路径。 */
	path: string
	/** 发起工作区文件合规时使用的素材名称。 */
	name: string
}

/** 使用 file_key 对素材库已有 asset 发起合规，不写回画布 DSL。 */
export interface CanvasStartExistingAssetComplianceParams {
	assetId: string
	/** 素材库或 Canvas 详情中的 file_key；已有素材合规只允许该来源。 */
	fileKey?: string
	name?: string
}

/** 保存工作区媒体到素材库时由弹窗提交的可编辑信息。 */
export interface CanvasSaveAssetToLibraryParams extends CanvasOpenSaveAssetDialogParams {
	name: string
	description?: string | null
	userIds?: string[]
	departmentIds?: string[]
	tagIds?: string[]
}

/** 已有素材的元数据更新参数；不携带文件路径或文件内容。 */
export interface CanvasUpdateAssetParams {
	name: string
	description: string
	userIds?: string[]
	departmentIds?: string[]
	tagIds: string[]
}

export type CanvasLocalAssetUploadMode = "save" | "verify"

export interface CanvasAssetVisibilityTarget {
	id: string
	name: string
	type: "user" | "department"
}

/** 编辑已有素材时复用保存弹窗；素材文件本身始终保持不变。 */
export interface CanvasEditAssetTarget {
	assetId: string
	name: string
	description: string
	fileUrl: string | null
	mediaType: CanvasAssetMediaType | null
	visibility: "private" | "team"
	userIds?: string[]
	departmentIds?: string[]
	visibilityTargets?: CanvasAssetVisibilityTarget[]
	/** 未读取到授权明细时只允许编辑元数据和标签，避免误清权限。 */
	visibilityEditable?: boolean
	tagIds: string[]
}

/** 素材库卡片请求宿主打开编辑弹窗。提交仍由弹窗显式触发。 */
export interface CanvasOpenEditAssetDialogParams {
	asset: CanvasEditAssetTarget
	onUpdated: () => void
	onClosed: () => void
}

/** 素材库上传卡片选中本地文件后，请求宿主打开同一套保存弹窗。 */
export interface CanvasOpenSaveLocalAssetDialogParams {
	file: File
	mode: CanvasLocalAssetUploadMode
	onSaved: (asset: CanvasAssetResourceInfo) => void
	onClosed: () => void
}

/** 本地文件保存到素材库：先落入当前画布目录，再提交素材信息。 */
export interface CanvasSaveLocalAssetToLibraryParams {
	file: File
	mode: CanvasLocalAssetUploadMode
	name: string
	description?: string | null
	userIds?: string[]
	departmentIds?: string[]
	tagIds?: string[]
}

export interface CanvasFileResourceMeta {
	status: "exists" | "deleted" | "unknown"
	fileName?: string
	source?: AttachmentSourceEnum
	/** 宿主生成的不透明版本 token；CanvasDesign 资源同一性仍以规范化 path 为准 */
	resourceVersion?: string | null
	updatedAt?: string | null
	contentLength?: number | null
}

/** 上传子目录枚举值，内部用常量控制 images / videos / audios / plugins */
export const UploadSubDir = {
	Images: "images",
	Videos: "videos",
	Audios: "audios",
	Plugins: "plugins",
} as const

export type UploadSubDirType = (typeof UploadSubDir)[keyof typeof UploadSubDir]

/**
 * 上传文件项
 */
export interface UploadFile {
	/** 文件对象 */
	file: File
	/**
	 * 是否覆盖同名文件，默认为 false
	 * 如果为 true，则上传的文件会覆盖同名文件
	 * 如果为 false，则上传的文件会自动重命名
	 */
	overwrite?: boolean
	/** 上传子目录，使用 UploadSubDir.Images | UploadSubDir.Videos | UploadSubDir.Audios | UploadSubDir.Plugins */
	uploadSubDir: UploadSubDirType
	/** 单个文件上传完成回调 */
	onUploadComplete: (result: UploadFileResponse) => void
	/** 单个文件上传失败回调 */
	onUploadFailed: (error: Error) => void
	/** 上传开始回调（可选，保持既有宿主实现兼容） */
	onUploadStart?: () => void
	/** 单个文件上传进度回调，值为 0-100（可选） */
	onUploadProgress?: (progress: number) => void
}

/**
 * 上传交互选项
 */
export interface UploadFilesOptions {
	/** 是否显示成功提示，默认 true；画布内拖拽/粘贴等场景通常由元素状态承载反馈，可关闭 */
	showSuccessToast?: boolean
}

/**
 * 上传私有文件请求参数
 */
export interface UploadPrivateFile extends Omit<UploadFile, "overwrite" | "uploadSubDir"> {
	/** 相对路径 */
	relativePath: string
	/** 单个文件上传完成回调 */
	onUploadComplete: (result: UploadPrivateFileResponse) => void
}

/**
 * 上传文件响应（图片/视频等）
 */
export interface UploadFileResponse extends GetFileInfoResponse {
	/** 文件路径（用于 reference_images 等） */
	path: string
	/**
	 * 宿主附件 id。有则 mention/跨编辑器预览优先使用；
	 * 无则仅用 path，由 resolveResourceReference 解析身份。
	 */
	file_id?: string
	/** 跨项目粘贴时的源附件 id */
	source_file_id?: string
	/** 跨项目粘贴时的源项目 id */
	source_project_id?: string
	/** 当前项目 id（可选） */
	project_id?: string
}

/**
 * 上传私有文件响应数据
 */
export interface UploadPrivateFileResponse {
	/** 文件路径 */
	path: string
}

/**
 * 识别图片标记请求参数基础
 */
export interface IdentifyImageMarkRequestBase {
	/** 项目 id */
	project_id?: string
	/** 文件路径 */
	file_path?: string
	/** 标记序号 */
	number?: number
}

/**
 * 识别图片标记请求参数
 */
export interface IdentifyImageMarkPointRequest extends IdentifyImageMarkRequestBase {
	/** 类型 */
	type?: typeof MarkerTypeEnum.Mark
	/**
	 * 标记(x,y)
	 * x,y 为标记坐标, 所有值必须是浮点数
	 * 例如: [0.5, 0.5]
	 * 表示标记坐标为 (50%, 50%)
	 */
	mark?: [number, number]
}

/**
 * 识别图片区域请求参数
 */
export interface IdentifyImageMarkAreaRequest extends IdentifyImageMarkRequestBase {
	/** 类型 */
	type?: typeof MarkerTypeEnum.Area
	/**
	 * 区域(x,y,w,h)
	 * x,y 为区域左上角坐标, 所有值必须是浮点数
	 * w,h 为区域宽高, 像素值
	 * 例如: [0.5, 0.5, 100, 100]
	 * 表示区域左上角坐标为 (50%, 50%), 宽高为 (100px, 100px)
	 */
	area?: [number, number, number, number]
}

/**
 * 识别图片标记请求参数类型
 */
export type IdentifyImageMarkRequest = IdentifyImageMarkPointRequest | IdentifyImageMarkAreaRequest

/**
 * 识别图片标记响应
 */
export interface IdentifyImageMarkResponseBase {
	/** 文件路径 */
	file_path: string
	/** 项目 id */
	project_id: string
	/** 提示信息 */
	suggestion: string
	/** 提示信息列表 */
	suggestions: {
		label: string
		kind: "object" | "part" | "custom" // 对象 或 区域
		bbox?: {
			x: number
			y: number
			width: number
			height: number
		}
	}[]
}

/**
 * 识别图片标记响应
 */
export interface IdentifyImageMarkPointResponse extends IdentifyImageMarkResponseBase {
	/** 类型 */
	type: typeof MarkerTypeEnum.Mark
	/** 标记 */
	mark: [number, number]
}

/**
 * 识别图片区域响应
 */
export interface IdentifyImageMarkAreaResponse extends IdentifyImageMarkResponseBase {
	/** 类型 */
	type: typeof MarkerTypeEnum.Area
	/** 区域 */
	area: [number, number, number, number]
}

/**
 * 识别图片标记响应类型
 */
export type IdentifyImageMarkResponse =
	IdentifyImageMarkPointResponse | IdentifyImageMarkAreaResponse

/**
 * Storage 数据结构
 */
export interface CanvasDesignStorageData {
	viewport?: ViewportState
	/** 当前设计项目的小地图面板是否展开 */
	minimapOpen?: boolean
	/** 当前设计项目是否常驻显示图片和视频的标题、分辨率标签 */
	mediaLabelsAlwaysVisible?: boolean
	expandedElementIds?: string[]
	layersCollapsed?: boolean
	layersWidth?: number
	layersFilter?: CanvasLayersFilterState
	markers?: Marker[]
	/** 关联文本的用户选择与顺序（不进入生成 API） */
	tempLinkedEditorDrafts?: Record<string, StoredLinkedEditorDraftV1 | StoredLinkedEditorDraft>
}

/** 图层列表的持久化筛选条件。 */
export interface CanvasLayersFilterState {
	visibility: "all" | "visible" | "hidden"
	locked: "all" | "locked" | "unlocked"
	types: ElementType[]
}

/** v1 草稿兼容读取类型；媒体 selected ID 仅为历史字段，不再参与业务状态。 */
export interface StoredLinkedEditorDraftV1 {
	version: 1
	selectedTextConnectionIds: string[]
	orderedTextConnectionIds: string[]
	selectedMediaConnectionIds?: string[]
}

/** 当前草稿格式；媒体关联状态由编辑器 mention 派生，不持久化 selected ID。 */
export interface StoredLinkedEditorDraft {
	version: 2
	selectedTextConnectionIds: string[]
	orderedTextConnectionIds: string[]
}

export interface StoredLinkedFrameBinding {
	framePath: string
	sourceConnectionId: string
	sourcePath: string
	sourceKind: "image"
	sourceFileName: string
	frameRole: "start" | "end"
}

/** 视频编辑器按输入模式保存的可恢复配置。 */
export interface StoredVideoModeInputDraft {
	prompt?: string
	activeInputTab?: "frame" | "reference"
	frameImageInfos?: Array<UploadFileResponse | undefined>
	linkedFrameBindings?: Array<StoredLinkedFrameBinding | undefined>
	referenceAssetInfos?: Array<UploadFileResponse & { assetType: "image" | "video" | "audio" }>
}

/**
 * 编辑器恢复用的有序 mention 绑定。
 * 按 prompt 中 @ 出现顺序保存，避免同名文件仅靠 fileName 反推导致路径/身份漂移。
 */
export interface StoredMentionPathBinding {
	fileName: string
	path: string
	/** 宿主附件 id；有则优先于 path 作为跨编辑器身份 */
	fileId?: string
	sourceFileId?: string
	sourceProjectId?: string
	projectId?: string
}

/**
 * 未提交的视频编辑草稿。
 * 与 generateVideoRequest 分离，避免刷新恢复草稿时被误判为已创建的生成任务。
 */
export interface StoredVideoEditorDraft {
	version: 1
	request: Partial<GenerateVideoRequest>
	modeDrafts: Partial<Record<VideoInputMode, StoredVideoModeInputDraft>>
	/** 快捷编辑源视频。跨输入模式保留，避免切换模式时丢失当前视频。 */
	quickEditSource?: UploadFileResponse & { assetType: "video" }
	/** 用户已明确移除快捷编辑源视频；避免重新打开或切换模式时自动复活。 */
	quickEditSourceRemoved?: boolean
	/** 按 prompt mention 出现顺序保存的结构化身份，关闭重开后直接重建节点。 */
	mentionBindings?: StoredMentionPathBinding[]
	updatedAt: number
}

export interface CanvasMediaPlacementConfig {
	/** 新建媒体元素之间的最小间距 */
	spacing?: number
	/** 回退到全局末行布局时，每行最大元素数 */
	maxPerRow?: number
	/** 在当前 viewport 附近向外搜索空位的圈数 */
	maxSearchRings?: number
}

export interface CanvasDesignRootStorageData {
	/** 默认生图配置 */
	defaultGenerateImageConfig?: Partial<
		Pick<GenerateImageRequest, "model_id" | "size" | "resolution" | "image_generation_config">
	>
	/** 默认生视频配置 */
	defaultGenerateVideoConfig?: DefaultGenerateVideoConfig
	/** 媒体元素落位配置 */
	mediaPlacementConfig?: CanvasMediaPlacementConfig
}

/**
 * CanvasDesign 剪贴板读写接口
 * 通过 methods 注入，实现与项目剪贴板工具（如 clipboard-helpers）的解耦
 * 未注入时 CanvasDesign 内部降级使用 navigator.clipboard
 */
export interface CanvasDesignClipboard {
	/** 写入 ClipboardItem 列表（支持富格式、图片等） */
	write: (items: ClipboardItem[]) => Promise<void>
	/** 读取 ClipboardItem 列表（可选，未提供时使用 navigator.clipboard.read） */
	read?: () => Promise<ClipboardItem[]>
	/** 读取纯文本（可选，未提供时使用 navigator.clipboard.readText） */
	readText?: () => Promise<string>
}

/**
 * CanvasDesign 确认弹窗配置
 * 由宿主注入具体 UI 实现（如 MagicModal.confirm），CanvasDesign 内部仅声明协议
 */
export interface CanvasDesignConfirmModalOptions {
	title?: string
	content?: unknown
	okText?: string
	cancelText?: string
	okButtonProps?: Record<string, unknown>
	cancelButtonProps?: Record<string, unknown>
	variant?: "default" | "destructive"
	showIcon?: boolean
	onOk?: () => void | Promise<void>
	onCancel?: () => void
}

export interface CanvasImageRenameFile {
	fileId: string
	fileName: string
	sourcePath: string
	parentPath: string
}

export interface CanvasImageFileRename {
	elementId: string
	contentId: string
	fileId: string
	expectedName: string
	targetName: string
}

export interface CanvasImageRenameMethods {
	resolveImageRenameFile: (path: string) => CanvasImageRenameFile | undefined
	validateImageFileRenames: (changes: readonly CanvasImageFileRename[]) => Record<string, string>
	renameImageFile: (change: CanvasImageFileRename) => Promise<CanvasImageRenameFile>
}

export interface CanvasDesignConfirmModalHandle {
	/** 范围切换只更新确认按钮，不重建弹窗或触发删除。 */
	update: (
		options: Pick<CanvasDesignConfirmModalOptions, "content" | "okText" | "okButtonProps">,
	) => void
}

/**
 * CanvasDesign 方法集合
 * 用于代理数据请求和存储操作，所有方法都是异步的
 * 注意：此接口完全独立，不依赖外部类型
 */
export interface CanvasDesignMethods {
	/** 手动图片命名由宿主处理实际文件；自动标题更新不触发文件改名。 */
	imageRename?: CanvasImageRenameMethods
	/**
	 * 获取生图模型列表
	 * @param mode 模式标识，如果不传则使用当前模式
	 * @returns Promise<生图模型列表>
	 */
	getImageModelList: () => Promise<ImageModelItem[]>
	/**
	 * 获取视频模型列表
	 * @returns Promise<视频模型列表>
	 */
	getVideoModelList?: () => Promise<VideoModelItem[]>
	/**
	 * AI 补全图片提示词
	 * @param params 提示词补全请求参数
	 * @returns Promise<提示词补全结果>
	 */
	completeImagePrompt?: (
		params: CompleteImagePromptRequest,
	) => Promise<CompleteImagePromptResponse>
	/**
	 * AI 优化文本内容
	 * @param params 文本内容优化请求参数
	 * @returns Promise<文本内容优化结果>
	 */
	completeTextContent?: (
		params: CompleteTextContentRequest,
	) => Promise<CompleteTextContentResponse>
	/**
	 * 发起图片生成
	 * @param params 图片生成请求参数
	 * @returns Promise<图片生成响应数据>
	 */
	generateImage: (params: GenerateImageRequest) => Promise<GenerateImageResponse>
	/**
	 * 发起多图生成
	 * @param params 多图生成请求参数
	 * @returns Promise<多图生成响应数据>
	 */
	generateImages?: (params: GenerateImagesRequest) => Promise<GenerateImagesResponse>
	/**
	 * 发起图片去背景
	 * @param params 去背景请求参数
	 * @returns Promise<任务创建结果，结构与发起生图响应一致，可配合 getImageGenerationResult 轮询>
	 */
	removeBackground: (params: RemoveBackgroundRequest) => Promise<GenerateImageResponse>
	/**
	 * 发起画布橡皮擦除任务
	 * @param params 擦除请求参数
	 * @returns Promise<任务创建结果，结构与发起生图响应一致，可配合 getImageGenerationResult 轮询>
	 */
	eraser: (params: EraserRequest) => Promise<GenerateImageResponse>
	/**
	 * 发起扩图任务
	 * @param params 扩图请求参数
	 * @returns Promise<任务创建结果，结构与发起生图响应一致，可配合 getImageGenerationResult 轮询>
	 */
	expandImage: (params: GenerateExtendedImageRequest) => Promise<GenerateImageResponse>
	/**
	 * 发起视频生成
	 * @param params 视频生成请求参数
	 * @returns Promise<视频生成响应数据>
	 */
	generateVideo?: (params: GenerateVideoRequest) => Promise<GenerateVideoResponse>
	/**
	 * 预估视频生成积分
	 * @param params 视频生成请求参数
	 * @returns Promise<视频积分预估响应数据>
	 */
	estimateVideoPoints?: (params: GenerateVideoRequest) => Promise<EstimateVideoPointsResponse>

	/**
	 * 发起高清图片生成
	 * @param params 高清图片生成请求参数
	 * @returns Promise<高清图片生成响应数据>
	 */
	generateHightImage: (params: GenerateHightImageRequest) => Promise<GenerateHightImageResponse>
	/**
	 * 获取高清图片生成配置
	 * @returns Promise<高清图片生成配置响应数据>
	 */
	getConvertHightConfig: () => Promise<GetConvertHightConfigResponse>
	/**
	 * 获取画布 AI 能力可用性
	 * @returns Promise<AI 能力可用性响应数据>
	 */
	getAiAbilityAvailability?: () => Promise<AiAbilityAvailability>
	/**
	 * 查询图片生成结果
	 * @param params 查询参数
	 * @returns Promise<图片生成结果响应数据>
	 */
	getImageGenerationResult: (
		params: GetImageGenerationResultParams,
	) => Promise<ImageGenerationResultResponse>
	/**
	 * 查询多图生成结果
	 * @param params 查询参数
	 * @returns Promise<多图生成结果响应数据>
	 */
	getImageGenerationResults?: (
		params: GetImageGenerationResultsParams,
	) => Promise<ImageGenerationResultsResponse>
	/**
	 * 查询视频生成结果
	 * @param params 查询参数
	 * @returns Promise<视频生成结果响应数据>
	 */
	getVideoGenerationResult?: (
		params: GetVideoGenerationResultParams,
	) => Promise<VideoGenerationResultResponse>
	/**
	 * 定位项目文件，并可选择同步展开宿主文件树
	 * @param params 文件定位参数
	 * @returns Promise<void> | void
	 */
	locateProjectFile?: (params: {
		fileId?: string
		filePath?: string
		fileName?: string
		locateInTree?: boolean
	}) => Promise<void> | void
	/** 将项目文件移入回收站，并返回服务端确认已处理的文件 ID。 */
	deleteProjectFiles?: (params: {
		fileIds: readonly string[]
	}) => Promise<{ deletedFileIds: string[] }>
	/**
	 * 上传文件
	 * @param uploadFiles 待上传文件数组
	 * @param duplicateCheckList 用于检查重复的文件路径列表
	 * @param options 上传交互选项
	 * @returns Promise<上传文件响应数组，包含文件信息与路径>
	 */
	uploadFiles: (
		uploadFiles: UploadFile[],
		duplicateCheckList?: string[],
		options?: UploadFilesOptions,
	) => Promise<UploadFileResponse[]>
	/**
	 * 获取上传文件信息
	 * @param path 文件路径
	 * @param options.useImageProcess 是否按图片场景处理（仅图片且满足大小时才加图处理，视频/普通文件传 false 或不传）
	 * @returns Promise<文件信息，包含 src、fileName、expires_at；若解析到附件项则含 source>
	 */
	getFileInfo: (
		path: string,
		options?: {
			useImageProcess?: boolean
			forceRefresh?: boolean
			priority?: FileUrlRequestPriority
		},
	) => Promise<GetFileInfoResponse>
	/**
	 * 获取素材库资源详情。用于兼容解析 asset://<asset_id>，也用于按 assetId
	 * 将素材导入当前 Canvas；普通 workspace 路径仍通过 getFileInfo 获取 URL。
	 */
	getAssetResourceInfo?: (
		assetId: string,
		options?: {
			forceRefresh?: boolean
			priority?: FileUrlRequestPriority
		},
	) => Promise<CanvasAssetResourceInfo>
	/** 批量获取素材详情，用于 Canvas 加载和应用素材前刷新动态资源信息。 */
	getAssetResourceInfos?: (
		assetIds: string[],
		options?: { forceRefresh?: boolean },
	) => Promise<CanvasAssetResourceInfo[]>
	/** 获取单个素材的异步合规状态，用于 Canvas 级轮询管理器。 */
	getAssetComplianceStatus?: (assetId: string) => Promise<CanvasAssetComplianceState>
	/** 批量获取素材的异步合规状态，用于多个素材共享一次轮询请求。 */
	getAssetComplianceStatuses?: (assetIds: string[]) => Promise<CanvasAssetComplianceState[]>
	/** 请求宿主打开素材信息编辑弹窗；该入口本身不得直接发起保存。 */
	openSaveAssetToLibraryDialog?: (params: CanvasOpenSaveAssetDialogParams) => void
	/** 素材库本地上传：打开保存弹窗，不在选文件时直接入库。 */
	openSaveLocalAssetDialog?: (params: CanvasOpenSaveLocalAssetDialogParams) => void
	/** 素材库卡片编辑：复用保存弹窗编辑素材元数据和标签。 */
	openEditAssetDialog?: (params: CanvasOpenEditAssetDialogParams) => void
	/** 将本地文件上传到当前画布 images/videos 后保存到素材库。 */
	saveLocalAssetToLibrary?: (
		params: CanvasSaveLocalAssetToLibraryParams,
	) => Promise<CanvasAssetResourceInfo>
	/**
	 * 认证上传前确认承诺书已签署。未签署时由宿主打开签署弹窗，
	 * 用户同意并签署成功后 resolve true。
	 */
	ensureAssetAgreementSigned?: (options?: { onSigned?: () => void }) => Promise<boolean>
	/** 将工作区媒体保存到素材库；宿主负责解析项目路径并注入 project_id。 */
	saveAssetToLibrary?: (
		params: CanvasSaveAssetToLibraryParams,
	) => Promise<CanvasAssetResourceInfo>
	/**
	 * 对当前画布工作区文件发起合规校验。后端会在流程中创建素材；返回值里的
	 * assetId 必须绑定回发起校验的 Content。
	 */
	startWorkspaceMediaCompliance?: (
		params: CanvasStartWorkspaceMediaComplianceParams,
	) => Promise<CanvasAssetResourceInfo>
	/**
	 * 对素材库已有 asset 使用 file_key 发起合规，不创建新的 Canvas 素材绑定。
	 * 入参 assetId 是稳定素材 ID，调用方始终使用它轮询和刷新状态。
	 */
	startExistingAssetCompliance?: (
		params: CanvasStartExistingAssetComplianceParams,
	) => Promise<CanvasAssetResourceInfo>
	/**
	 * 获取资源轻量版本信息；用于 cache hit 后台校验，不应触发 OSS 换链或下载 body
	 * @param path 文件路径
	 * @param options.useImageProcess 是否按图片资源变体计算版本
	 */
	getFileResourceMeta?: (
		path: string,
		options?: { useImageProcess?: boolean },
	) => Promise<CanvasFileResourceMeta>
	/**
	 * Resolve paths, attachment nodes, storage values, and resource identities through the
	 * host's authoritative namespace-aware resource model.
	 */
	resolveResourceReference: ResolveCanvasResourceReference
	/** Resolver 与语义 revision 的原子快照；Canvas 运行时优先使用此入口。 */
	resourceReferenceResolverSnapshot?: CanvasResourceReferenceResolverSnapshot
	/** @deprecated 兼容旧宿主；新实现应通过 resourceReferenceResolverSnapshot 提供 revision。 */
	resourceReferenceResolverVersion?: string
	/**
	 * 获取画布虚拟媒体资源的宿主 scope，用于在同源虚拟链接中隔离工作区/项目上下文。
	 * @returns 例如：/global/super/{workspaceId}/{projectId}
	 */
	getVirtualResourceScope?: () => string
	/**
	 * 获取图片处理资源的缓存语义签名，例如水印预览模式。
	 * 签名变化时 CanvasDesign 不应复用旧的持久化 low surface。
	 */
	getImageProcessCacheSignature?: () => string
	/**
	 * 添加文件至对话（图片/视频等文件元素）
	 * @param data 文件元素数据数组
	 * @param isNewConversation 是否为新话题，true 为新话题，false 为当前对话
	 * @returns Promise<void>
	 */
	addToConversation: (data: CanvasFileElement[], isNewConversation: boolean) => Promise<void>
	/**
	 * 下载文件
	 * @param data 文件元素数据数组（图片/视频等）
	 * @param noWatermark 是否无水印，true 为无水印，false 为有水印
	 * @param skipAgreementCheck 无水印下载时是否跳过协议检查（由宿主注入）
	 * @param options 下载附加信息（如裁剪所需源图尺寸）
	 * @returns Promise<void>
	 */
	downloadFiles: (
		data: CanvasFileElement[],
		noWatermark: boolean,
		skipAgreementCheck?: boolean,
		options?: DownloadImageOptions,
	) => Promise<void>
	/**
	 * 获取存储数据
	 * @returns 存储数据
	 */
	getStorage: () => CanvasDesignStorageData | null
	/**
	 * 保存存储数据
	 * @param data 存储数据
	 */
	saveStorage: (data: CanvasDesignStorageData) => void
	/**
	 * 获取默认生图配置
	 * @returns 默认生图配置
	 */
	getRootStorage: () => CanvasDesignRootStorageData | null
	/**
	 * 保存根存储数据
	 * @param data 根存储数据
	 */
	saveRootStorage: (data: CanvasDesignRootStorageData) => void
	/**
	 * 从 DataTransfer 获取可写入画布的文件路径信息
	 * @param dataTransfer DataTransfer 对象
	 * @returns 当前画布可持久化路径；宿主可在返回前完成资源复制等准备工作
	 */
	getDataTransferFileInfo: (dataTransfer: DataTransfer) => Promise<string[]>
	/**
	 * 识别图片标记
	 * @param data 识别图片标记请求参数
	 * @returns Promise<识别图片标记响应数据>
	 */
	identifyImageMark(data: IdentifyImageMarkRequest): Promise<IdentifyImageMarkResponse>
	/**
	 * 上传私有文件
	 * @param uploadFiles 上传文件请求参数
	 * @returns Promise<上传私有文件响应数据>
	 */
	uploadPrivateFiles: (uploadFiles: UploadPrivateFile[]) => Promise<UploadPrivateFileResponse[]>
	/**
	 * 确认弹窗（可选）
	 * 注入后 CanvasDesign 可复用宿主弹窗样式；未注入时由内部组件自行降级实现
	 */
	confirmModal?: (options: CanvasDesignConfirmModalOptions) => CanvasDesignConfirmModalHandle
	/**
	 * 剪贴板读写方法（可选）
	 * 注入后 CanvasDesign 使用注入实现，否则降级到 navigator.clipboard
	 */
	clipboard?: CanvasDesignClipboard
	/**
	 * 将画布剪贴板中的源资源物化为目标控件可上传的 File。
	 * 宿主可在此处执行跨项目权限校验、过期 URL 刷新和资源转移。
	 */
	materializeCanvasClipboardAsset?: (input: {
		sourceCanvasId?: string
		resourceIdentity?: string
		sourcePath?: string
		sourceRef?: {
			src?: string
			ossUrl?: string
			expiresAt?: string
		}
		fileName: string
		mimeType: string
	}) => Promise<File | null>
	/** 将画布剪贴板资源解析为目标控件可直接引用的规范路径。 */
	resolveCanvasClipboardReference?: (input: {
		sourceProjectId?: string
		sourceCanvasId?: string
		sourceFileId?: string
		resourceIdentity?: string
		sourcePath?: string
		projectPath?: string
		fileName?: string
		targetProjectId?: string
		targetCanvasId?: string
		target: "canvas-editor" | "message-editor"
	}) => Promise<{
		kind: "current-canvas" | "project"
		path: string
		fileId?: string
		projectPath?: string
		resourceIdentity: string
		fileName: string
		/** 服务端复制已成功，但目标画布附件快照尚未确认该路径。 */
		awaitingAttachmentConfirmation?: boolean
	} | null>
	/** 当前画布所属项目/画布上下文，供剪贴板协议写入来源身份。 */
	getCanvasClipboardContext?: () => { projectId?: string; canvasId?: string }
}

/**
 * Magic 权限配置
 */
export interface MagicPermissions {
	/** 标记管理器是否禁用 */
	disabledMarker: boolean
	/** 是否展示插件入口。宿主负责根据自身组织、版本、灰度等业务规则计算。 */
	showPluginEntry?: boolean
	/**
	 * 下载相关能力提示（宿主可注入）。元素右键「下载」子菜单仅由 getFileInfo.source（AI 图）决定，不再读取本字段。
	 */
	downloadMenuMode?: "single" | "submenu"
	/**
	 * 元素右键菜单是否展示「添加至当前对话 / 添加至新话题」及相关快捷键是否可用。
	 * 为 false 时关闭；未设置时与 true 相同（保持兼容）。
	 */
	elementMenuConversationActions?: boolean
	/** 单一下载按钮是否应直达无水印下载 */
	singleDownloadUsesNoWatermark?: boolean
	/** 与话题文件列表右键菜单一致：个人未付费时在「下载无水印图片」旁展示 VIP */
	isFreeTrialVersion?: boolean
	/** 宿主统一计算的文件下载权限；为 false 时菜单与执行层都必须拒绝下载。 */
	allowFileDownload?: boolean
}

/** getDefaultItems 可选的 i18n 参数，与 MentionPanel I18nTexts 兼容 */
export type MentionDataServicePortI18n = Record<string, string | Record<string, string>>

/**
 * Magic 配置
 */
export interface MagicConfig {
	methods?: CanvasDesignMethods
	permissions?: MagicPermissions
	/**
	 * 宿主界面语言（如 i18next `resolvedLanguage ?? language`），供画布内依赖语言布局的 Magic 相关 UI 使用
	 */
	hostUiLocale?: string
	/** 视频积分预估缓存的宿主业务作用域，变化时清空画布侧预估缓存 */
	videoPointsEstimateCacheScope?: string
}

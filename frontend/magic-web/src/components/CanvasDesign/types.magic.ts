import type {
	Marker,
	ViewportState,
	CanvasFileElement,
	MarkerTypeEnum,
	CropConfig,
} from "./canvas/types"

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
export type GenerationStatus = "pending" | "processing" | "completed" | "failed"

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

/** 输入模式下允许提交的素材字段 */
export type VideoInputModeSupportedField =
	| "reference_images"
	| "reference_videos"
	| "reference_audios"
	| "frames"

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

/**
 * 视频模型元数据：能力、可选生成参数与约束
 */
export interface VideoGenerationConfig {
	/** 后端下发的输入模式与每模式下的字段约束 */
	input_modes?: VideoInputModesMap
	/** 参考图能力与限制 */
	reference_images?: VideoReferenceImagesConfig | []
	/** 生成侧可选参数（宽高比、分辨率、时长等） */
	generation?: {
		/** 可选宽高比列表，如 16:9 */
		aspect_ratios?: string[]
		/** 可选时长（秒） */
		durations?: number[]
		/** 默认时长（秒） */
		default_duration_seconds?: number
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
	/** 资源 URI（PATH）；DSL 中存相对路径，发请求时会还原为工作区绝对路径 */
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
	/** 音频资源列表 */
	audio?: Array<{
		/** 资源 URI（PATH）；DSL 中存相对路径，发请求时会还原为工作区绝对路径 */
		uri: string
	}>
}

/** 单次视频生成的参数（与 inputs 并列） */
export interface GenerateVideoGeneration {
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
	/** 扩展配置 */
	extensions?: Record<string, unknown>
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
	model_id: string
	/** 提示词 */
	prompt: string
	/** 输入模式 */
	input_mode?: VideoInputMode
	/** 任务类型 */
	task?: GenerateVideoTask
	/** 文件目录 */
	file_dir: string
	/** 文件名 */
	file_name: string
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
}

/**
 * 获取高清图片生成配置响应数据
 */
export interface GetConvertHightConfigResponse {
	/** 是否支持转高清，如果没有配置则不支持转高清 */
	supported: boolean
	/** 支持的尺寸配置列表 */
	image_size_config?: {
		sizes: {
			/** 尺寸比例标签，如 "1:1", "16:9" */
			label: string
			/** 尺寸值，格式为 "宽度x高度"，如 "1024x1024" */
			value: string
			/** 分辨率等级，如 "1K", "2K", "4K" */
			scale: string
		}[]
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
	model_id: string
	/** 提示词 */
	prompt: string
	/** 任务类型 */
	task?: GenerateVideoTask
	/** 文件目录 */
	file_dir: string
	/** 文件名 */
	file_name: string
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
	file_url: string
	/** ID */
	file_id: string
	/** 海报文件 ID */
	poster_file_id: string
	/** 海报文件 URL */
	poster_file_url: string
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
}

/** 上传子目录枚举值，内部用常量控制 images / videos / audios */
export const UploadSubDir = {
	Images: "images",
	Videos: "videos",
	Audios: "audios",
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
	/** 上传子目录，使用 UploadSubDir.Images | UploadSubDir.Videos | UploadSubDir.Audios */
	uploadSubDir: UploadSubDirType
	/** 单个文件上传完成回调 */
	onUploadComplete: (result: UploadFileResponse) => void
	/** 单个文件上传失败回调 */
	onUploadFailed: (error: Error) => void
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
	| IdentifyImageMarkPointResponse
	| IdentifyImageMarkAreaResponse

/**
 * Storage 数据结构
 */
export interface CanvasDesignStorageData {
	viewport?: ViewportState
	expandedElementIds?: string[]
	layersCollapsed?: boolean
	layersWidth?: number
	markers?: Marker[]
	/** 图片元素临时配置（未发送前的配置） */
	tempImageConfigs?: Record<string, Partial<GenerateImageRequest>>
	/** 视频元素临时配置（未发送前的配置） */
	tempVideoConfigs?: Record<string, Partial<GenerateVideoRequest>>
	/**
	 * 视频元素各 input_mode 互斥区暂存（不入生成 API，仅编辑器与本地缓存）
	 * key 为画布元素 id
	 */
	tempVideoModeDrafts?: Record<string, StoredVideoModeDraftsMap>
}

/** 与 VideoGenerateEditor 中单模式草稿结构一致，用于 localStorage 持久化 */
export interface StoredVideoModeInputDraft {
	prompt?: string
	activeInputTab?: "frame" | "reference"
	frameImageInfos: Array<UploadFileResponse | undefined>
	referenceImageInfos: Array<UploadFileResponse & { assetType: "image" | "video" | "audio" }>
}

export type StoredVideoModeDraftsMap = Partial<
	Record<
		"standard" | "keyframe_guided" | "image_reference" | "omni_reference" | "video_edit",
		StoredVideoModeInputDraft
	>
>

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
	onOk?: () => void | Promise<void>
	onCancel?: () => void
}

/**
 * CanvasDesign 方法集合
 * 用于代理数据请求和存储操作，所有方法都是异步的
 * 注意：此接口完全独立，不依赖外部类型
 */
export interface CanvasDesignMethods {
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
	 * 发起图片生成
	 * @param params 图片生成请求参数
	 * @returns Promise<图片生成响应数据>
	 */
	generateImage: (params: GenerateImageRequest) => Promise<GenerateImageResponse>
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
	 * 查询图片生成结果
	 * @param params 查询参数
	 * @returns Promise<图片生成结果响应数据>
	 */
	getImageGenerationResult: (
		params: GetImageGenerationResultParams,
	) => Promise<ImageGenerationResultResponse>
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
		options?: { useImageProcess?: boolean; forceRefresh?: boolean },
	) => Promise<GetFileInfoResponse>
	/**
	 * 将画布中记录的资源路径（如 ./xxx/xx）解析为宿主可识别的绝对路径（必选；画布资源同一性与此对齐）
	 * @param path 原始资源路径（相对或绝对）
	 * @returns 解析后的绝对路径，例如：/workspace/xxx/xx
	 */
	resolveAbsolutePath: (path: string) => string
	/**
	 * 获取画布虚拟媒体资源的宿主 scope，用于在同源虚拟链接中隔离工作区/项目上下文。
	 * @returns 例如：/global/super/{workspaceId}/{projectId}
	 */
	getVirtualResourceScope?: () => string
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
	 * 从 DataTransfer 获取文件路径信息
	 * @param dataTransfer DataTransfer 对象
	 * @returns 文件路径数组（Promise）
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
	confirmModal?: (options: CanvasDesignConfirmModalOptions) => void
	/**
	 * 剪贴板读写方法（可选）
	 * 注入后 CanvasDesign 使用注入实现，否则降级到 navigator.clipboard
	 */
	clipboard?: CanvasDesignClipboard
}

/**
 * Magic 权限配置
 */
export interface MagicPermissions {
	/** 标记管理器是否禁用 */
	disabledMarker: boolean
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
}

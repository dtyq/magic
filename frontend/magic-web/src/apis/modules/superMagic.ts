import type { TopicTypeFilterValue } from "@/pages/superMagic/utils/topicTypeFilter"
import type { ServiceHttpClient, RequestConfig } from "@/infrastructure/network/http/clients"
import type { SeqRecord } from "@/apis/modules/chat/types"
import type { FileScope } from "./fileScope"
import type {
	CopiedProjectResponse,
	CopyProjectRequest,
} from "@/pages/share/components/CopyProjectModal/types"
import type { ConversationQueryMessage } from "@/types/chat/conversation_message"
import type { PaginationResponse } from "@/types/request"
import type {
	CreatedProject,
	CrewItemResponse,
	FileHistoryVersion,
	FileInfo,
	ModeItem,
	ProjectListItem,
	Topic,
	WithPage,
	Workspace,
} from "@/pages/superMagic/pages/Workspace/types"
import type { TopicMode } from "@/pages/superMagic/pages/Workspace/TopicMode"
import { ShareType } from "@/pages/superMagic/components/Share/types"
import type { FileItem } from "@/pages/superMagic/components/SelectPathModal"
import type { UploadSource } from "@/pages/superMagic/components/MessageEditor/hooks/useFileUpload"
import type { SaveUploadFileToProjectResponse } from "@/pages/superMagic/utils/api"
import type { ModelItem } from "@/pages/superMagic/components/MessageEditor/components/ModelSwitch/types"
import type { AttachmentItem } from "@/pages/superMagic/components/TopicFilesButton/hooks"
import type { TreeNode } from "@dtyq/user-selector"
import type {
	EraserRequest,
	GenerateExtendedImageRequest,
	IdentifyImageMarkRequest,
	IdentifyImageMarkResponse,
	ReferenceImageOptions,
	RemoveBackgroundRequest,
} from "@/components/CanvasDesign/public/magic-types"
import type { PlaybookItem } from "./crew"
import { generateRecordingSummaryApi } from "./superMagic/recordSummary"
import { generateAudioProjectsApi } from "./superMagic/audioProjects"
import { generateCollaborationApi } from "./superMagic/collaboration"
import { generateMicroAppApi } from "./superMagic/microApps"
import { generateAiCanvasApi } from "./superMagic/aiCanvas"
import type { MicroAppShareExtra } from "./superMagic/microApps"
import { buildImageProcessQuery, type ImageProcessOptions } from "@/utils/image-processing"
import type {
	SuggestionRelationType,
	SuggestionsMeta,
} from "@/pages/superMagic/stores/suggestion-types"
import type {
	SlidesTemplateCategoryListResponse,
	SlidesTemplateCategoryQueryParams,
	SlidesTemplateCodeAvailabilityResponse,
	SlidesTemplateCountResponse,
	SlidesTemplateDetail,
	SaveSlidesTemplatePayload,
	SlidesTemplateTagListResponse,
	SlidesTemplateTagGroupItem,
	SlidesTemplateTagQueryParams,
	SlidesTemplateRawListResponse,
	SlidesTemplateQueryParams,
} from "@/pages/superMagic/components/MainInputContainer/scenes/Slides/slidesTemplateState"
import { normalizeSlidesTemplateResponse } from "@/pages/superMagic/components/MainInputContainer/scenes/Slides/slidesTemplateState"

/** 保存文件内容的响应 */
export interface SaveFileContentResponse {
	batch_id: string
	total: number
	success: number
	error: number
	success_files: Array<{
		index: number
		file_id: string
		status: string
		data: {
			file_id: string
			size: number
			updated_at: string
			version?: number | null
			revision?: number
			shadow_decoded?: boolean
		}
		duration_ms: number
	}>
	error_files: Array<{
		index: number
		file_id: string
		status: "error"
		error: string
		error_code: number
		duration_ms: number
	}>
	completed_at: string
}

export type FileReferenceSelector =
	{ file_id: string } | { space_type: "user"; space_relative_path: string }

interface FileReferenceMetadata {
	file_id: string
	file_name: string
	is_directory: boolean
	file_extension: string
	space_relative_path: string
}

export type FileReference =
	| (FileReferenceMetadata & { space_type: "user"; project_id?: never })
	| (FileReferenceMetadata & { space_type: "project"; project_id: string })

export type FileReferenceResult =
	{ status: "resolved"; reference: FileReference } | { status: "unavailable" | "invalid" }

export interface SuperMagicTopicModelExtra {
	transcription_enabled?: boolean
	auto_summary_enabled?: boolean
	model?: Partial<ModelItem>
}

export interface SuperMagicTopicModelResponse {
	model?: Partial<ModelItem>
	image_model?: Partial<ModelItem>
	video_model?: Partial<ModelItem>
	extra?: SuperMagicTopicModelExtra
	/** Compatibility with endpoints that resolve business rejection responses. */
	success?: boolean
	code?: string | number
	message?: string
}

/** LLM model capabilities */
export interface LlmModelCapabilities {
	tool_call: boolean
	vision: boolean
	deep_thinking: boolean
}

/** LLM model temperature config */
export interface LlmModelTemperature {
	type: "fixed" | "range"
	value: number
}

export type {
	CreateMicroAppProjectResponse,
	DeleteMicroAppResponse,
	MicroAppListItem,
	MicroAppListResponse,
	MicroAppListScope,
	MicroAppMetadata,
	MicroAppProjectDetail,
	MicroAppPublishShareRange,
	MicroAppPublishShareType,
	MicroAppPublishTarget,
	MicroAppShareExtra,
	PublishedMicroAppProjectItem,
	PublishedMicroAppProjectRecord,
	PublishedMicroAppProjectsResponse,
	PublishMicroAppProjectBody,
	UpdateMicroAppBody,
} from "./superMagic/microApps"

/** A single LLM model returned by matchLlmModels */
export interface LlmModelItem {
	id: string
	name: string
	provider: string
	description: {
		zh_CN: string
		en_US: string
	}
	max_output_tokens: number | null
	max_context_tokens: number
	temperature: LlmModelTemperature
	capabilities: LlmModelCapabilities
}

/** Response from /api/v1/llm-model/match */
export interface LlmModelMatchResponse {
	models: LlmModelItem[]
}

/** A single builtin tool item returned by getBuiltInTools */
export interface BuiltinToolItem {
	code: string
	name: string
	description: string
	icon: string
	required: boolean
}

/** A category grouping builtin tools */
export interface BuiltinToolCategory {
	name: string
	icon: string
	description: string
	tools: BuiltinToolItem[]
}

export interface SuperMagicAgentOrderIcon {
	type?: string
	color?: string
	url?: string
}

export interface SuperMagicAgentOrderItem {
	id: string
	code?: string
	name: string
	description: string
	icon?: SuperMagicAgentOrderIcon | null
	icon_type?: number | null
}

export interface SuperMagicAgentListResponse {
	frequent: SuperMagicAgentOrderItem[]
	all: SuperMagicAgentOrderItem[]
}

export interface SuperMagicAgentFeaturedSortListItem {
	id: string
	code: string
	name: string
	logo: string
}

export interface SuperMagicAgentFeaturedSortListResponse {
	frequent: SuperMagicAgentOrderItem[]
	all: SuperMagicAgentOrderItem[]
}

export interface SuperMagicAgentOrderPayload {
	all: string[]
	frequent: string[]
}

export interface GetOrganizationListParams {
	page?: number
	page_size?: number
	organization_name?: string
	magic_id?: string
}

export interface CopyProjectStatusResponse {
	/** 复制状态: running | finished | error */
	status: "running" | "finished" | "failed"
	/** 进度百分比，格式如 "45%" */
	progress: string
	/** 错误信息 */
	err_msg: string
}

export interface SuperAgentScopedStatusItem {
	id: string
	status: "waiting" | "running" | "finished" | "error"
}

export interface SuperAgentResourceStatusResponse {
	workspaces?: SuperAgentScopedStatusItem[]
	projects?: SuperAgentScopedStatusItem[]
}

export interface SuperAgentTopicStatusItem {
	id: string
	status: "waiting" | "running" | "waiting_for_user" | "finished"
	has_unread: boolean
}

export interface SuperAgentTopicStatusResponse {
	topics?: SuperAgentTopicStatusItem[]
	list?: SuperAgentTopicStatusItem[]
}

export interface SuperAgentTopicReadProgressResponse {
	topic_id: string
	last_read_at: string | null
	last_read_message_id: string | null
	has_unread: boolean
}

export interface GetProjectAttachmentsCountResponse {
	total: number
}

export interface ProjectAttachmentsV2NextParentState {
	parent_id: string
	after_sort: number | null
	after_file_id: string | null
	[key: string]: unknown
}

export interface GetProjectAttachmentsV2Response {
	list: AttachmentItem[]
	next_parent_ids: ProjectAttachmentsV2NextParentState[] | null
	has_more: boolean
}

export interface GetProjectAttachmentsV2Params {
	projectId: string
	scope?: FileScope
	nextParentIds?: ProjectAttachmentsV2NextParentState[] | null
	parentId?: string | number
	pageSize?: number
	fileType?: string[]
	temporaryToken?: string
}

export type ShareFilesV2NextParentState = ProjectAttachmentsV2NextParentState

export interface GetShareResourceFilesV2Response {
	list: AttachmentItem[]
	next_parent_ids: ShareFilesV2NextParentState[] | null
	has_more: boolean
}

export interface GetShareResourceFilesV2Params {
	resourceId: string
	password?: string
	pageSize?: number
	nextParentIds: ShareFilesV2NextParentState[]
}

export interface BatchSavePayload {
	project_id: string
	parent_id?: string // 父目录ID，为空表示根目录
	files: Array<{
		project_id: string
		topic_id: string
		task_id: string
		file_key: string
		file_name: string
		file_size: number
		file_type: string
		storage_type: string
		source: number
		relative_file_path?: string
		is_hidden?: boolean
	}>
}

export interface ProjectAccessibilityResponse {
	project_id: string | number
	required_magic_organization_code: string
}

function getShareModeRequestConfig(temporaryToken?: string): RequestConfig | undefined {
	if (!temporaryToken) return undefined
	return {
		enableAuthorization: false,
		enableAuthorizationVerification: false,
	}
}

function getAttachmentProjectId(projectId: string, temporaryToken?: string) {
	return temporaryToken ? "0" : projectId
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
	/** 大小，如: 1:1, 1024x1024 */
	size?: string
	/** 文件目录，一定是本项目存在的目录 */
	file_dir?: string
	/** 参考图，一定要是本项目存在的文件 */
	reference_images?: string[]
	/** 参考图参数 */
	reference_image_options?: ReferenceImageOptions
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
	status: string
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
	/** 预期完成时间（ISO 8601 日期时间），后端下发，用于估算进度 */
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
export interface GenerateImagesRequest extends Omit<GenerateImageRequest, "image_id"> {
	/** 图片任务 id（客户端生成 uuid） */
	image_id?: string
	/** 分辨率（对应 scale 值） */
	resolution?: string
	/** 本次请求生成图片数量 */
	generate_num: number
	/** 图片生成配置 */
	image_generation_config?: {
		[key: string]: string
	}
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
	status: "pending" | "processing" | "completed" | "failed"
	/** 错误信息 */
	error_message: string | null
	/** 已返回的图片列表 */
	images: GeneratedImageResultItem[]
	/** 任务发起时间（ISO 8601 日期时间），与 expected_finished_at 配对计算进度 */
	started_at?: string
	/** 预期完成时间（ISO 8601 日期时间），后端下发，用于估算进度；聊天工具卡用的是同一个值 */
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
	/** 项目 id */
	project_id?: string
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

/**
 * 查询图片生成结果请求参数
 */
export interface GetImageGenerationResultParams {
	/** 项目 id */
	project_id: string
	/** 图片 id */
	image_id: string
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
	/** 状态：pending 待处理，processing 处理中，completed 已完成，failed 失败 */
	status: "pending" | "processing" | "completed" | "failed"
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
	/** 状态 */
	status: "pending" | "processing" | "completed" | "failed"
	/** 错误信息 */
	error_message: string | null
	/** 已返回的图片列表 */
	images: GeneratedImageResultItem[]
	/** 任务发起时间（ISO 8601 日期时间），与 expected_finished_at 配对计算进度 */
	started_at?: string
	/** 预期完成时间（ISO 8601 日期时间），用于估算进度 */
	expected_finished_at?: string
}

/** 视频生成参数；画布合成暂不使用，保留为后续输出配置扩展。 */
export interface GenerateVideoGeneration {
	/** 宽高比，如 16:9 */
	aspect_ratio?: string
	/** 分辨率，如 1080p */
	resolution?: string
	/** 时长（秒） */
	duration_seconds?: number
	/** 是否以样片模式生成；仅在模型能力声明 draft 时发送 */
	draft?: boolean
	/** 预留扩展字段 */
	[key: string]: unknown
}

/** 发起视频生成请求参数 */
export interface GenerateVideoRequest {
	/** 项目 id */
	project_id?: string
	/** 视频 id */
	video_id?: string
	/** 模型 id */
	model_id?: string
	/** 提示词 */
	prompt?: string
	/** 视频输入模式；draft_task 为样片成片内部模式。 */
	input_mode?:
		| "standard"
		| "image_reference"
		| "omni_reference"
		| "video_edit"
		| "keyframe_guided"
		| "draft_task"
	/** 任务类型；样片成片仍使用 generate。 */
	task?: "generate" | "extend" | "edit" | "upscale"
	/** 结构化视频输入。 */
	inputs?: {
		frames?: Array<{ role: "start" | "end"; uri: string }>
		reference_images?: Array<{ uri: string; reference_type?: "asset" | "style" }>
		reference_videos?: Array<{ uri: string }>
		reference_audios?: Array<{ uri: string }>
		video?: { uri: string }
		mask?: { uri: string }
		audio?: Array<{ uri: string }>
		draft_task?: { video_id?: string; uri?: string }
	}
	/** 文件目录，一定是本项目存在的目录 */
	file_dir?: string
	/** 宽高比 */
	aspect_ratio?: string
	/** 时长 */
	duration_seconds?: number
	/** 分辨率 */
	resolution?: string
	/** 帧率 */
	fps?: number
	/** 种子 */
	seed?: number
	/** 水印 */
	watermark?: boolean
	/** 参考图 */
	reference_images?: string[]
	/** 帧 */
	frames?: Array<{ role: "start" | "end"; uri: string }>
	/** 生成参数；画布合成当前可省略，保留为后续输出配置扩展 */
	generation?: GenerateVideoGeneration
	/** 画布合成输入快照；数组顺序即合并顺序 */
	composition?: {
		videos: Array<{ path: string }>
		audios?: Array<{ path: string }>
	}
	/** 当前话题 id（普通视频生成使用） */
	topic_id?: string
	/** 扩展配置 */
	extensions?: {
		output_file_name?: string
		[key: string]: unknown
	}
	/** 画布合成任务类型 */
	generation_type?: "canvas_composition" | string
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
	/** 大小 */
	size: string
	/** 文件目录 */
	file_dir: string
	/** 文件名 */
	file_name: string
	/** 参考图 */
	reference_images: string[]
	/** 状态 */
	status: string
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
 * 视频积分预估响应数据
 */
export interface EstimateVideoPointsResponse {
	resource_type?: string
	points: number
	detail?: {
		mode?: string
		[key: string]: unknown
	}
}

/**
 * 查询视频生成结果请求参数
 */
export interface GetVideoGenerationResultParams {
	/** 项目 id */
	project_id: string
	/** 视频 id */
	video_id: string
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
	/** 文件目录 */
	file_dir: string | null
	/** 文件名 */
	file_name: string | null
	/** 类型 */
	type: unknown
	/** 状态：pending 待处理，processing 处理中，completed 已完成，failed 失败 */
	status: "pending" | "processing" | "completed" | "failed"
	/** 错误信息 */
	error_message: string | null
	/** 创建时间 */
	created_at: string
	/** 更新时间 */
	updated_at: string
	/** 文件 URL */
	file_url: string | null
	/** 文件 ID */
	file_id: string
	/** 海报文件 ID */
	poster_file_id: string
	/** 海报文件 URL */
	poster_file_url: string
	/** 计费信息 */
	billing?: {
		points?: number | null
	} | null
	/** 生成参数信息 */
	generation_info?: {
		task?: string
		input_mode?: string
		aspect_ratio?: string
		resolution?: string
		duration_seconds?: number | null
	} | null
	/** 运行时间信息 */
	runtime?: {
		started_at?: string | null
		finished_at?: string | null
		elapsed_seconds?: number | null
	} | null
	/** 画布合成任务类型 */
	generation_type?: "canvas_composition" | string
}

/**
 * 发起转高清请求参数
 */
export interface GenerateHightImageRequest {
	/** 项目 id */
	project_id?: string
	/** 图片 id（随机） */
	image_id?: string
	/** 文件目录（一定是本项目存在的目录） */
	file_dir?: string
	/** 文件路径 */
	file_path?: string
	/** 大小 */
	size?: string
	/** 参考图参数 */
	reference_image_options?: ReferenceImageOptions
}

/**
 * 发起转高清响应数据
 */
export interface GenerateHightImageResponse {
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
	status: string
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
 * 获取转高清配置响应数据
 */
export interface GetConvertHightConfigResponse {
	/** 后台是否开启转高清能力 */
	enabled: boolean
	/** 支持的尺寸配置列表 */
	image_size_config: {
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
export interface AiAbilityAvailabilityResponse {
	abilities: {
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

export interface ShareResourceExtra extends MicroAppShareExtra {
	allow_copy_project_files?: boolean
	view_file_list?: boolean
	hide_created_by_super_magic?: boolean
	show_original_info?: boolean
	allow_download_project_file?: boolean
}

export interface ShareResourceSettings {
	resource_id?: string
	resource_name?: string
	project_id?: string
	project_name?: string
	default_open_file_id?: string | null
	file_ids?: string[]
	share_type?: number
	share_range?: string | null
	target_ids?: Array<{ target_type: string; target_id: string }>
	share_project?: boolean
	password?: string
	expire_days?: number | null
	extra?: ShareResourceExtra
}

export const generateSuperMagicApi = (fetch: ServiceHttpClient) => ({
	getSlidesTemplates(
		params: SlidesTemplateQueryParams,
		options?: {
			xMagicImageProcess?: ImageProcessOptions
			temporaryToken?: string
		},
	) {
		const temporaryToken = options?.temporaryToken
		return fetch
			.get<SlidesTemplateRawListResponse>("/api/v1/slides-templates", {
				params: {
					scope: "official",
					...params,
					...(temporaryToken ? { token: temporaryToken } : {}),
				},
				headers: {
					...(options?.xMagicImageProcess && {
						"X-Magic-Image-Process": buildImageProcessQuery(options.xMagicImageProcess),
					}),
				},
				...getShareModeRequestConfig(temporaryToken),
			})
			.then(normalizeSlidesTemplateResponse)
	},

	getFavoriteSlidesTemplates(
		params: Omit<SlidesTemplateQueryParams, "scope">,
		options?: { xMagicImageProcess?: ImageProcessOptions },
	) {
		return fetch
			.get<SlidesTemplateRawListResponse>("/api/v1/slides-templates/favorites", {
				params: { ...params },
				headers: {
					...(options?.xMagicImageProcess && {
						"X-Magic-Image-Process": buildImageProcessQuery(options.xMagicImageProcess),
					}),
				},
			})
			.then(normalizeSlidesTemplateResponse)
	},

	getUsedSlidesTemplates(
		params: Pick<SlidesTemplateQueryParams, "page" | "page_size">,
		options?: { xMagicImageProcess?: ImageProcessOptions },
	) {
		return fetch
			.get<SlidesTemplateRawListResponse>("/api/v1/slides-templates/used", {
				params: { ...params },
				headers: {
					...(options?.xMagicImageProcess && {
						"X-Magic-Image-Process": buildImageProcessQuery(options.xMagicImageProcess),
					}),
				},
			})
			.then(normalizeSlidesTemplateResponse)
	},

	getSlidesTemplateCodeAvailability(code: string) {
		return fetch.get<SlidesTemplateCodeAvailabilityResponse>(
			`/api/v1/slides-templates/${code}/availability`,
		)
	},

	favoriteSlidesTemplate(code: string) {
		return fetch.post<[]>(`/api/v1/slides-templates/${code}/favorite`)
	},

	unfavoriteSlidesTemplate(code: string) {
		return fetch.delete<[]>(`/api/v1/slides-templates/${code}/favorite`)
	},

	deleteSlidesTemplate(code: string) {
		return fetch.delete<[]>(`/api/v1/slides-templates/${code}`)
	},

	getSlidesTemplateCategories(
		params: SlidesTemplateCategoryQueryParams,
		options?: { temporaryToken?: string },
	) {
		const temporaryToken = options?.temporaryToken
		return fetch.get<SlidesTemplateCategoryListResponse>("/api/v1/slides-template-categories", {
			params: {
				...params,
				...(temporaryToken ? { token: temporaryToken } : {}),
			},
			...getShareModeRequestConfig(temporaryToken),
		})
	},

	getSlidesTemplateTags(params: SlidesTemplateTagQueryParams = {}) {
		return fetch.get<SlidesTemplateTagListResponse>("/api/v1/slides-template-tags", {
			params: { ...params },
		})
	},

	getSlidesTemplateTagGroups(
		params: { category_code?: string } = {},
		options?: { temporaryToken?: string },
	) {
		const temporaryToken = options?.temporaryToken
		return fetch.get<SlidesTemplateTagGroupItem[]>("/api/v1/slides-template/tags/groups", {
			params: {
				...params,
				...(temporaryToken ? { token: temporaryToken } : {}),
			},
			...getShareModeRequestConfig(temporaryToken),
		})
	},

	getSlidesTemplateCount(
		params: SlidesTemplateQueryParams,
		options?: { temporaryToken?: string },
	) {
		const temporaryToken = options?.temporaryToken
		return fetch.get<SlidesTemplateCountResponse>("/api/v1/slides-templates/count", {
			params: {
				scope: "official",
				...params,
				...(temporaryToken ? { token: temporaryToken } : {}),
			},
			...getShareModeRequestConfig(temporaryToken),
		})
	},

	getSlidesTemplateDetail(code: string, options?: { xMagicImageProcess?: ImageProcessOptions }) {
		return fetch.get<SlidesTemplateDetail>(`/api/v1/slides-templates/${code}`, {
			headers: {
				...(options?.xMagicImageProcess && {
					"X-Magic-Image-Process": buildImageProcessQuery(options.xMagicImageProcess),
				}),
			},
		})
	},

	saveSlidesTemplate(payload: SaveSlidesTemplatePayload) {
		return fetch.post<SlidesTemplateDetail>("/api/v1/slides-templates", payload)
	},

	/**
	 * @description 复制新的话题（从话题的消息节点中复制出新话题）
	 * @param {object} params
	 * @param {string} params.topicId 话题Id
	 * @param {string} params.messageId 消息Id
	 * @param {string} params.topicName 话题名称
	 */
	copyTopicFromMessage(params: { topicId: string; messageId: string; topicName: string }) {
		return fetch.post<{ topic: Topic; status: "completed" }>(
			`/api/v1/super-agent/topics/${params.topicId}/duplicate-chat`,
			{
				target_message_id: params.messageId,
				new_topic_name: params.topicName,
			},
			{
				enableRequestUnion: true,
			},
		)
	},
	/**
	 * @description 复制新的话题进度查询
	 * @param {object} params
	 * @param {string} params.topicId 话题Id
	 */
	checkTopicCopyStatus(params: { topicId: string }) {
		return fetch.post(
			`/api/v1/super-agent/topics/${params?.topicId}/duplicate-chat/check`,
			{},
			{
				enableRequestUnion: true,
			},
		)
	},
	/**
	 * @description 移动单个文件或文件夹（支持跨项目）
	 * @param {object} params
	 * @param {string} params.file_id 文件ID
	 * @param {string} params.target_parent_id 目标父级ID
	 * @param {string} params.pre_file_id 前置文件ID
	 * @param {string} params.project_id 源项目ID
	 * @param {string} params.target_project_id 目标项目ID
	 * @param {string[]} params.keep_both_file_ids 保留两者的文件ID列表
	 */
	moveFile(params: {
		file_id: string
		target_parent_id: string
		pre_file_id?: string
		project_id?: string
		target_project_id?: string
		keep_both_file_ids?: string[]
	}) {
		const { file_id, ...requestData } = params
		return fetch.post(`/api/v1/super-agent/file/${file_id}/move`, requestData)
	},
	/**
	 * @description 复制单个文件或文件夹（支持跨项目）
	 * @param {object} params
	 * @param {string} params.file_id 源文件ID
	 * @param {string} params.target_parent_id 目标父目录ID
	 * @param {string} params.pre_file_id 前置文件ID
	 * @param {string} params.target_project_id 目标项目ID
	 * @param {string[]} params.keep_both_file_ids 保留两者的文件ID列表
	 */
	copyFile(params: {
		file_id: string
		target_parent_id: string
		pre_file_id?: string
		target_project_id?: string
		keep_both_file_ids?: string[]
	}) {
		const { file_id, ...requestData } = params
		return fetch.post(`/api/v1/super-agent/file/${file_id}/copy`, requestData)
	},
	/**
	 * @description Move files or folders in batches, including across projects
	 * @param {object} params
	 * @param {string[]} params.file_ids File IDs
	 * @param {string} params.target_parent_id Target parent folder ID
	 * @param {string} params.pre_file_id Previous file ID used for ordering
	 * @param {string} params.project_id Source project ID
	 * @param {string} params.target_project_id Target project ID
	 * @param {string[]} params.keep_both_file_ids File IDs that should keep both copies
	 * @param {boolean} params.preserve_parent_path Whether to preserve the source parent folder path
	 */
	moveFiles(params: {
		file_ids: string[]
		project_id?: string
		target_project_id?: string
		target_parent_id: string
		pre_file_id?: string
		keep_both_file_ids?: string[]
		preserve_parent_path?: boolean
	}) {
		return fetch.post(`/api/v1/super-agent/file/batch-move`, params)
	},
	/**
	 * @description Copy files or folders in batches, including across projects
	 * @param {object} params
	 * @param {string[]} params.file_ids File IDs
	 * @param {string} params.target_parent_id Target parent folder ID
	 * @param {string} params.pre_file_id Previous file ID used for ordering
	 * @param {string} params.project_id Source project ID
	 * @param {string} params.target_project_id Target project ID
	 * @param {string[]} params.keep_both_file_ids File IDs that should keep both copies
	 * @param {boolean} params.preserve_parent_path Whether to preserve the source parent folder path
	 */
	copyFiles(params: {
		file_ids: string[]
		project_id?: string
		target_project_id?: string
		target_parent_id: string
		pre_file_id?: string
		keep_both_file_ids?: string[]
		preserve_parent_path?: boolean
	}) {
		return fetch.post(`/api/v1/super-agent/file/batch-copy`, params)
	},
	/**
	 * @description 分享场景批量复制文件到目标项目
	 * @param params.shareCode 分享标识（新分享为 resourceId，旧分享为 topicId）
	 */
	copyShareFiles(params: {
		shareCode: string
		pwd?: string
		file_ids: string[]
		target_project_id?: string
		target_parent_id: string
		pre_file_id?: string
		keep_both_file_ids?: string[]
		preserve_parent_path?: boolean
	}) {
		const { shareCode, ...requestData } = params
		return fetch.post(`/api/v1/share/resources/${shareCode}/files/batch-copy`, requestData)
	},
	/**
	 * @description 检查批量操作任务状态（移动、重命名等）
	 * @param {string} batch_key 批量任务key
	 * @returns 批量操作状态
	 */
	checkBatchOperationStatus(batch_key: string) {
		return fetch.get(`/api/v1/super-agent/file/batch-operation/check?batch_key=${batch_key}`)
	},

	/**
	 * @description 查看项目复制状态
	 * @param {object} params
	 * @param {string} params.projectId 项目Id
	 */
	getProjectCopyStatus({ projectId }: { projectId: string }) {
		return fetch.get<CopyProjectStatusResponse>(
			`/api/v1/super-agent/projects/${projectId}/fork-status`,
		)
	},

	/**
	 * @description 复制项目
	 */
	copyProject(params: CopyProjectRequest) {
		return fetch.post<CopiedProjectResponse>(`/api/v1/super-agent/projects/fork`, params)
	},
	/**
	 * @description 获取当前用户对项目的访问权限及其归属组织
	 */
	getProjectAccessibility(projectId: string, options?: Omit<RequestConfig, "url">) {
		return fetch.get<ProjectAccessibilityResponse | null>(
			`/api/v1/super-agent/projects/${projectId}/accessibility`,
			options,
		)
	},

	/**
	 * @description 分享是否需要密码
	 */
	checkShareResourcePassword({ resource_id }: { resource_id: string }) {
		return fetch.post(`/api/v1/share/resources/${resource_id}/check`)
	},
	/**
	 * @description 获取分享详情
	 */
	getShareResource({
		resource_id,
		password,
		page = 1,
		page_size = 500,
	}: {
		resource_id: string
		password?: string
		page?: number
		page_size?: number
	}) {
		return fetch.post(`/api/v1/share/resources/${resource_id}/detail`, {
			pwd: password,
			page,
			page_size,
		})
	},
	/**
	 * 批量保存文件到项目
	 * @param payload 批量保存请求数据
	 * @returns 保存结果
	 */
	batchSaveFiles(payload: BatchSavePayload) {
		return fetch.post("/api/v1/super-agent/file/project/batch-save", payload)
	},

	/**
	 * @description 获取组织列表接口
	 */
	getOrganizationList(params?: GetOrganizationListParams) {
		const { page = 1, page_size = 10, organization_name, magic_id } = params || {}

		return fetch.get(`/api/v1/super-agent/admin/billing-manager/organizations`, {
			params: {
				page: page.toString(),
				page_size: page_size.toString(),
				...(organization_name && { organization_name }),
				...(magic_id && { magic_id }),
			},
		})
	},

	/**
	 * @description 增加组织积分
	 * @param organization_code
	 * @param point_amount
	 * @param description
	 */
	addOrganizationPoints({
		organization_code,
		point_amount,
		description,
	}: {
		organization_code: string
		point_amount: number
		description: string
	}) {
		return fetch.post(`/api/v1/super-agent/admin/billing-manager/organization-credits`, {
			organization_code,
			point_amount,
			description,
		})
	},

	/**
	 * @description 查看组织积分明细
	 * @param params
	 */
	getOrganizationPointsDetail(params: {
		organization_code: string
		page?: number
		page_size?: number
	}) {
		const { organization_code, page = 1, page_size = 10 } = params
		const searchParams = new URLSearchParams({
			organization_code,
			page: page.toString(),
			page_size: page_size.toString(),
		})
		return fetch.get(`/api/v1/super-agent/admin/billing-manager/points?${searchParams}`)
	},

	/**
	 * @description 获取分享信息列表
	 */
	getShareListInfo({
		resource_id,
		page = 1,
		page_size = 500,
		sort_direction = "asc",
	}: {
		resource_id: string
		page?: number
		page_size?: number
		sort_direction?: "asc" | "desc"
	}) {
		return fetch.get(`/api/v1/admin/ai/content-audit/topic/${resource_id}/messages`, {
			params: {
				page,
				page_size,
				sort_direction,
			},
		})
	},

	/**
	 * @description 通过项目id获取附件列表
	 */
	getAttachmentsByProjectIdForAdmin({
		projectId,
		temporaryToken,
	}: {
		projectId: string
		temporaryToken?: string
	}) {
		return fetch.get(`/api/v1/admin/ai/content-audit/project/${projectId}/attachments`, {
			params: {
				page: 1,
				page_size: 999,
				token: temporaryToken || "",
				project_id: projectId,
			},
		})
	},

	// 通过项目id获取附件列表
	getAttachmentsByProjectId(
		params: { projectId: string; temporaryToken?: string; scope?: FileScope },
		requestConfig?: Omit<RequestConfig, "url" | "body">,
	) {
		const projectId = getAttachmentProjectId(params.projectId, params.temporaryToken)
		return fetch.post<{ tree: AttachmentItem[]; list: AttachmentItem[]; total: number }>(
			`/api/v1/super-agent/projects/${projectId}/attachments`,
			{
				page: 1,
				page_size: 999,
				file_type: [
					"user_upload",
					"user_create",
					"process",
					"system_auto_upload",
					"directory",
				],
				...(params.scope ? { scope: params.scope } : {}),
				...(params?.temporaryToken ? { token: params.temporaryToken } : {}),
			},
			{
				...getShareModeRequestConfig(params?.temporaryToken),
				...requestConfig,
			},
		)
	},

	getProjectAttachmentsCount(
		params: { projectId: string; temporaryToken?: string; scope?: FileScope },
		requestConfig?: Omit<RequestConfig, "url" | "body">,
	) {
		const projectId = getAttachmentProjectId(params.projectId, params.temporaryToken)
		return fetch.post<GetProjectAttachmentsCountResponse>(
			`/api/v1/super-agent/projects/${projectId}/attachments/count`,
			{
				...(params.scope ? { scope: params.scope } : {}),
				...(params.temporaryToken ? { token: params.temporaryToken } : {}),
			},
			{
				...getShareModeRequestConfig(params.temporaryToken),
				...requestConfig,
			},
		)
	},

	getProjectAttachmentsV2Page(
		params: GetProjectAttachmentsV2Params,
		requestConfig?: Omit<RequestConfig, "url" | "body">,
	) {
		const projectId = getAttachmentProjectId(params.projectId, params.temporaryToken)
		return fetch.post<GetProjectAttachmentsV2Response>(
			`/api/v2/super-agent/projects/${projectId}/attachments`,
			{
				page_size: params.pageSize ?? 1000,
				...(params.scope ? { scope: params.scope } : {}),
				...(params.fileType ? { file_type: params.fileType } : {}),
				...(params.parentId !== undefined && params.parentId !== null
					? { parent_id: params.parentId }
					: {}),
				...(params.nextParentIds !== undefined && params.nextParentIds !== null
					? { next_parent_ids: params.nextParentIds }
					: {}),
				...(params.temporaryToken ? { token: params.temporaryToken } : {}),
			},
			{
				enableRequestUnion: false,
				...getShareModeRequestConfig(params.temporaryToken),
				...requestConfig,
			},
		)
	},

	/**
	 * @description 通过文件id获取临时下载url
	 * @param params
	 */
	getTemporaryDownloadUrlForAdmin(params: {
		topic_id: string
		project_id: string
		file_ids: string[]
		temporary_token?: string
	}) {
		return fetch.post(
			`/api/v1/admin/ai/content-audit/topic/${params?.topic_id}/attachment-urls`,
			{
				file_ids: params?.file_ids,
				token: params.temporary_token || "",
				topic_id: params?.topic_id,
				project_id: params.project_id,
			},
		)
	},

	/**
	 * @description 通过话题id获取附件列表
	 * @param params
	 */
	getAttachmentsByTopicId(params: { topic_id: string; temporary_token: string }) {
		return fetch.get(`/api/v1/admin/ai/content-audit/topic/${params?.topic_id}/attachments`, {
			params: {
				page: 1,
				page_size: 999,
				file_type: ["user_upload", "user_create", "process", "system_auto_upload"],
				token: params.temporary_token || "",
				topic_id: params?.topic_id,
			},
		})
	},

	/**
	 * @description 获取工作区列表
	 * @param page
	 * @param page_size
	 * @param pin_priority Whether the backend should return pinned workspaces first.
	 */
	getWorkspaces({
		page,
		page_size,
		workspace_type,
		auto_create,
		workspace_name,
		pin_priority = true,
	}: {
		page: number
		page_size: number
		workspace_type?: string
		auto_create?: boolean
		workspace_name?: string
		pin_priority?: boolean
	}) {
		return fetch.get("/api/v1/super-agent/workspaces/queries", {
			params: { page, page_size, workspace_type, auto_create, workspace_name, pin_priority },
			enableRequestUnion: true,
		})
	},

	/**
	 * 保存侧栏工作区顺序。
	 */
	moveWorkspace(
		{
			id,
			pre_workspace_id,
			next_workspace_id,
		}: {
			id: string
			pre_workspace_id: string | null
			next_workspace_id: string | null
		},
		options?: Omit<RequestConfig, "url">,
	) {
		return fetch.put<{ workspace?: Workspace }>(
			`/api/v1/super-agent/workspaces/${id}`,
			{
				pre_workspace_id,
				next_workspace_id,
			},
			options,
		)
	},

	/**
	 * @description 删除工作区
	 * @param id
	 */
	deleteWorkspace({ id }: { id: string }) {
		return fetch.delete(
			`/api/v1/super-agent/workspaces/${id}`,
			{},
			{
				enableRequestUnion: true,
			},
		)
	},

	/**
	 * Detaches projects/topics from a workspace then deletes the empty workspace shell.
	 * Used by audio recording groups so deleting a group keeps the underlying recordings.
	 */
	detachWorkspace({ id }: { id: string }) {
		return fetch.put(
			`/api/v1/super-agent/workspaces/${id}/detach`,
			{},
			{
				enableRequestUnion: true,
			},
		)
	},

	/**
	 * @description 新增工作区
	 * @param workspace_name
	 */
	createWorkspace({
		workspace_name,
		workspace_type,
	}: {
		workspace_name: string
		workspace_type?: string
	}) {
		return fetch.post<Workspace>(
			`/api/v1/super-agent/workspaces`,
			{ workspace_name, workspace_type },
			{
				enableRequestUnion: true,
			},
		)
	},

	/**
	 * @description 编辑工作区
	 * @param id
	 * @param workspace_name
	 */
	editWorkspace({
		id,
		workspace_name,
		is_pinned,
		pre_workspace_id,
	}: {
		id: string
		workspace_name: string
		is_pinned?: boolean
		pre_workspace_id?: string | null
	}) {
		return fetch.put(
			`/api/v1/super-agent/workspaces/${id}`,
			{ workspace_name, is_pinned, pre_workspace_id },
			{
				enableRequestUnion: true,
			},
		)
	},

	/**
	 * @description 获取工作区详情
	 * @param id
	 */
	getWorkspaceDetail({ id }: { id: string }, options?: Omit<RequestConfig, "url">) {
		return fetch.get<Workspace>(`/api/v1/super-agent/workspaces/${id}`, {
			enableRequestUnion: true,
			...options,
		})
	},

	/**
	 * @description 创建超麦话题
	 */
	createTopic({
		// workspace_id,
		project_id,
		topic_name,
		project_mode,
	}: {
		// workspace_id?: string
		project_id: string
		topic_name: string
		project_mode?: TopicMode
	}) {
		return fetch.post(`/api/v1/super-agent/topics`, {
			// workspace_id,
			project_id,
			topic_name,
			project_mode,
		})
	},

	/**
	 * @description 编辑超麦话题
	 */
	editTopic({
		id,
		topic_name,
		// workspace_id,
		project_id,
	}: {
		id?: string
		topic_name: string
		// workspace_id: string
		project_id: string
	}) {
		return fetch.put(`/api/v1/super-agent/topics/${id}`, {
			topic_name,
			// workspace_id,
			project_id,
		})
	},
	/**
	 * @description 删除超麦话题
	 */
	deleteTopic({
		id,
		// workspace_id
	}: {
		id: string
		// workspace_id: string
	}) {
		return fetch.post(`/api/v1/super-agent/topics/delete`, {
			id,
			// workspace_id
		})
	},

	/**
	 * @description 根据话题id获取话题详情
	 * @param id
	 */
	getTopicDetail({ id }: { id: string }, options?: Omit<RequestConfig, "url">) {
		return fetch.get<Topic>(`/api/v1/super-agent/topics/${id}`, options)
	},

	/**
	 * @description 获取话题沙箱状态
	 * @param id
	 */
	getTopicSandboxStatus({ id }: { id: string }) {
		return fetch.get(`/api/v1/super-agent/admin/topic/${id}/sandbox`)
	},
	/**
	 * @description 重启普通项目话题绑定的沙盒（服务端按升级语义执行）
	 */
	restartTopicSandbox({ topic_id }: { topic_id: string }) {
		return fetch.put<{ sandbox_id: string }>("/api/v1/super-agent/sandbox/restart", {
			topic_id,
		})
	},

	/**
	 * @description 通过工作区id获取话题列表
	 * @param id
	 * @param page
	 * @param page_size
	 */
	getTopicsByProjectId({ id, page, page_size }: { id: string; page: number; page_size: number }) {
		return fetch.get<WithPage<Topic>>(`/api/v1/super-agent/projects/${id}/topics`, {
			params: { page, page_size },
		})
	},

	getSidebarTopicsByProjectId({
		topicType,
		id,
		page,
		page_size,
		q,
	}: {
		id: string
		page: number
		page_size: number
		q?: string
		topicType?: TopicTypeFilterValue
	}) {
		return fetch.get<WithPage<Topic>>(`/api/v1/super-agent/projects/${id}/sidebar-topics`, {
			params: {
				page,
				page_size,
				q,
				...(topicType && topicType !== "all"
					? { topic_types: topicType === "topic" ? 1 : 2 }
					: {}),
			},
		})
	},

	getMyResourceStatus(payload: { workspace_ids?: string[]; project_ids?: string[] }) {
		return fetch.post<SuperAgentResourceStatusResponse>(
			"/api/v1/super-agent/me/resource-status",
			{
				workspace_ids: payload.workspace_ids || [],
				project_ids: payload.project_ids || [],
			},
		)
	},

	getTopicsStatus(payload: { topic_ids?: string[] }) {
		return fetch.post<SuperAgentTopicStatusResponse>("/api/v1/super-agent/topics/status", {
			topic_ids: payload.topic_ids || [],
		})
	},

	markTopicReadProgress(
		topicId: string,
		payload: {
			last_read_at?: string
			last_read_message_id?: string
		},
	) {
		return fetch.post<SuperAgentTopicReadProgressResponse>(
			`/api/v1/super-agent/topics/${topicId}/read-progress`,
			payload,
		)
	},

	pinTopic(topicId: string) {
		return fetch.post<{ topic: Topic }>(`/api/v1/super-agent/topics/${topicId}/pin`)
	},

	unpinTopic(topicId: string) {
		return fetch.post<{ topic: Topic }>(`/api/v1/super-agent/topics/${topicId}/unpin`)
	},

	archiveTopic(topicId: string) {
		return fetch.post<{ topic: Topic }>(`/api/v1/super-agent/topics/${topicId}/archive`)
	},

	unarchiveTopic(topicId: string) {
		return fetch.post<{ topic: Topic }>(`/api/v1/super-agent/topics/${topicId}/unarchive`)
	},

	/**
	 * @description 根据会话ID获取历史消息
	 * @param conversation_id
	 * @param chat_topic_id
	 * @param page_token
	 * @param limit
	 * @param order
	 */
	getMessagesByConversationId({
		conversation_id,
		chat_topic_id,
		page_token = "",
		limit = 50,
		order = "asc",
	}: {
		conversation_id: string
		chat_topic_id: string
		limit?: number
		order?: "asc" | "desc"
		page_token?: string
	}) {
		return fetch.post<PaginationResponse<SeqRecord<ConversationQueryMessage>>>(
			`/api/v1/im/conversations/${conversation_id}/messages/queries`,
			{
				limit,
				order,
				page_token,
				topic_id: chat_topic_id,
			},
			{
				enableRequestUnion: true,
			},
		)
	},

	/**
	 * @description 取消分享话题
	 */
	cancelShareTopic({ resource_id }: { resource_id: string }) {
		return fetch.post(`/api/v1/share/resources/${resource_id}/cancel`)
	},

	/**
	 * @description 创建分享话题
	 * @param resource_id
	 * @param resource_type
	 * @param share_type
	 * @param pwd
	 */
	createShareTopic({
		resource_id,
		resource_type,
		share_type,
		password,
		extra,
	}: {
		resource_id: string
		resource_type: number
		share_type: number
		password: string
		extra?: {
			show_original_info?: boolean
			view_file_list?: boolean
		}
	}) {
		return fetch.post("/api/v1/share/resources/create", {
			resource_id,
			resource_type,
			share_type,
			password,
			extra,
		})
	},

	/**
	 * @description 通过code获取分享的信息
	 * @param code
	 */
	getShareInfoByCode({ code }: { code: string }) {
		return fetch.get<ShareResourceSettings>(`/api/v1/share/resources/${code}/setting`)
	},

	/**
	 * @description get share resource files v2 page
	 */
	getShareResourceFilesV2Page(
		params: GetShareResourceFilesV2Params,
		requestConfig?: Omit<RequestConfig, "url" | "body">,
	) {
		return fetch.post<GetShareResourceFilesV2Response>(
			`/api/v2/share/resources/${params.resourceId}/files/queries`,
			{
				page_size: params.pageSize ?? 1000,
				...(params.password !== undefined ? { pwd: params.password } : {}),
				next_parent_ids: params.nextParentIds,
			},
			{
				enableRequestUnion: false,
				...requestConfig,
			},
		)
	},

	/**
	 * @description 批量获取雪花ID（用于文件分享、文件上传等场景）
	 * @param count 生成ID的数量，默认为1
	 * @returns 返回雪花ID数组
	 */
	getSnowflakeIds({ count = 1 }: { count?: number } = {}) {
		return fetch.post<{ ids: string[] }>("/api/v1/common/ids/batch-generate", {
			count,
		})
	},

	/**
	 * @description 获取分享资源的成员信息
	 * @param resource_id 资源ID
	 */
	getShareResourceMembers({ resource_id }: { resource_id: string }) {
		return fetch.get<{
			members: TreeNode[]
		}>(`/api/v1/share/resources/${resource_id}/members`)
	},

	/**
	 * @description 批量查询文件详情
	 * @param file_ids 文件ID列表
	 */
	batchGetFileDetails({ file_ids }: { file_ids: string[] }) {
		return fetch.post<{ files: AttachmentItem[] }>("/api/v1/share/resources/files/batch", {
			file_ids,
		})
	},

	/**
	 * @description 创建或更新分享资源
	 * @param resource_id 资源ID
	 * @param resource_type 资源类型（5=话题，12=项目，13=文件）
	 * @param share_type 分享类型（1=个人，2=组织，4=互联网）
	 * @param resource_name 资源名称（必填）
	 * @param password 密码（可选）
	 * @param expire_days 过期天数（可选）
	 * @param share_range 分享范围（可选，组织分享时使用：all=全团队成员，designated=指定成员）
	 * @param target_ids 目标ID列表（可选，格式：[{target_type: "User"|"Department", target_id: string}]）
	 * @param file_ids 文件ID列表（可选，文件分享时使用）
	 * @param topic_id 话题ID（可选，话题分享时使用）
	 * @param default_open_file_id 默认打开文件ID（可选）
	 * @param extra 额外配置（可选）
	 */
	createOrUpdateShareResource({
		resource_id,
		resource_type,
		share_type,
		resource_name,
		password,
		expire_days,
		share_range,
		target_ids,
		file_ids,
		topic_id,
		default_open_file_id,
		share_project,
		extra,
		project_id,
	}: {
		resource_id: string
		resource_type: number
		share_type: number
		resource_name?: string // 必填字段
		password?: string
		expire_days?: number
		share_range?: string
		target_ids?: Array<{ target_type: "User" | "Department"; target_id: string }>
		file_ids?: string[]
		topic_id?: string
		default_open_file_id?: string
		share_project?: boolean
		extra?: ShareResourceExtra
		project_id?: string
	}) {
		return fetch.post("/api/v1/share/resources/create", {
			resource_id,
			resource_type,
			share_type,
			resource_name,
			...(share_type === ShareType.Organization ? {} : { password }),
			expire_days,
			share_range,
			target_ids,
			file_ids,
			topic_id,
			default_open_file_id,
			share_project,
			extra,
			project_id,
		})
	},

	/**
	 * @description 查找相似的分享
	 * @param file_ids 文件ID列表
	 */
	findSimilarShares({
		file_ids,
		project_id,
		share_project,
	}: {
		file_ids: string[]
		project_id?: string
		share_project?: boolean
	}) {
		return fetch.post("/api/v1/share/resources/find-similar", {
			file_ids,
			project_id,
			share_project,
		})
	},

	/**
	 * @description 创建文件分享 (Mock)
	 * @param topic_id 话题ID
	 * @param file_ids 文件ID列表
	 * @param share_type 分享类型
	 * @param pwd 密码（可选）
	 * @param allow_copy 允许复制（可选）
	 * @param show_file_list 显示文件列表（可选）
	 * @param hide_creator_info 隐藏创作者信息（可选）
	 */
	createFileShare({
		topic_id,
		file_ids,
		share_type,
		pwd,
		allow_copy,
		show_file_list,
		hide_creator_info,
	}: {
		topic_id: string
		file_ids: string[]
		share_type: number
		pwd?: string
		allow_copy?: boolean
		show_file_list?: boolean
		hide_creator_info?: boolean
	}) {
		console.log("[Mock] createFileShare:", {
			topic_id,
			file_ids,
			share_type,
			pwd,
			allow_copy,
			show_file_list,
			hide_creator_info,
		})
		// Mock延迟
		return new Promise((resolve) => {
			setTimeout(() => {
				resolve({
					success: true,
					share_id: `fs-${Date.now()}`,
					resource_id: topic_id,
					share_url: `/share/${topic_id}/files/${file_ids.join(",")}`,
				})
			}, 500)
		})
	},

	/**
	 * @description 取消文件分享 (Mock)
	 * @param topic_id 话题ID
	 * @param file_ids 文件ID列表
	 */
	cancelFileShare({ topic_id, file_ids }: { topic_id: string; file_ids: string[] }) {
		console.log("[Mock] cancelFileShare:", { topic_id, file_ids })
		return new Promise((resolve) => {
			setTimeout(() => {
				resolve({
					success: true,
					message: "文件分享已取消",
				})
			}, 300)
		})
	},

	/**
	 * @description 获取文件分享信息 (Mock)
	 * @param topic_id 话题ID
	 * @param file_ids 文件ID列表
	 */
	getFileShareInfo({ topic_id, file_ids }: { topic_id: string; file_ids: string[] }) {
		console.log("[Mock] getFileShareInfo:", { topic_id, file_ids })
		return new Promise((resolve) => {
			setTimeout(() => {
				resolve({
					share_type: 4, // Internet
					has_password: true,
					pwd: "ABC123",
					file_ids,
					allow_copy: false,
					show_file_list: false,
					hide_creator_info: false,
				})
			}, 400)
		})
	},

	/**
	 * @description 获取分享项目树（按工作区分组）
	 * @param resource_type 资源类型数组（话题=5，文件集合=13，单文件=15）
	 * @returns 工作区和项目的树形结构
	 */
	getShareProjectsTree({ resource_type }: { resource_type: number[] }) {
		return fetch.post<
			Array<{
				workspace_id: string
				workspace_name: string
				projects: Array<{
					project_id: string
					project_name: string
				}>
			}>
		>("/api/v1/share/projects/tree", {
			resource_type,
		})
	},

	/**
	 * @description 获取分享资源列表
	 * @param page 页码
	 * @param page_size 每页数量
	 * @param keyword 搜索关键词（可选）
	 * @param resource_type 资源类型（支持数组）
	 * @param project_id 项目ID（可选）
	 * @param filter_type 状态过滤（可选：all/active/expired/cancelled）
	 * @param share_project 是否为项目分享（可选）
	 */
	getShareResourcesList({
		page,
		page_size,
		keyword,
		resource_type,
		project_id,
		filter_type,
		share_project = false,
	}: {
		page: number
		page_size: number
		keyword?: string
		resource_type: number | number[]
		project_id?: string
		filter_type?: string
		share_project?: boolean
	}) {
		return fetch.post("/api/v1/share/resources/list", {
			page,
			page_size,
			keyword,
			resource_type,
			project_id,
			filter_type,
			share_project,
		})
	},

	/**
	 * @description 取消分享资源
	 * @param resourceId 资源ID
	 */
	cancelShareResource({ resourceId }: { resourceId: string }) {
		return fetch.post(`/api/v1/share/resources/${resourceId}/cancel`, {})
	},

	/**
	 * @description 批量取消分享资源
	 * @param resourceIds 资源ID数组
	 */
	batchCancelShareResources({ resourceIds }: { resourceIds: string[] }) {
		return fetch.post(`/api/v1/share/resources/batch-cancel`, {
			resource_ids: resourceIds,
		})
	},

	/**
	 * @description 智能话题重命名
	 */
	smartTopicRename({ id, user_question }: { id: string; user_question: string }) {
		return fetch.post<{ topic_name: string }>("/api/v1/super-agent/topics/rename", {
			id,
			user_question,
		})
	},

	/**
	 * @description 替换文件
	 * @param id
	 * @param file_key
	 * @param file_name
	 */
	replaceFile({ id, file_key, file_name }: { id: string; file_key: string; file_name?: string }) {
		return fetch.post<FileItem>(`/api/v1/super-agent/file/${id}/replace`, {
			file_key,
			file_name,
		})
	},

	/**
	 * Create a batch download task for files under a topic.
	 * @param topic_id The topic id
	 * @param file_ids The file id list (empty array means all files)
	 * @returns Batch download task info
	 */
	createBatchDownload({
		file_ids,
		project_id,
		token,
	}: {
		file_ids: string[]
		project_id?: string
		token?: string
	}) {
		return fetch.post("/api/v1/super-agent/file/batch-download/create", {
			file_ids,
			project_id,
			token: token || "",
		})
	},

	/**
	 * Check the status of a batch download task.
	 * @param batch_key The batch task key
	 * @returns Batch download status and download url if ready
	 */
	checkBatchDownloadStatus(batch_key: string, token?: string) {
		const url = token
			? `/api/v1/super-agent/file/batch-download/check?batch_key=${batch_key}&token=${token}`
			: `/api/v1/super-agent/file/batch-download/check?batch_key=${batch_key}`
		return fetch.get(url)
	},

	/**
	 * @description 保存文件内容
	 * @param data
	 * @returns 包含每个文件保存结果的响应，success_files 中包含 updated_at
	 */
	saveFileContent(
		data: Array<{
			file_id: string
			content: any
			enable_shadow?: boolean
			expected_revision?: number
		}>,
	) {
		// 将保存过的file_id存入localStorage
		// const savedFileIds = JSON.parse(localStorage.getItem("saved_file_ids") || "[]")
		// data.forEach((item)  {
		// 	if (!savedFileIds.includes(item.file_id)) {
		// 		savedFileIds.push(item.file_id)
		// 		try {
		// 			localStorage.setItem("saved_file_ids", JSON.stringify(savedFileIds))
		// 		} catch (e) {
		// 			console.error("localStorage 写入失败", e)
		// 		}
		// 	}
		// })
		return fetch.post<SaveFileContentResponse>(`/api/v1/super-agent/file/save`, data)
	},

	/**
	 * @description 删除文件
	 * @param file_id
	 */
	deleteFile(file_id: string) {
		return fetch.delete(`/api/v1/super-agent/file/${file_id}`)
	},

	/**
	 * @description 新增：批量删除文件
	 * @param data
	 */
	deleteFiles(data: { file_ids: string[]; project_id?: string }) {
		return fetch.post<{ file_ids: string[]; project_id: number; count: number }>(
			`/api/v1/super-agent/file/batch-delete`,
			data,
		)
	},

	/**
	 * @description 删除目录（兼容旧版本）
	 * @param data
	 */
	deleteDirectory(data: { project_id: string; path: string }) {
		return fetch.post("/api/v1/super-agent/file/directory/delete", data)
	},

	/**
	 * @description 重命名文件或文件夹
	 * @param data
	 */
	renameFile(data: { file_id: string; target_name: string }) {
		return fetch.post(`/api/v1/super-agent/file/${data.file_id}/rename`, {
			target_name: data.target_name,
		})
	},

	/** 按当前访问权限批量查询项目名称。 */
	getProjectNames(projectIds: string[], signal?: AbortSignal) {
		return fetch.post<{ names: Record<string, string> }>(
			"/api/v1/super-agent/projects/names/queries",
			{ project_ids: projectIds },
			{ signal, enableErrorMessagePrompt: false },
		)
	},

	/**
	 * 获取项目列表
	 * @param param0
	 * @returns
	 */

	getProjects({
		workspace_id,
		project_name,
		order_by,
		sort,
		pin_priority,
		page,
		page_size,
	}: {
		workspace_id?: string
		project_name?: string
		order_by?: string
		sort?: string
		pin_priority?: number
		page: number
		page_size: number
	}) {
		return fetch.get<WithPage<ProjectListItem>>("/api/v1/super-agent/projects/queries", {
			params: {
				workspace_id,
				project_name,
				order_by,
				sort,
				pin_priority,
				page,
				page_size,
			},
			enableRequestUnion: true,
		})
	},

	/**
	 * 保存指定工作区内的项目顺序。
	 */
	moveProject(
		{
			source_project_id,
			target_workspace_id,
			pre_project_id,
			next_project_id,
			target_project_name,
		},
		options?: Omit<RequestConfig, "url">,
	) {
		return fetch.post(
			"/api/v1/super-agent/projects/move",
			{
				source_project_id,
				target_workspace_id,
				...(pre_project_id === undefined ? {} : { pre_project_id }),
				...(next_project_id === undefined ? {} : { next_project_id }),
				target_project_name,
			},
			options,
		)
	},

	/**
	 * 获取参与的协作项目列表
	 * @param workspace_id 工作区id
	 * @param page 页码
	 * @param page_size 每页条数
	 * @param show_collaboration 是否显示协作项目 1: 显示 0: 不显示
	 * @returns 协作项目列表
	 */
	getProjectsWithCollaboration(
		{
			workspace_id,
			project_name,
			page,
			page_size,
			show_collaboration = 1,
			sort_mode,
			include_special = 0,
			project_type,
			sort_field,
			sort_direction,
		}: {
			workspace_id?: string
			project_name?: string
			page: number
			page_size: number
			show_collaboration?: number
			sort_mode?: "workspace" | "recent"
			include_special?: number
			project_type?: "all" | "general" | "claw" | "micro-app" | "agent" | "skill"
			sort_field?: "last_active_at" | "updated_at" | "created_at"
			sort_direction?: "asc" | "desc"
		},
		options?: Omit<RequestConfig, "url">,
	) {
		return fetch.post<WithPage<ProjectListItem>>(
			"/api/v1/super-agent/projects/participated",
			{
				workspace_id,
				project_name,
				page,
				page_size,
				show_collaboration,
				sort_mode,
				include_special,
				project_type,
				sort_field,
				sort_direction,
			},
			options,
		)
	},

	/** 记录用户进入项目；后台详情读取不调用此接口。 */
	recordProjectVisit(id: string) {
		return fetch.post<{ id: string; last_active_at: string }>(
			`/api/v1/super-agent/projects/${id}/visit`,
			undefined,
			{ enableErrorMessagePrompt: false },
		)
	},

	/**
	 * @description 获取项目详情
	 * @param id
	 */
	getProjectDetail({ id }: { id: string }, options?: Omit<RequestConfig, "url">) {
		return fetch.get<ProjectListItem>(`/api/v1/super-agent/projects/${id}`, options)
	},

	/**
	 * @description 获取特殊项目（不存在时自动创建）
	 * @param key 项目标识
	 * @param project_mode 首次创建时写入的项目模式；已存在的项目不受影响
	 * @param topic_mode 首次创建时默认话题的模式；已存在的项目不受影响
	 */
	getSpecialProject({
		key,
		project_mode,
		topic_mode,
	}: {
		key: string
		project_mode?: string
		topic_mode?: string
	}) {
		return fetch.post<{ project: ProjectListItem; is_existing: boolean }>(
			"/api/v1/super-agent/user/special-projects",
			{ key, project_mode, topic_mode },
		)
	},

	/**
	 * @description 转交工作区的所有权
	 * @param workspace_ids 工作区ID数组
	 * @param receiver_id 接收者的用户id，必须同个组织下
	 * @param share_to_me 是否共享给我，默认为 false
	 * @param share_role 共享的角色，editor-编辑者，viewer-查看者，manage-可管理
	 * @param retain_original_location 是否保留原工作区位置
	 */
	transferWorkspaces({
		workspace_ids,
		receiver_id,
		share_to_me = false,
		share_role,
		retain_original_location = false,
	}: {
		workspace_ids: string[]
		receiver_id: string
		share_to_me?: boolean
		share_role?: "editor" | "viewer" | "manage"
		retain_original_location?: boolean
	}) {
		return fetch.post<{ code: number; message: string; data: any }>(
			"/api/v1/super-agent/workspaces/transfer",
			{
				workspace_ids,
				receiver_id,
				share_to_me,
				share_role,
				retain_original_location,
			},
		)
	},

	/**
	 * @description 转交项目的所有权
	 * @param project_ids 项目ID数组
	 * @param receiver_id 接收者的用户id，必须同个组织下
	 * @param share_to_me 是否分享给我
	 * @param share_role 分享的角色，editor-编辑者，viewer-查看者，manage-可管理
	 * @param retain_original_location 是否保留原项目位置
	 */
	transferProjects({
		project_ids,
		receiver_id,
		share_to_me,
		share_role,
		retain_original_location = false,
	}: {
		project_ids: string[]
		receiver_id: string
		share_to_me: boolean
		share_role?: "editor" | "viewer" | "manage"
		retain_original_location?: boolean
	}) {
		return fetch.post<{ code: number; message: string; data: any }>(
			"/api/v1/super-agent/projects/transfer",
			{
				project_ids,
				receiver_id,
				share_to_me,
				share_role,
				retain_original_location,
			},
		)
	},

	/**
	 * @description 新增项目
	 * @param workspace_id
	 * @param project_name
	 * @param project_description
	 * @param project_mode
	 * @param workdir
	 */
	createProject({
		workspace_id,
		project_name,
		project_description,
		project_mode,
		workdir,
	}: {
		workspace_id: string
		project_name: string
		project_description: string
		project_mode: TopicMode | ""
		workdir?: string
	}) {
		return fetch.post<CreatedProject>(`/api/v1/super-agent/projects`, {
			workspace_id,
			project_name,
			project_description,
			project_mode,
			workdir,
			dynamic_params: {
				message_version: "v2",
			},
		})
	},

	/**
	 * @description 编辑项目
	 * @param id
	 * @param project_name
	 * @param project_description
	 */
	editProject({
		id,
		project_name,
		project_description,
	}: {
		id: string
		project_name: string
		project_description?: string
	}) {
		return fetch.put<{ project_name: string }>(`/api/v1/super-agent/projects/${id}`, {
			project_name,
			project_description,
		})
	},

	/**
	 * @description 删除项目
	 * @param id
	 */
	deleteProject({ id }: { id: string }) {
		return fetch.delete(`/api/v1/super-agent/projects/${id}`)
	},

	/**
	 * @description 批量删除项目（单条删除也可走此接口，project_ids 传 1 个元素）
	 * @param data.project_ids 待删除的项目 ID 列表
	 */
	batchDeleteProjects(data: { project_ids: string[] }) {
		return fetch.post(`/api/v1/super-agent/projects/batch-delete`, data)
	},

	/**
	 * @description 保存用户上传的文件到项目文件
	 * @param data
	 */
	saveUploadFileToProject(data: {
		project_id: string
		topic_id?: string
		task_id?: string
		parent_id?: string
		file_key: string
		file_name: string
		file_size: number
		file_type?: string
		storage_type: "workspace" | "topic"
		source: UploadSource
		relative_file_path?: string
		is_hidden?: boolean
	}) {
		return fetch.post<SaveUploadFileToProjectResponse>(
			"/api/v1/super-agent/file/project/save",
			data,
		)
	},

	/**
	 * 获取模型列表
	 * @deprecated 使用 getModeList 代替
	 * @returns 模型列表
	 */
	getModelList() {
		return fetch.get<ModelItem[]>("/api/v1/super-magic-models")
	},

	/**
	 * 获取超级麦吉话题模型配置
	 * @param topic_id 话题id
	 * @returns 超级麦吉话题模型配置
	 */
	getSuperMagicTopicModel({ topic_id }: { topic_id: string }) {
		return fetch.get<SuperMagicTopicModelResponse>(
			`/api/v1/contact/users/setting/super-magic/topic-model/${topic_id}`,
			{
				enableRequestUnion: true,
			},
		)
	},

	/**
	 * 保存超级麦吉话题模型配置
	 * @param topic_id 话题id
	 * @param model_id 模型id
	 * @returns 保存结果
	 */
	saveSuperMagicTopicModel({
		cache_id,
		model_id,
		image_model_id,
		video_model_id,
		extra,
	}: {
		cache_id: string
		model_id?: string
		image_model_id?: string
		video_model_id?: string
		extra?: SuperMagicTopicModelExtra
	}) {
		return fetch.put<SuperMagicTopicModelResponse>(
			`/api/v1/contact/users/setting/super-magic/topic-model/${cache_id}`,
			{
				...(model_id && {
					model: {
						model_id,
					},
				}),
				...(image_model_id && {
					image_model: {
						model_id: image_model_id,
					},
				}),
				...(video_model_id && {
					video_model: {
						model_id: video_model_id,
					},
				}),
				...(extra && { extra }),
			},
			{
				enableRequestUnion: true,
			},
		)
	},

	/**
	 * @description 通过项目id获取上一次文件更新时间
	 * @param project_id
	 */
	getLastFileUpdateTime(
		{ project_id }: { project_id: string },
		requestConfig?: Omit<RequestConfig, "url">,
	) {
		return fetch.get(
			`/api/v1/super-agent/projects/${project_id}/last-file-updated-time`,
			requestConfig,
		)
	},

	/**
	 * @description 创建文件或文件夹
	 * @param data
	 * @param config Optional request config
	 */
	createFile(
		data: {
			project_id: string
			parent_id?: string | number
			file_name: string
			is_directory: boolean
			ignore_duplicate?: boolean
		},
		config?: { enableErrorMessagePrompt?: boolean },
	) {
		return fetch.post("/api/v1/super-agent/file", data, config)
	},

	/**
	 * 获取模式列表
	 * @returns 模式列表
	 */
	getModeList() {
		return fetch.get<WithPage<ModeItem>>(`/api/v1/modes`, {
			enableRequestUnion: true,
			headers: {
				"X-Magic-Image-Process": buildImageProcessQuery({
					resize: { h: 512, w: 512 },
					format: "webp",
				}),
			},
		})
	},

	/**
	 * 获取员工列表
	 * @returns 模式列表
	 */
	getCrewList() {
		return fetch.get<
			WithPage<CrewItemResponse> & {
				models: Record<string, ModelItem>
				default_agent_code?: string | null
			}
		>(`/api/v1/super-agents/featured`, {
			enableRequestUnion: true,
			headers: {
				"X-Magic-Image-Process": buildImageProcessQuery({
					resize: { h: 512, w: 512 },
					format: "webp",
				}),
			},
		})
	},

	/**
	 * 员工排序列表
	 * @returns 员工排序列表
	 */
	getAgentFeaturedSortList() {
		return fetch.get<SuperMagicAgentFeaturedSortListResponse>(
			`/api/v2/super-magic/agents/featured/sort-list`,
			{
				enableRequestUnion: true,
				headers: {
					"X-Magic-Image-Process": buildImageProcessQuery({
						resize: { h: 512, w: 512 },
						format: "webp",
					}),
				},
			},
		)
	},

	/**
	 * 获取默认模式模型列表
	 * @returns 默认模式模型列表
	 */
	getDefaultModeModelList() {
		return fetch.get<ModeItem & { models: Record<string, ModelItem> }>(
			`/api/v1/modes/default`,
			{
				enableRequestUnion: true,
				swCacheOption: "no-cache",
				headers: {
					"X-Magic-Image-Process": buildImageProcessQuery({
						resize: { h: 512, w: 512 },
						format: "webp",
					}),
				},
			},
		)
	},

	/**
	 * 获取技能配置
	 * @param playbook_id 剧本id
	 * @returns 技能配置
	 */
	getSceneConfig(playbook_id: string) {
		return fetch.get<PlaybookItem>(`/api/v1/super-agents/playbooks/${playbook_id}`, {
			enableRequestUnion: true,
			headers: {
				"X-Magic-Image-Process": buildImageProcessQuery({
					resize: { h: 512, w: 512 },
					format: "webp",
				}),
			},
		})
	},

	/**
	 * 移动项目到新的工作区
	 * @param source_project_id 项目id
	 * @param target_workspace_id 目标工作区id
	 * @param target_workspace_name 目标工作区名称
	 * @param target_project_name 目标项目名称（后端若支持则在移动时同步改名）
	 * @returns 移动项目结果
	 */
	moveProjectToNewWorkspace(
		{
			source_project_id,
			target_workspace_id,
			target_workspace_name,
			target_project_name,
			pre_project_id,
			next_project_id,
		}: {
			source_project_id: string
			target_workspace_id: string
			target_workspace_name?: string
			target_project_name?: string
			pre_project_id?: string | null
			next_project_id?: string | null
		},
		options?: Omit<RequestConfig, "url">,
	) {
		return fetch.post(
			"/api/v1/super-agent/projects/move",
			{
				source_project_id,
				target_workspace_id,
				target_workspace_name,
				target_project_name,
				...(pre_project_id === undefined ? {} : { pre_project_id }),
				...(next_project_id === undefined ? {} : { next_project_id }),
			},
			options,
		)
	},

	/**
	 * ======================== 消息队列相关API ========================
	 */

	/**
	 * 获取消息队列列表
	 */
	getMessageQueueList({
		project_id,
		topic_id,
		page = 1,
		page_size = 50,
	}: {
		project_id: string
		topic_id: string
		page?: number
		page_size?: number
	}) {
		return fetch.post(
			"/api/v1/super-agent/message-queue/queries",
			{
				project_id,
				topic_id,
				page,
				page_size,
			},
			{
				enableRequestUnion: false,
			},
		)
	},

	/**
	 * 添加消息到队列
	 */
	addMessageToQueue({
		project_id,
		topic_id,
		message_type,
		message_content,
		process_immediately,
	}: {
		project_id: string
		topic_id: string
		message_type: string
		message_content: any
		process_immediately?: boolean
	}) {
		return fetch.post<{ queue_id: string; status: number }>(
			"/api/v1/super-agent/message-queue",
			{
				project_id,
				topic_id,
				message_type,
				message_content,
				process_immediately,
			},
		)
	},

	/**
	 * 主动消费队列消息
	 */
	consumeQueueMessage({ messageId, force }: { messageId: string; force: boolean }) {
		return fetch.post<{ success: boolean; status: string; error_message: string | null }>(
			`/api/v1/super-agent/message-queue/${messageId}/consume`,
			{ force },
		)
	},

	/**
	 * 删除队列消息
	 */
	deleteQueueMessage({
		messageId,
		expectedSyncId,
	}: {
		messageId: string
		expectedSyncId?: string
	}) {
		return fetch.delete<{ rows: number; removed: boolean }>(
			`/api/v1/super-agent/message-queue/${messageId}`,
			{ expected_sync_id: expectedSyncId },
		)
	},

	restoreQueueMessage({
		messageId,
		...params
	}: {
		messageId: string
		project_id: string
		topic_id: string
		message_type: string
		message_content: Record<string, unknown>
		before_id: string | null
		after_id: string | null
		original_index: number
		expected_sync_id: string
	}) {
		return fetch.post<
			| { result: "accepted"; queue_id: string; status: number }
			| { result: "original_unavailable" }
		>(`/api/v1/super-agent/message-queue/${messageId}/restore`, params)
	},

	moveQueueMessage({
		messageId,
		before_id,
		after_id,
	}: {
		messageId: string
		before_id: string | null
		after_id: string | null
	}) {
		return fetch.patch<{ queue_id: string; sort_order: string }>(
			`/api/v1/super-agent/message-queue/${messageId}/position`,
			{ before_id, after_id },
		)
	},

	/**
	 * 编辑队列消息
	 */
	updateQueueMessage({
		messageId,
		project_id,
		topic_id,
		message_type,
		message_content,
	}: {
		messageId: string
		project_id: string
		topic_id: string
		message_type: string
		message_content: any
	}) {
		return fetch.put(`/api/v1/super-agent/message-queue/${messageId}`, {
			project_id,
			topic_id,
			message_type,
			message_content,
		})
	},

	/** ======================== 消息撤回相关API ======================== */
	/**
	 * 撤回消息
	 * @param topic_id 话题id
	 * @param message_id 消息id
	 */
	undoMessage({ topic_id, message_id }: { topic_id: string; message_id: string }) {
		return fetch.post(`/api/v1/super-agent/topics/${topic_id}/checkpoints/rollback/start`, {
			target_message_id: message_id,
		})
	},

	/*
	 * 确认撤回消息
	 * @param topic_id 话题id
	 */
	confirmUndoMessage({ topic_id }: { topic_id: string }) {
		return fetch.post(`/api/v1/super-agent/topics/${topic_id}/checkpoints/rollback/commit`)
	},

	/**
	 * 取消消息撤回
	 * @param topic_id 话题id
	 */
	cancelUndoMessage({ topic_id }: { topic_id: string }) {
		return fetch.post(`/api/v1/super-agent/topics/${topic_id}/checkpoints/rollback/undo`)
	},

	/**
	 * 确认是否可以撤回消息
	 * @param topic_id 话题id
	 * @param message_id 消息id
	 */
	checkCanUndoMessage({ topic_id, message_id }: { topic_id: string; message_id: string }) {
		return fetch.post<{
			can_rollback: boolean
		}>(`/api/v1/super-agent/topics/${topic_id}/checkpoints/rollback/check`, {
			target_message_id: message_id,
		})
	},

	/**
	 * 获取文件历史版本
	 * @param file_id 文件id
	 * @returns 文件历史版本
	 */
	getFileHistoryVersions({ file_id, page_size }: { file_id: string; page_size: number }) {
		return fetch.get<WithPage<FileHistoryVersion>>(
			`/api/v1/super-agent/file/${file_id}/versions`,
			{ params: { page_size } },
		)
	},

	/**
	 * 获取文件信息
	 * @param file_id 文件id
	 * @returns 文件信息
	 */
	getFileInfo(
		{ file_id }: { file_id: string },
		options?: { enableErrorMessagePrompt?: boolean },
	) {
		const config =
			options?.enableErrorMessagePrompt === undefined
				? undefined
				: { enableErrorMessagePrompt: options.enableErrorMessagePrompt }
		return fetch.get<FileInfo>(`/api/v1/super-agent/file/${file_id}`, config)
	},

	resolveFileReferences(references: FileReferenceSelector[], signal?: AbortSignal) {
		return fetch.post<{ results: FileReferenceResult[] }>(
			"/api/v1/super-agent/file/resolve-references",
			{ references },
			{ signal, enableErrorMessagePrompt: false },
		)
	},

	/**
	 * 回滚文件版本
	 * @param file_id 文件id
	 * @param version 版本
	 * @returns 回滚文件版本结果
	 */
	rollbackFileVersion({ file_id, version }: { file_id: string; version: number }) {
		return fetch.post(`/api/v1/super-agent/file/${file_id}/rollback`, {
			file_id,
			version,
		})
	},

	/**
	 * Agent列表
	 * @deprecated 当前主流程已迁移至 v2 智能体列表接口，请勿新增调用。
	 */
	getAgentsList() {
		return fetch.post<SuperMagicAgentListResponse>("/api/v1/super-magic/agents/queries")
	},

	/**
	 * 新增/编辑Agent
	 * @deprecated 当前主流程已迁移至 v2 的创建和更新接口，请勿新增调用。
	 */
	editAgent({ data }: { data: any }) {
		return fetch.post(`/api/v1/super-magic/agents`, data)
	},
	/**
	 * AI优化Agent
	 * @deprecated 当前主流程已不再使用该接口，请勿新增调用。
	 */
	AIOptimizationAgent({ data }: { data: { optimization_type: string; agent: any } }) {
		return fetch.post(`/api/v1/super-magic/agents/ai-optimize`, data)
	},
	/**
	 * 获取Agent详情
	 * @deprecated 当前主流程已迁移至 v2 智能体详情接口，请勿新增调用。
	 */
	getAgentDetail({ agent_id }: { agent_id: string }) {
		return fetch.get(`/api/v1/super-magic/agents/${agent_id}`)
	},
	/**
	 * 删除Agent
	 * @deprecated 当前主流程已迁移至 v2 智能体删除接口，请勿新增调用。
	 */
	deleteAgent({ agent_id }: { agent_id: string }) {
		return fetch.delete(`/api/v1/super-magic/agents/${agent_id}`)
	},

	/**
	 * Agent列表排序
	 */
	sortAgents({ data }: { data: SuperMagicAgentOrderPayload }) {
		return fetch.post(`/api/v1/super-magic/agents/order`, data)
	},

	/**
	 * 获取可用的自定义工具列表
	 */
	getAvailableCustomTools({ with_builtin }: { with_builtin: boolean }) {
		return fetch.post(`/api/v1/flows/queries/tool-sets`, { with_builtin })
	},

	/**
	 * 获取内置工具列表（响应内容随语言变化）
	 */
	getBuiltInTools() {
		return fetch.get<BuiltinToolCategory[]>("/api/v1/super-magic/agents/builtin-tools")
	},

	/**
	 * 置顶协作项目
	 * @param project_id 项目id
	 * @param data 数据
	 * @returns 更新项目置顶状态结果
	 */
	updateProjectPinStatus(
		project_id: string,
		data: {
			is_pin: boolean
			target_workspace_id?: string
			pre_project_id?: string | null
			next_project_id?: string | null
		},
		options?: Omit<RequestConfig, "url">,
	) {
		return fetch.put(
			`/api/v1/super-agent/projects/${project_id}/pin`,
			{
				is_pin: data.is_pin,
				...(data.target_workspace_id === undefined
					? {}
					: { target_workspace_id: data.target_workspace_id }),
				...(data.pre_project_id === undefined
					? {}
					: { pre_project_id: data.pre_project_id }),
				...(data.next_project_id === undefined
					? {}
					: { next_project_id: data.next_project_id }),
			},
			options,
		)
	},

	/**
	 * @description 复制分享资源（新接口）
	 * @param params.resource_id 资源ID
	 * @param params.target_workspace_id 目标工作区ID
	 * @param params.target_project_name 目标项目名称（可选）
	 * @param params.password 访问密码（可选）
	 */
	copyShareResource(params: {
		resource_id: string
		target_workspace_id: string
		target_project_name?: string
		password?: string
	}) {
		return fetch.post<{
			copy_record_id: number
			new_project_id: number
			status: "running" | "finished" | "failed"
			progress: number
			processed_files: number
			total_files: number
		}>("/api/v1/share/resources/copy", params)
	},

	/**
	 * @description 发起图片生成
	 * @deprecated 后端将废弃 /api/v1/design/generate-image，请使用 generateImages({ generate_num: 1 }) 替代。
	 * @param params 图片生成请求参数
	 * @returns 图片生成响应数据
	 */
	generateImage(params: GenerateImageRequest) {
		return fetch.post<GenerateImageResponse>("/api/v1/design/generate-image", params)
	},

	/**
	 * @description 发起多图生成
	 * @param params 多图生成请求参数
	 * @returns 多图生成响应数据
	 */
	generateImages(params: GenerateImagesRequest) {
		return fetch.post<GenerateImagesResponse>("/api/v1/design/generate-images", params)
	},

	/**
	 * @description AI 补全图片提示词
	 * @param params 提示词补全请求参数
	 * @returns 提示词补全响应数据
	 */
	completeImagePrompt(params: CompleteImagePromptRequest) {
		return fetch.post<CompleteImagePromptResponse>(
			"/api/v1/design/image-prompt/complete",
			params,
		)
	},

	/**
	 * @description AI 优化文本内容
	 * @param params 文本内容优化请求参数
	 * @returns 文本内容优化响应数据
	 */
	completeTextContent(params: CompleteTextContentRequest) {
		return fetch.post<CompleteTextContentResponse>(
			"/api/v1/design/text-content/complete",
			params,
		)
	},

	/**
	 * @description 发起画布图片去背景
	 * @param params 去背景请求参数（project_id、image_id、file_dir、file_path）
	 * @returns 任务创建结果，可与 getImageGenerationResult 配合轮询
	 */
	removeBackground(params: RemoveBackgroundRequest) {
		return fetch.post<GenerateImageResponse>("/api/v1/design/remove-background", params)
	},

	/**
	 * @description 发起画布橡皮擦除
	 * @param params 擦除请求参数（project_id、image_id、file_dir、file_path 等）
	 * @returns 任务创建结果，可与 getImageGenerationResult 配合轮询
	 */
	eraser(params: EraserRequest) {
		return fetch.post<GenerateImageResponse>("/api/v1/design/eraser", params)
	},

	/**
	 * @description 发起画布扩图
	 * @param params 扩图请求参数（project_id、image_id、file_path、canvas_path、mask_path 等）
	 * @returns 任务创建结果，可与 getImageGenerationResult 配合轮询
	 */
	expandImage(params: GenerateExtendedImageRequest) {
		return fetch.post<GenerateImageResponse>("/api/v1/design/expand-image", params)
	},

	/**
	 * @description 查询图片生成结果
	 * @deprecated 后端将废弃 /api/v1/design/image-generation-result，请使用 getImageGenerationResults 替代。
	 * @param params 查询参数
	 * @returns 图片生成结果响应数据
	 */
	getImageGenerationResult(params: GetImageGenerationResultParams) {
		return fetch.get<ImageGenerationResultResponse>("/api/v1/design/image-generation-result", {
			params: {
				project_id: params.project_id,
				image_id: params.image_id,
			},
		})
	},

	/**
	 * @description 查询多图生成结果
	 * @param params 查询参数
	 * @returns 多图生成结果响应数据
	 */
	getImageGenerationResults(params: GetImageGenerationResultsParams) {
		return fetch.get<ImageGenerationResultsResponse>(
			"/api/v1/design/image-generation-results",
			{
				params: {
					project_id: params.project_id,
					image_id: params.image_id,
				},
			},
		)
	},

	/**
	 * @description 发起视频生成
	 * @param params 视频生成请求参数
	 * @returns 视频生成响应数据
	 */
	generateVideo(params: GenerateVideoRequest) {
		return fetch.post<GenerateVideoResponse>("/api/v1/design/generate-video", params)
	},

	/**
	 * @description 预估视频生成积分
	 * @param params 视频生成请求参数
	 * @returns 视频积分预估响应数据
	 */
	estimateVideoPoints(
		params: GenerateVideoRequest,
		options?: { enableErrorMessagePrompt?: boolean },
	) {
		return fetch.post<EstimateVideoPointsResponse>(
			"/api/v1/design/estimate-video-points",
			params,
			options?.enableErrorMessagePrompt === undefined
				? undefined
				: { enableErrorMessagePrompt: options.enableErrorMessagePrompt },
		)
	},

	/**
	 * @description 查询视频生成结果
	 * @param params 查询参数
	 * @returns 视频生成结果响应数据
	 */
	getVideoGenerationResult(params: GetVideoGenerationResultParams) {
		return fetch.get<VideoGenerationResultResponse>("/api/v1/design/video-generation-result", {
			params: {
				project_id: params.project_id,
				video_id: params.video_id,
			},
		})
	},

	/**
	 * @description 发起转高清
	 * @param params 转高清请求参数
	 * @returns 转高清响应数据
	 */
	generateHighImage(params: GenerateHightImageRequest) {
		return fetch.post<GenerateHightImageResponse>("/api/v1/design/generate-high-image", params)
	},

	/**
	 * @description 获取转高清配置
	 * @returns 转高清配置响应数据
	 */
	getConvertHightConfig() {
		return fetch
			.get<AiAbilityAvailabilityResponse>("/api/v1/ai-abilities/availability")
			.then((response) => response.abilities.image_convert_high)
	},

	/**
	 * @description 获取 AI 能力可用性配置
	 * @returns AI 能力可用性响应数据
	 */
	getAiAbilityAvailability() {
		return fetch.get<AiAbilityAvailabilityResponse>("/api/v1/ai-abilities/availability")
	},

	/**
	 * @description 识别图片标记位置的内容
	 * @param params 识别参数
	 * @returns 识别结果
	 */
	identifyImageMark(params: IdentifyImageMarkRequest) {
		return fetch.post<IdentifyImageMarkResponse>("/api/v1/design/identify-image-mark", params)
	},

	/**
	 * @description 预加载沙箱
	 * @param id
	 */
	preWarmSandbox({
		topic_id,
		workspace_id,
		project_id,
	}: {
		topic_id?: string
		workspace_id?: string
		project_id?: string
	}) {
		return fetch.post(`/api/v1/super-agent/sandbox/pre-warm`, {
			topic_id,
			workspace_id,
			project_id,
		})
	},

	// Recording Summary APIs
	...generateRecordingSummaryApi(fetch),

	// Audio project list (PC recordings page)
	...generateAudioProjectsApi(fetch),

	// Collaboration APIs
	...generateCollaborationApi(fetch),

	/**
	 * Match LLM models by keyword for autocomplete suggestions
	 * @param name - search name
	 */
	matchLlmModels(name: string) {
		return fetch.get<LlmModelMatchResponse>("/api/v1/llm-model/match", { params: { name } })
	},

	/**
	 * @description 获取话题建议
	 * @param data 话题建议请求参数
	 * - type: 关系类型，见 {@link SuggestionRelationType}（1 = 任务维度的推荐提问）
	 * - relation_id: 关联 id（task_id）
	 * @param options 可选配置，支持通过 `signal` 取消请求
	 */
	getTopicSuggestions(
		data: { type: SuggestionRelationType; relation_id: string },
		options?: { signal?: AbortSignal },
	) {
		return fetch.post<SuggestionsMeta>("/api/v1/im/conversations/follow-up-suggestions", data, {
			signal: options?.signal,
			enableRequestUnion: true,
		})
	},

	/**
	 * @description 获取对话的特殊 workspace
	 * @returns 特殊 workspace
	 */
	getChatWorkspace() {
		return fetch.get<Workspace>("/api/v1/super-agent/workspaces/app/chat")
	},

	...generateMicroAppApi(fetch),
	...generateAiCanvasApi(fetch),
})

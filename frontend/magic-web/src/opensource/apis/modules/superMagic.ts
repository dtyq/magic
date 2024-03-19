import type { HttpClient, RequestConfig } from "@/opensource/apis/core/HttpClient"
import type {
	CopiedProjectResponse,
	CopyProjectRequest,
} from "@/opensource/pages/share/components/CopyProjectModal/types"
import { genRequestUrl } from "@/opensource/utils/http"

import {
	CreatedProject,
	CrewItem,
	CrewItemResponse,
	FileHistoryVersion,
	FileInfo,
	ModeItem,
	ProjectListItem,
	Topic,
	TopicMode,
	WithPage,
	Workspace,
} from "@/opensource/pages/superMagic/pages/Workspace/types"
import { FileItem } from "@/opensource/pages/superMagic/components/SelectPathModal"
import { UploadSource } from "@/opensource/pages/superMagic/components/MessageEditor/hooks/useFileUpload"
import { SaveUploadFileToProjectResponse } from "@/opensource/pages/superMagic/utils/api"
import { ModelItem } from "@/opensource/pages/superMagic/components/MessageEditor/components/ModelSwitch/types"
import { generateRecordingSummaryApi } from "./superMagic/recordSummary"
import { generateCollaborationApi } from "./superMagic/collaboration"
import { AttachmentItem } from "@/opensource/pages/superMagic/components/TopicFilesButton/hooks"
import { buildImageProcessQuery } from "@/opensource/utils/image-processing"
import { TreeNode } from "@dtyq/user-selector"
import { SKILL_CONFIGS_MAP } from "@/opensource/pages/superMagic/components/MainInputContainer/mock"
import { SkillConfig } from "@/opensource/pages/superMagic/components/MainInputContainer/panels"
import {
	IdentifyImageMarkRequest,
	IdentifyImageMarkResponse,
} from "@/opensource/components/CanvasDesign/types.magic"
import { SceneConfigStore } from "@/opensource/pages/superMagic/components/MainInputContainer/stores"
import { PlaybookItem } from "./crew"

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

export interface BatchSavePayload {
	project_id: string
	parent_id: string
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
	}>
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
	/** 是否支持转高清，如果没有配置则不支持转高清 */
	supported: boolean
	/** 支持的尺寸配置列表 */
	image_size_config: {
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

function shuffleScenes(scenes: Array<(typeof SKILL_CONFIGS_MAP)[keyof typeof SKILL_CONFIGS_MAP]>) {
	const shuffled = [...scenes]

	for (let index = shuffled.length - 1; index > 0; index -= 1) {
		const randomIndex = Math.floor(Math.random() * (index + 1))
		;[shuffled[index], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[index]]
	}

	return shuffled
}

function getRandomScenes() {
	const scenes = Object.values(SKILL_CONFIGS_MAP)
	if (!scenes.length) return []

	const count = Math.floor(Math.random() * scenes.length) + 1

	return shuffleScenes(scenes).slice(0, count)
}

export const generateSuperMagicApi = (fetch: HttpClient) => ({
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
	 * @description 批量移动文件或文件夹（支持跨项目）
	 * @param {object} params
	 * @param {string[]} params.file_ids 文件ID列表
	 * @param {string} params.target_parent_id 目标父级ID
	 * @param {string} params.pre_file_id 前置文件ID
	 * @param {string} params.project_id 源项目ID
	 * @param {string} params.target_project_id 目标项目ID
	 * @param {string[]} params.keep_both_file_ids 保留两者的文件ID列表
	 */
	moveFiles(params: {
		file_ids: string[]
		project_id?: string
		target_project_id?: string
		target_parent_id: string
		pre_file_id?: string
		keep_both_file_ids?: string[]
	}) {
		return fetch.post(`/api/v1/super-agent/file/batch-move`, params)
	},
	/**
	 * @description 批量复制文件或文件夹（支持跨项目）
	 * @param {object} params
	 * @param {string[]} params.file_ids 文件ID列表
	 * @param {string} params.target_parent_id 目标父级ID
	 * @param {string} params.pre_file_id 前置文件ID
	 * @param {string} params.project_id 源项目ID
	 * @param {string} params.target_project_id 目标项目ID
	 * @param {string[]} params.keep_both_file_ids 保留两者的文件ID列表
	 */
	copyFiles(params: {
		file_ids: string[]
		project_id?: string
		target_project_id?: string
		target_parent_id: string
		pre_file_id?: string
		keep_both_file_ids?: string[]
	}) {
		return fetch.post(`/api/v1/super-agent/file/batch-copy`, params)
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

		return fetch.get(
			genRequestUrl(
				`/api/v1/super-agent/admin/billing-manager/organizations`,
				{},
				{
					page: page.toString(),
					page_size: page_size.toString(),
					...(organization_name && { organization_name }),
					...(magic_id && { magic_id }),
				},
			),
		)
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
		return fetch.get(
			genRequestUrl(
				`/api/v1/admin/ai/content-audit/topic/${resource_id}/messages`,
				{},
				{
					page,
					page_size,
					sort_direction,
				},
			),
		)
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
		return fetch.get(
			genRequestUrl(
				`/api/v1/admin/ai/content-audit/project/${projectId}/attachments`,
				{},
				{
					page: 1,
					page_size: 999,
					token: temporaryToken || "",
					project_id: projectId,
				},
			),
		)
	},

	// 通过项目id获取附件列表
	getAttachmentsByProjectId(params: { projectId: string; temporaryToken: string }) {
		return fetch.post<{ tree: AttachmentItem[]; list: AttachmentItem[]; total: number }>(
			`/api/v1/super-agent/projects/${params?.projectId}/attachments`,
			{
				page: 1,
				page_size: 999,
				file_type: ["user_upload", "process", "system_auto_upload", "directory"],
				token: params?.temporaryToken || "",
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
		return fetch.get(
			genRequestUrl(
				`/api/v1/admin/ai/content-audit/topic/${params?.topic_id}/attachments`,
				{},
				{
					page: 1,
					page_size: 999,
					file_type: ["user_upload", "process", "system_auto_upload"],
					token: params.temporary_token || "",
					topic_id: params?.topic_id,
				},
			),
		)
	},

	/**
	 * @description 获取工作区列表
	 * @param page
	 * @param page_size
	 */
	getWorkspaces({ page, page_size }: { page: number; page_size: number }) {
		return fetch.get(
			`/api/v1/super-agent/workspaces/queries?page=${page}&page_size=${page_size}`,
			{
				enableRequestUnion: true,
			},
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
	 * @description 新增工作区
	 * @param workspace_name
	 */
	createWorkspace({ workspace_name }: { workspace_name: string }) {
		return fetch.post<Workspace>(
			`/api/v1/super-agent/workspaces`,
			{ workspace_name },
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
	editWorkspace({ id, workspace_name }: { id: string; workspace_name: string }) {
		return fetch.put(
			`/api/v1/super-agent/workspaces/${id}`,
			{ workspace_name },
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
	 * @description 通过工作区id获取话题列表
	 * @param id
	 * @param page
	 * @param page_size
	 */
	getTopicsByProjectId({ id, page, page_size }: { id: string; page: number; page_size: number }) {
		return fetch.get<WithPage<Topic>>(
			genRequestUrl("/api/v1/super-agent/projects/${id}/topics", { id }, { page, page_size }),
		)
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
		return fetch.post(
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
		return fetch.get(`/api/v1/share/resources/${code}/setting`)
	},

	/**
	 * @description 获取分享资源的文件列表
	 * @param resource_id 资源ID
	 * @param password 密码（可选）
	 */
	getShareResourceFiles({ resource_id, password }: { resource_id: string; password?: string }) {
		return fetch.post(`/api/v1/share/resources/${resource_id}/files/queries`, {
			pwd: password,
			page: 1,
			page_size: 999,
		})
	},

	/**
	 * @description 获取分享资源ID（仅用于文件分享）
	 * @returns 返回资源ID
	 */
	getShareResourceId() {
		return fetch.post<{ id: string }>("/api/v1/share/resources/id", {})
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
		extra?: {
			allow_copy_project_files?: boolean
			show_original_info?: boolean
			view_file_list?: boolean
			hide_created_by_super_magic?: boolean
			allow_download_project_file?: boolean
		}
		project_id?: string
	}) {
		return fetch.post("/api/v1/share/resources/create", {
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
			token: token || (window as any).temporary_token || "",
		})
	},

	/**
	 * Check the status of a batch download task.
	 * @param batch_key The batch task key
	 * @returns Batch download status and download url if ready
	 */
	checkBatchDownloadStatus(batch_key: string) {
		const token = (window as any).temporary_token
		const url = token
			? `/api/v1/super-agent/file/batch-download/check?batch_key=${batch_key}&token=${token}`
			: `/api/v1/super-agent/file/batch-download/check?batch_key=${batch_key}`
		return fetch.get(url)
	},

	/**
	 * @description 保存文件内容
	 * @param data
	 */
	saveFileContent(
		data: Array<{
			file_id: string
			content: any
			enable_shadow?: boolean
		}>,
	) {
		// // 将保存过的file_id存入localStorage
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
		return fetch.post(`/api/v1/super-agent/file/save`, data)
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
		return fetch.post(`/api/v1/super-agent/file/batch-delete`, data)
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

	/**
	 * 获取项目列表
	 * @param param0
	 * @returns
	 */
	getProjects({
		workspace_id,
		project_name,
		page,
		page_size,
	}: {
		workspace_id?: string
		project_name?: string
		page: number
		page_size: number
	}) {
		return fetch.get<WithPage<ProjectListItem>>(
			genRequestUrl(
				"/api/v1/super-agent/projects/queries",
				{},
				{
					workspace_id,
					project_name,
					page,
					page_size,
				},
			),
			{
				enableRequestUnion: true,
			},
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
		}: {
			workspace_id?: string
			project_name?: string
			page: number
			page_size: number
			show_collaboration?: number
		},
		options?: Omit<RequestConfig, "url">,
	) {
		return fetch.post<WithPage<ProjectListItem>>(
			genRequestUrl("/api/v1/super-agent/projects/participated"),
			{ workspace_id, project_name, page, page_size, show_collaboration },
			options,
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
		})
	},

	/**
	 * @description 编辑项目
	 * @param id
	 * @param workspace_id
	 * @param project_name
	 * @param project_description
	 */
	editProject({
		id,
		workspace_id,
		project_name,
		project_description,
	}: {
		id: string
		workspace_id: string
		project_name: string
		project_description?: string
	}) {
		return fetch.put<{ project_name: string }>(`/api/v1/super-agent/projects/${id}`, {
			workspace_id,
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
	 * @description 保存用户上传的文件到项目文件
	 * @param data
	 */
	saveUploadFileToProject(data: {
		project_id: string
		topic_id?: string
		task_id?: string
		file_key: string
		file_name: string
		file_size: number
		file_type?: string
		storage_type: "workspace" | "topic"
		source: UploadSource
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
		return fetch.get<{
			model: Partial<ModelItem>
			image_model?: Partial<ModelItem>
		}>(`/api/v1/contact/users/setting/super-magic/topic-model/${topic_id}`, {
			enableRequestUnion: true,
		})
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
	}: {
		cache_id: string
		model_id?: string
		image_model_id?: string
	}) {
		return fetch.put(
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
	getLastFileUpdateTime({ project_id }: { project_id: string }) {
		return fetch.get(`/api/v1/super-agent/projects/${project_id}/last-file-updated-time`)
	},

	/**
	 * @description 导出pdf或者ppt
	 * @param data
	 */
	exportPdfOrPpt(data: {
		file_ids: string[]
		project_id?: string
		is_debug?: boolean
		convert_type?: "pdf" | "ppt"
	}) {
		return fetch.post("/api/v1/super-agent/file-convert/create", {
			...data,
			// @ts-ignore
			token: window.temporary_token,
		})
	},

	/**
	 * @description 创建文件或文件夹
	 * @param data
	 */
	createFile(data: {
		project_id: string
		parent_id?: string | number
		file_name: string
		is_directory: boolean
	}) {
		return fetch.post("/api/v1/super-agent/file", data)
	},

	/**
	 * @description 查询文件导出pdf或者ppt的状态
	 * @param task_key
	 */
	checkExportPdfOrPptStatus(task_key: string) {
		const token = (window as any).temporary_token
		const url = token
			? `/api/v1/super-agent/file-convert/check?task_key=${task_key}&token=${token}`
			: `/api/v1/super-agent/file-convert/check?task_key=${task_key}`
		return fetch.get(url)
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
					resize: { h: 32, w: 32 },
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
		return fetch.get<WithPage<CrewItemResponse> & { models: Record<string, ModelItem> }>(
			`/api/v1/super-agents/featured`,
			{
				enableRequestUnion: true,
				headers: {
					"X-Magic-Image-Process": buildImageProcessQuery({
						resize: { h: 32, w: 32 },
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
					resize: { h: 32, w: 32 },
					format: "webp",
				}),
			},
		})
	},

	/**
	 * 移动项目到新的工作区
	 * @param source_project_id 项目id
	 * @param target_workspace_id 目标工作区id
	 * @returns 移动项目结果
	 */
	moveProjectToNewWorkspace({
		source_project_id,
		target_workspace_id,
	}: {
		source_project_id: string
		target_workspace_id: string
	}) {
		return fetch.post("/api/v1/super-agent/projects/move", {
			source_project_id,
			target_workspace_id,
		})
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
				enableRequestUnion: true,
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
	}: {
		project_id: string
		topic_id: string
		message_type: string
		message_content: any
	}) {
		return fetch.post("/api/v1/super-agent/message-queue", {
			project_id,
			topic_id,
			message_type,
			message_content,
		})
	},

	/**
	 * 主动消费队列消息
	 */
	consumeQueueMessage({ messageId }: { messageId: string }) {
		return fetch.post(`/api/v1/super-agent/message-queue/${messageId}/consume`, {})
	},

	/**
	 * 删除队列消息
	 */
	deleteQueueMessage({ messageId }: { messageId: string }) {
		return fetch.delete(`/api/v1/super-agent/message-queue/${messageId}`)
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
			genRequestUrl(`/api/v1/super-agent/file/${file_id}/versions`, {}, { page_size }),
		)
	},

	/**
	 * 获取文件信息
	 * @param file_id 文件id
	 * @returns 文件信息
	 */
	getFileInfo({ file_id }: { file_id: string }) {
		return fetch.get<FileInfo>(`/api/v1/super-agent/file/${file_id}`)
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
	 */
	getAgentsList() {
		return fetch.post("/api/v1/super-magic/agents/queries")
	},

	/**
	 * 新增/编辑Agent
	 */
	editAgent({ data }: { data: any }) {
		return fetch.post(`/api/v1/super-magic/agents`, data)
	},
	/**
	 * AI优化Agent
	 */
	AIOptimizationAgent({ data }: { data: { optimization_type: string; agent: any } }) {
		return fetch.post(`/api/v1/super-magic/agents/ai-optimize`, data)
	},
	/**
	 * 获取Agent详情
	 */
	getAgentDetail({ agent_id }: { agent_id: string }) {
		return fetch.get(`/api/v1/super-magic/agents/${agent_id}`)
	},
	/**
	 * 删除Agent
	 */
	deleteAgent({ agent_id }: { agent_id: string }) {
		return fetch.delete(`/api/v1/super-magic/agents/${agent_id}`)
	},

	/**
	 * Agent列表排序
	 */
	sortAgents({ data }: { data: { all: string[]; frequent: string[] } }) {
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
		},
	) {
		return fetch.put(`/api/v1/super-agent/projects/${project_id}/pin`, data)
	},

	/**
	 * @description 复制分享资源（新接口）
	 * @param params.resource_id 资源ID
	 * @param params.target_workspace_id 目标工作区ID
	 * @param params.password 访问密码（可选）
	 */
	copyShareResource(params: {
		resource_id: string
		target_workspace_id: string
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
	 * @param params 图片生成请求参数
	 * @returns 图片生成响应数据
	 */
	generateImage(params: GenerateImageRequest) {
		return fetch.post<GenerateImageResponse>("/api/v1/design/generate-image", params)
	},

	/**
	 * @description 查询图片生成结果
	 * @param params 查询参数
	 * @returns 图片生成结果响应数据
	 */
	getImageGenerationResult(params: GetImageGenerationResultParams) {
		return fetch.get<ImageGenerationResultResponse>(
			genRequestUrl(
				"/api/v1/design/image-generation-result",
				{},
				{
					project_id: params.project_id,
					image_id: params.image_id,
				},
			),
		)
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
		return fetch.get<GetConvertHightConfigResponse>("/api/v1/design/convert-high/config")
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
	preWarmSandbox({ topic_id, workspace_id }: { topic_id?: string; workspace_id?: string }) {
		return fetch.post(`/api/v1/super-agent/sandbox/pre-warm`, {
			topic_id,
			workspace_id,
		})
	},

	// Recording Summary APIs
	...generateRecordingSummaryApi(fetch),

	// Collaboration APIs
	...generateCollaborationApi(fetch),

	/**
	 * Match LLM models by keyword for autocomplete suggestions
	 * @param name - search name
	 */
	matchLlmModels(name: string) {
		return fetch.get<LlmModelMatchResponse>(
			genRequestUrl("/api/v1/llm-model/match", {}, { name }),
		)
	},
})

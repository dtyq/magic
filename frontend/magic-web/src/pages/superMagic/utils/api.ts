import { RecycleBinApi } from "@/apis"
import { defaultMagicClient as magicClient } from "@/infrastructure/network/http/runtime"
import { DownloadImageMode } from "../pages/Workspace/types"
import {
	getAccessProjectId,
	getAccessTopicId,
	getShareAccessToken,
	isSharePageLocation,
	shouldWaitForShareAccess,
	type FileAccessContext,
} from "../fileAccess/fileAccessContext"
import { getSuperIdState } from "./query"
import { WorkspaceStateCache } from "./superMagicCache"
import { userStore } from "@/models/user"
import { ImageProcessOptions, buildImageProcessQuery } from "@/utils/image-processing"
import { getFileUrlDownloadModeForNoWatermark } from "@/utils/aiWatermarkPreviewFileUrlMode"
import { stringifyUnknownError } from "@/utils/error"

function resolveSessionFileIdentity() {
	const workspaceState = WorkspaceStateCache.get(userStore.user.userInfo)
	const superIdState = getSuperIdState()
	return {
		projectId: workspaceState?.projectId || superIdState?.projectId || "",
		topicId: workspaceState?.topicId || superIdState?.topicId || "",
	}
}

function resolveFileRequestIdentity(access?: FileAccessContext) {
	if (access?.kind === "share") {
		return {
			token: access.token,
			projectId: access.projectId,
			topicId: access.topicId ?? "",
		}
	}
	// Share pages must not inherit the host session after SPA navigation.
	if (!access && isSharePageLocation()) {
		return { token: "", projectId: "", topicId: "" }
	}
	const session = resolveSessionFileIdentity()
	return {
		token: "",
		projectId: getAccessProjectId(access, session.projectId),
		topicId: getAccessTopicId(access, session.topicId),
	}
}

// import { REMOTE_HTTP_URL } from "../constans"
// export const getWorkspaces = async ({ page, page_size }: { page: number; page_size: number }) => {
// 	return magicClient.get(
// 		`/api/v1/super-agent/workspaces/queries?page=${page}&page_size=${page_size}`,
// 		{
// 			enableRequestUnion: true,
// 		},
// 	)
// }

// // 删除工作区
// export const deleteWorkspace = async ({ id }: { id: string }) => {
// 	return magicClient.delete(`/api/v1/super-agent/workspaces/${id}`)
// }
//
// // 新增工作区
// export const createWorkspace = async ({ workspace_name }: { workspace_name: string }) => {
// 	return magicClient.post(`/api/v1/super-agent/workspaces`, { workspace_name })
// }
//
// // 编辑工作区
// export const editWorkspace = async ({
// 	id,
// 	workspace_name,
// }: {
// 	id: string
// 	workspace_name: string
// }) => {
// 	return magicClient.put(`/api/v1/super-agent/workspaces/${id}`, { workspace_name })
// }
//
// // 获取工作区详情
// export const getWorkspaceDetail = async ({ id }: { id: string }) => {
// 	return magicClient.get<Workspace>(`/api/v1/super-agent/workspaces/${id}`)
// }

// // 新增话题
// export const createTopic = async ({
// 	workspace_id,
// 	project_id,
// 	topic_name,
// 	project_mode,
// }: {
// 	workspace_id?: string
// 	project_id: string
// 	topic_name: string
// 	project_mode?: TopicMode
// }) => {
// 	return magicClient.post(`/api/v1/super-agent/topics`, {
// 		workspace_id,
// 		project_id,
// 		topic_name,
// 		project_mode,
// 	})
// }

// // 编辑话题
// export const editTopic = async ({
// 	id,
// 	topic_name,
// 	workspace_id,
// 	project_id,
// }: {
// 	id?: string
// 	topic_name: string
// 	workspace_id: string
// 	project_id: string
// }) => {
// 	return magicClient.put(`/api/v1/super-agent/topics/${id}`, {
// 		topic_name,
// 		workspace_id,
// 		project_id,
// 	})
// }
//
// export const deleteThread = async ({ id, workspace_id }: { id: string; workspace_id: string }) => {
// 	return magicClient.post(`/api/v1/super-agent/topics/delete`, { id, workspace_id })
// }

// 通过话题id获取附件列表
export const getAttachmentsByThreadId = async ({
	id,
	access,
}: {
	id: string
	access?: FileAccessContext
}) => {
	const isMagicShare = window?.location?.pathname?.includes("magic-share")
	const url = isMagicShare
		? "/api/v1/super-agent/admin/topic/user-attachments"
		: `/api/v1/super-agent/topics/${id}/attachments`
	return magicClient.post(url, {
		page: 1,
		page_size: 999,
		file_type: ["user_upload", "user_create", "process", "system_auto_upload"],
		token: getShareAccessToken(access),
		topic_id: id,
	})
}

// // 通过项目id获取附件列表
// export const getAttachmentsByProjectId = async ({ id }: { id: string }) => {
// 	return magicClient.post(`/api/v1/super-agent/projects/${id}/attachments`, {
// 		page: 1,
// 		page_size: 999,
// 		file_type: ["user_upload", "user_create", "process", "system_auto_upload", "directory"],
// 		token: "",
// 	})
// }

// // 通过工作区id获取话题列表
// export const getTopicsByProjectId = async ({
// 	id,
// 	page,
// 	page_size,
// }: {
// 	id: string
// 	page: number
// 	page_size: number
// }) => {
// 	return magicClient.get<WithPage<Topic>>(
// 		genRequestUrl("/api/v1/super-agent/projects/${id}/topics", { id }, { page, page_size }),
// 	)
// }
//
// // 根据会话ID获取历史消息
// export const getMessagesByConversationId = async ({
// 	conversation_id,
// 	chat_topic_id,
// 	page_token = "",
// 	limit = 50,
// 	order = "asc",
// }: {
// 	conversation_id: string
// 	chat_topic_id: string
// 	limit?: number
// 	order?: "asc" | "desc"
// 	page_token?: string
// }): Promise<any> => {
// 	return magicClient.post(`/api/v1/im/conversations/${conversation_id}/messages/queries`, {
// 		limit,
// 		order,
// 		page_token,
// 		topic_id: chat_topic_id,
// 	})
// }

/** getTemporaryDownloadUrl 返回的单个文件项 */
export interface GetTemporaryDownloadUrlItem {
	file_id: string
	url: string
	/** 过期时间，格式: 2026-03-03 11:14:03 */
	expires_at?: string
	/** 后端资源强版本；当前部分接口可能返回 null */
	version?: string | null
	/** 文件更新时间，格式: 2026-03-03 11:14:03 */
	updated_at?: string
}

export interface GetFileContentOptions {
	signal?: AbortSignal
	responseType?: "text" | "arrayBuffer" | "blob"
	file_versions?: Record<string, number>
	download_mode?: DownloadImageMode
	xMagicImageProcess?: ImageProcessOptions
	forceRefresh?: boolean
	access?: FileAccessContext
}

export interface BatchFileContentResult {
	successes: Map<string, string | ArrayBuffer | Blob>
	failures: Map<string, Error>
}

/**
 * 	通过文件id获取临时下载url
 * @param params - 请求参数
 * @param params.file_ids - 文件id列表
 * @param params.file_versions - 文件版本
 * @param params.download_mode - 下载模式；未传且非 magic-share 时，按全局无水印协议等自动注入（预览与 is_download 一致）
 * @param params.cache - 是否复用服务端文件地址缓存
 * @param options - 请求选项
 * @param options.xMagicImageProcess - 图片处理参数
 * @returns 临时下载url
 */
export const getTemporaryDownloadUrl = async ({
	file_ids,
	is_download = false,
	file_versions,
	download_mode,
	cache,
	options,
	enableErrorMessagePrompt = true,
	access,
}: {
	file_ids: string[]
	file_versions?: Record<string, number>
	// 高清+无水印模式
	download_mode?: DownloadImageMode
	cache?: boolean
	// 是否手动下载
	is_download?: boolean
	options?: {
		xMagicImageProcess?: ImageProcessOptions
	}
	enableErrorMessagePrompt?: boolean
	access?: FileAccessContext
}) => {
	if (access?.kind === "recycle-bin") {
		// 仅当前回收站记录绑定的文件可读；关联文件、版本及下载不能回落普通接口。
		if (
			file_ids.some((id) => id !== access.fileId) ||
			file_versions ||
			is_download ||
			download_mode !== undefined
		) {
			throw new Error("Recycle bin preview does not allow this file operation")
		}
		if (!file_ids.length) return []
		const file = await RecycleBinApi.previewFile(access.recycleBinId, access.projectId)
		if (file.file_id !== access.fileId) throw new Error("Recycle bin file identity changed")
		return [
			{
				file_id: file.file_id,
				url: file.url,
				expires_at: file.expires_at,
				updated_at: file.updated_at,
			},
		]
	}
	// Share pages require explicit access; runtime conversations deliberately use session access.
	if (shouldWaitForShareAccess(access)) {
		return []
	}
	const isMagicShare = window?.location?.pathname?.includes("magic-share")
	const identity = resolveFileRequestIdentity(access)

	const effectiveDownloadMode =
		!isMagicShare && download_mode === undefined
			? getFileUrlDownloadModeForNoWatermark()
			: download_mode

	const apiPath = isMagicShare
		? `/api/v1/admin/ai/content-audit/topic/${identity.topicId}/attachment-urls`
		: effectiveDownloadMode === DownloadImageMode.HighQuality
			? "/api/v1/super-agent/tasks/high-quality-image/queries"
			: "/api/v1/super-agent/tasks/get-file-url"

	// 检查file_ids中是否有保存过的文件
	const savedFileIds = JSON.parse(localStorage.getItem("saved_file_ids") || "[]")
	const matchedFileIds = file_ids.filter((fileId) => savedFileIds.includes(fileId))
	const hasSavedFile = matchedFileIds.length > 0

	// 消费掉匹配到的file_id，从localStorage中移除
	if (hasSavedFile) {
		const remainingFileIds = savedFileIds.filter(
			(fileId: string) => !matchedFileIds.includes(fileId),
		)
		localStorage.setItem("saved_file_ids", JSON.stringify(remainingFileIds))
	}

	const requestBody = {
		file_ids,
		token: identity.token,
		topic_id: identity.topicId,
		project_id: identity.projectId,
		...(cache !== undefined ? { cache } : hasSavedFile ? { cache: false } : {}),
		...(file_versions && !isMagicShare && { file_versions }),
		...(effectiveDownloadMode && { download_mode: effectiveDownloadMode }),
		...(is_download && { is_download }),
	}

	return magicClient.post<GetTemporaryDownloadUrlItem[]>(apiPath, requestBody, {
		headers: {
			...(options?.xMagicImageProcess && {
				"X-Magic-Image-Process": buildImageProcessQuery(options?.xMagicImageProcess),
			}),
		},
		enableErrorMessagePrompt,
	})
}

/**
 * 通过文件 ID 直接获取文件内容
 * @param fileId 文件 ID
 * @param options 下载选项
 * @returns 文件内容
 */
export const getFileContentsByIds = async (
	fileIds: string[],
	options: GetFileContentOptions = {},
): Promise<BatchFileContentResult> => {
	const uniqueFileIds = [...new Set(fileIds.filter(Boolean).map(String))]
	const successes = new Map<string, string | ArrayBuffer | Blob>()
	const failures = new Map<string, Error>()

	if (uniqueFileIds.length === 0) return { successes, failures }

	let downloadUrls: GetTemporaryDownloadUrlItem[]
	try {
		downloadUrls = await getTemporaryDownloadUrl({
			file_ids: uniqueFileIds,
			file_versions: options.file_versions,
			download_mode: options.download_mode,
			cache: options.forceRefresh ? false : undefined,
			options: options.xMagicImageProcess
				? { xMagicImageProcess: options.xMagicImageProcess }
				: undefined,
			access: options.access,
		})
	} catch (error) {
		const failure =
			error instanceof Error
				? error
				: Object.assign(new Error(stringifyUnknownError(error)), { cause: error })
		for (const fileId of uniqueFileIds) failures.set(fileId, failure)
		return { successes, failures }
	}

	const urlByFileId = new Map(
		(Array.isArray(downloadUrls) ? downloadUrls : [])
			.filter((item) => item?.file_id && item?.url)
			.map((item) => [String(item.file_id), item.url]),
	)
	const results = await Promise.allSettled(
		uniqueFileIds.map(async (fileId) => {
			const url = urlByFileId.get(fileId)
			if (!url) throw new Error(`无法获取文件下载地址: ${fileId}`)
			const content = await downloadFileContent(url, {
				responseType: options.responseType || "text",
				cache: options.forceRefresh ? "no-store" : undefined,
				signal: options.signal,
			})
			return { fileId, content }
		}),
	)

	results.forEach((result, index) => {
		const fileId = uniqueFileIds[index]
		if (result.status === "fulfilled") successes.set(fileId, result.value.content)
		else
			failures.set(
				fileId,
				result.reason instanceof Error
					? result.reason
					: Object.assign(new Error(stringifyUnknownError(result.reason)), {
							cause: result.reason,
						}),
			)
	})

	return { successes, failures }
}

/**
 * 通过文件 ID 直接获取文件内容。
 * 单文件调用保留原有接口，内部复用批量 URL 获取能力。
 */
export const getFileContentById = async (
	fileId: string,
	options: GetFileContentOptions = {},
): Promise<string | ArrayBuffer | Blob> => {
	if (!fileId) throw new Error("文件 ID 不能为空")

	const result = await getFileContentsByIds([fileId], options)
	const failure = result.failures.get(String(fileId))
	if (failure) {
		console.error("获取文件内容失败:", {
			fileId,
			error: failure,
			errorMessage: failure.message,
		})
		throw failure
	}

	const content = result.successes.get(String(fileId))
	if (content === undefined) throw new Error(`无法获取文件内容: ${fileId}`)
	return content
}

export interface DownloadProgress {
	loaded: number
	/** Only set when the byte count is trustworthy (see readBodyWithProgress). */
	total?: number
}

interface DownloadFileContentOptions {
	responseType?: "text" | "arrayBuffer" | "blob"
	/** 浏览器请求缓存策略 */
	cache?: RequestCache
	signal?: AbortSignal
	/** Streams the body to report received bytes; omitted keeps the plain single-read path. */
	onProgress?: (progress: DownloadProgress) => void
}

/**
 * Reads the body chunk by chunk so callers can show progress. Content-Length counts
 * encoded bytes while the reader yields decoded ones, and cross-origin responses may
 * hide the header, so the total is only reported for unencoded, visible lengths.
 */
async function readBodyWithProgress(
	response: Response,
	onProgress: (progress: DownloadProgress) => void,
): Promise<Uint8Array<ArrayBuffer>> {
	const declared = Number(response.headers.get("content-length"))
	const total =
		!response.headers.get("content-encoding") && Number.isFinite(declared) && declared > 0
			? declared
			: undefined
	const reader = response.body?.getReader()
	if (!reader) {
		const bytes = new Uint8Array(await response.arrayBuffer())
		onProgress({ loaded: bytes.length, total: bytes.length })
		return bytes
	}
	const chunks: Uint8Array[] = []
	let loaded = 0
	for (;;) {
		const { done, value } = await reader.read()
		if (done) break
		chunks.push(value)
		loaded += value.length
		onProgress({ loaded, total: total && loaded <= total ? total : undefined })
	}
	const bytes = new Uint8Array(loaded)
	let offset = 0
	for (const chunk of chunks) {
		bytes.set(chunk, offset)
		offset += chunk.length
	}
	return bytes
}

// 从URL下载文件内容并返回指定格式的数据
export const downloadFileContent = async (
	url: string,
	options: DownloadFileContentOptions = {},
): Promise<string | ArrayBuffer | Blob> => {
	try {
		const { responseType = "text", cache, onProgress } = options

		const response = await fetch(url, {
			method: "GET",
			signal: options.signal,
			cache,
		})

		if (!response.ok) {
			throw new Error(`下载失败: ${response.status} ${response.statusText}`)
		}

		if (onProgress) {
			const bytes = await readBodyWithProgress(response, onProgress)
			switch (responseType) {
				case "arrayBuffer":
					return bytes.buffer
				case "blob":
					return new Blob([bytes], { type: response.headers.get("content-type") || "" })
				case "text":
				default:
					return new TextDecoder().decode(bytes)
			}
		}

		switch (responseType) {
			case "arrayBuffer":
				return response.arrayBuffer()
			case "blob":
				return response.blob()
			case "text":
			default:
				return response.text()
		}
	} catch (error) {
		console.error("下载文件内容时出错:", error)
		throw error
	}
}

// // 取消分享话题
// export const cancelShareTopic = async ({ resource_id }: { resource_id: string }) => {
// 	const response = await magicClient.post(`/api/v1/share/resources/${resource_id}/cancel`)
// 	return response
// }
//
// // 创建分享话题
// export const createShareTopic = async ({
// 	resource_id,
// 	resource_type,
// 	share_type,
// 	pwd,
// }: {
// 	resource_id: string
// 	resource_type: number
// 	share_type: number
// 	pwd: string
// }) => {
// 	const response = await magicClient.post("/api/v1/share/resources/create", {
// 		resource_id,
// 		resource_type,
// 		share_type,
// 		pwd,
// 	})
// 	return response
// }
//
// // 通过code获取分享的信息
// export const getShareInfoByCode = async ({ code }: { code: string }) => {
// 	const response = await magicClient.get(`/api/v1/share/resources/${code}/setting`)
// 	return response
// }

// // 智能话题重命名
// export const smartTopicRename = async ({
// 	id,
// 	user_question,
// }: {
// 	id: string
// 	user_question: string
// }): Promise<{ topic_name: string }> => {
// 	return magicClient.post("/api/v1/super-agent/topics/rename", {
// 		id,
// 		user_question,
// 	})
// }

// // 根据话题id获取话题详情
// export const getTopicDetail = async ({ id }: { id: string }) => {
// 	return magicClient.get(`/api/v1/super-agent/topics/${id}`)
// }
//
// // 错误日志上报
// export const reportErrorLog = async ({ log }: { log: any }) => {
// 	return magicClient.post("/api/v1/super-agent/log/report", {
// 		log,
// 	})
// }

// // 替换文件
// export const replaceFile = async ({
// 	id,
// 	file_key,
// 	file_name,
// }: {
// 	id: string
// 	file_key: string
// 	file_name?: string
// }): Promise<FileItem> => {
// 	const url = `/api/v1/super-agent/file/${id}/replace`
// 	const payload = {
// 		file_key,
// 		file_name,
// 	}
// 	return magicClient.post(url, payload)
// }
// 获取使用情况
export const getUsage = async ({
	page = 1,
	page_size = 999,
	organization_code = "",
	user_name = "",
	topic_name = "",
	topic_id = "",
	sandbox_id = "",
	topic_status = "",
}: {
	page?: number
	page_size?: number
	organization_code?: string
	user_name?: string
	topic_name?: string
	topic_id?: string
	sandbox_id?: string
	topic_status?: string
}) => {
	try {
		const response = await magicClient.post("/api/v1/super-agent/admin/statistics/user-usage", {
			page,
			page_size,
			organization_code,
			user_name,
			topic_name,
			topic_id,
			sandbox_id,
			topic_status,
		})
		// 确保返回的数据包含分页信息
		return response
	} catch (error) {
		console.error("Error in getUsage:", error)
		throw error
	}
}

// 获取用户使用情况的指标
export const getUsageMetrics = async () => {
	return magicClient.get("/api/v1/super-agent/admin/statistics/topic-metrics")
}

// 获取所有工作区的组织列表
export const getUsageList = async () => {
	return magicClient.get("/api/v1/super-agent/admin/workspace/organization-codes")
}

// // 获取话题沙箱状态
// export const getTopicSandboxStatus = async ({ id }: { id: string }) => {
// 	return magicClient.get(`/api/v1/super-agent/admin/topic/${id}/sandbox`)
// }

// // 获取话题详情
// export const getTopicDetailByTopicId = async ({ id }: { id: string }) => {
// 	return magicClient.get(`/api/v1/super-agent/topics/${id}`)
// }

// /**
//  * Create a batch download task for files under a topic.
//  * @param topic_id The topic id
//  * @param file_ids The file id list (empty array means all files)
//  * @returns Batch download task info
//  */
// export const createBatchDownload = async ({
// 	file_ids,
// 	project_id,
// }: {
// 	file_ids: string[]
// 	project_id?: string
// }) => {
// 	return magicClient.post("/api/v1/super-agent/file/batch-download/create", {
// 		file_ids,
// 		project_id,
// 	})
// }
//
// /**
//  * Check the status of a batch download task.
//  * @param batch_key The batch task key
//  * @returns Batch download status and download url if ready
//  */
// export const checkBatchDownloadStatus = async (batch_key: string) => {
// 	return magicClient.get(`/api/v1/super-agent/file/batch-download/check?batch_key=${batch_key}`)
// }
//
// /**
//  * Check the status of a batch operation task (move, rename, etc.).
//  * @param batch_key The batch task key
//  * @returns Batch operation status
//  */
// export const checkBatchOperationStatus = async (batch_key: string) => {
// 	return magicClient.get(`/api/v1/super-agent/file/batch-operation/check?batch_key=${batch_key}`)
// }

// // 保存文件内容
// export const saveFileContent = async (
// 	data: Array<{
// 		file_id: string
// 		content: any
// 		enable_shadow?: boolean
// 	}>,
// ) => {
// 	// 将保存过的file_id存入localStorage
// 	const savedFileIds = JSON.parse(localStorage.getItem("saved_file_ids") || "[]")
// 	data.forEach((item) => {
// 		if (!savedFileIds.includes(item.file_id)) {
// 			savedFileIds.push(item.file_id)
// 			try {
// 				localStorage.setItem("saved_file_ids", JSON.stringify(savedFileIds))
// 			} catch (e) {
// 				console.error("localStorage 写入失败", e)
// 			}
// 		}
// 	})
// 	return magicClient.post(`/api/v1/super-agent/file/save`, data)
// }

// // 删除文件
// export const deleteFile = async (file_id: string) => {
// 	return magicClient.delete(`/api/v1/super-agent/file/${file_id}`)
// }
//
// // 新增：批量删除文件
// export const deleteFiles = async (data: { file_ids: string[]; project_id?: string }) => {
// 	return magicClient.post(`/api/v1/super-agent/file/batch-delete`, data)
// }
//
// // 删除目录（兼容旧版本）
// export const deleteDirectory = async (data: { project_id: string; path: string }) => {
// 	return magicClient.post("/api/v1/super-agent/file/directory/delete", data)
// }
//
// // 重命名文件或文件夹
// export const renameFile = async (data: { file_id: string; target_name: string }) => {
// 	return magicClient.post(`/api/v1/super-agent/file/${data.file_id}/rename`, {
// 		target_name: data.target_name,
// 	})
// }
//
// // 移动文件或文件夹
// export const moveFile = async (data: {
// 	file_id: string
// 	target_parent_id: string
// 	pre_file_id?: string
// }) => {
// 	const { file_id, ...requestData } = data
// 	return magicClient.post(`/api/v1/super-agent/file/${file_id}/move`, requestData)
// }
//
// // 新增：批量移动文件或文件夹
// export const moveFiles = async (data: {
// 	file_ids: string[]
// 	project_id?: string
// 	target_parent_id: string
// 	pre_file_id?: string
// }) => {
// 	return magicClient.post(`/api/v1/super-agent/file/batch-move`, data)
// }

// /**
//  * 获取项目列表
//  * @param param0
//  * @returns
//  */
// export const getProjects = async ({
// 	workspace_id,
// 	project_name,
// 	page,
// 	page_size,
// }: {
// 	workspace_id?: string
// 	project_name?: string
// 	page: number
// 	page_size: number
// }) => {
// 	return magicClient.get<WithPage<ProjectListItem>>(
// 		genRequestUrl(
// 			"/api/v1/super-agent/projects/queries",
// 			{},
// 			{
// 				workspace_id,
// 				project_name,
// 				page,
// 				page_size,
// 			},
// 		),
// 		{
// 			enableRequestUnion: true,
// 		},
// 	)
// }
//
// /**
//  * 获取参与的协作项目列表
//  * @param workspace_id 工作区id
//  * @param page 页码
//  * @param page_size 每页条数
//  * @param show_collaboration 是否显示协作项目 1: 显示 0: 不显示
//  * @returns 协作项目列表
//  */
// export const getProjectsWithCollaboration = async ({
// 	workspace_id,
// 	page,
// 	page_size,
// 	show_collaboration = 1,
// }: {
// 	workspace_id?: string
// 	page: number
// 	page_size: number
// 	show_collaboration?: number
// }) => {
// 	return magicClient.post<WithPage<ProjectListItem>>(
// 		genRequestUrl("/api/v1/super-agent/projects/participated"),
// 		{ workspace_id, page, page_size, show_collaboration },
// 	)
// }
//
// // 获取项目详情
// export const getProjectDetail = async ({ id }: { id: string }) => {
// 	return magicClient.get<ProjectListItem>(`/api/v1/super-agent/projects/${id}`)
// }

// // 新增项目
// export const createProject = async ({
// 	workspace_id,
// 	project_name,
// 	project_description,
// 	project_mode,
// 	workdir,
// }: {
// 	workspace_id: string
// 	project_name: string
// 	project_description: string
// 	project_mode: TopicMode | ""
// 	workdir?: string
// }) => {
// 	return magicClient.post<CreatedProject>(`/api/v1/super-agent/projects`, {
// 		workspace_id,
// 		project_name,
// 		project_description,
// 		project_mode,
// 		workdir,
// 	})
// }
//
// // 编辑项目
// export const editProject = async ({
// 	id,
// 	workspace_id,
// 	project_name,
// 	project_description,
// }: {
// 	id: string
// 	workspace_id: string
// 	project_name: string
// 	project_description?: string
// }) => {
// 	return magicClient.put<{ project_name: string }>(`/api/v1/super-agent/projects/${id}`, {
// 		workspace_id,
// 		project_name,
// 		project_description,
// 	})
// }
//
// // 删除项目
// export const deleteProject = async ({ id }: { id: string }) => {
// 	return magicClient.delete(`/api/v1/super-agent/projects/${id}`)
// }

// 保存用户上传的文件到项目文件返回结果
export type SaveUploadFileToProjectResponse = {
	file_id: string
	file_key: string
	file_name: string
	file_size: number
	file_type: "user_upload" | "directory"
	project_id: string
	topic_id: string
	task_id: string
	created_at: string
	relative_file_path: string
	is_hidden?: boolean
}

// // 保存用户上传的文件到项目文件
// export const saveUploadFileToProject = async (data: {
// 	project_id: string
// 	topic_id?: string
// 	task_id?: string
// 	file_key: string
// 	file_name: string
// 	file_size: number
// 	file_type?: string
// 	storage_type: "workspace" | "topic"
// 	source: UploadSource
// }) => {
// 	return magicClient.post<SaveUploadFileToProjectResponse>(
// 		"/api/v1/super-agent/file/project/save",
// 		data,
// 	)
// }
//
// /**
//  * 获取模型列表
//  * @deprecated 使用 getModeList 代替
//  * @returns 模型列表
//  */
// export const getModelList = async () => {
// 	return magicClient.get<ModelItem[]>("/api/v1/super-magic-models")
// }
//
// /**
//  * 获取超级麦吉话题模型配置
//  * @param topic_id 话题id
//  * @returns 超级麦吉话题模型配置
//  */
// export const getSuperMagicTopicModel = async ({ topic_id }: { topic_id: string }) => {
// 	return magicClient.get<{
// 		model: Partial<ModelItem>
// 	}>(`/api/v1/contact/users/setting/super-magic/topic-model/${topic_id}`)
// }
//
// /**
//  * 保存超级麦吉话题模型配置
//  * @param topic_id 话题id
//  * @param model_id 模型id
//  * @returns 保存结果
//  */
// export const saveSuperMagicTopicModel = async ({
// 	cache_id,
// 	model_id,
// }: {
// 	cache_id: string
// 	model_id: string
// }) => {
// 	return magicClient.put(`/api/v1/contact/users/setting/super-magic/topic-model/${cache_id}`, {
// 		model: {
// 			model_id,
// 		},
// 	})
// }
//
// // 通过项目id获取上一次文件更新时间
// export const getLastFileUpdateTime = async ({ project_id }: { project_id: string }) => {
// 	return magicClient.get(`/api/v1/super-agent/projects/${project_id}/last-file-updated-time`)
// }

//
// // 创建文件或文件夹
// export const createFile = async (data: {
// 	project_id: string
// 	parent_id?: string | number
// 	file_name: string
// 	is_directory: boolean
// }) => {
// 	return magicClient.post("/api/v1/super-agent/file", data)
// }
//
//
// /**
//  * 获取模式列表
//  * @returns 模式列表
//  */
// export const getModeList = () => {
// 	return magicClient.get<WithPage<ModeItem>>(`/api/v1/modes`, { enableRequestUnion: true })
// }
//
// /**
//  * 移动项目到新的工作区
//  * @param source_project_id 项目id
//  * @param target_workspace_id 目标工作区id
//  * @returns 移动项目结果
//  */
// export const moveProjectToNewWorkspace = async ({
// 	source_project_id,
// 	target_workspace_id,
// }: {
// 	source_project_id: string
// 	target_workspace_id: string
// }) => {
// 	return magicClient.post("/api/v1/super-agent/projects/move", {
// 		source_project_id,
// 		target_workspace_id,
// 	})
// }

// // ================ 消息队列相关API ================
//
// /**
//  * 获取消息队列列表
//  */
// export const getMessageQueueList = async ({
// 	project_id,
// 	topic_id,
// 	page = 1,
// 	page_size = 50,
// }: {
// 	project_id: string
// 	topic_id: string
// 	page?: number
// 	page_size?: number
// }) => {
// 	return magicClient.post("/api/v1/super-agent/message-queue/queries", {
// 		project_id,
// 		topic_id,
// 		page,
// 		page_size,
// 	})
// }
//
// /**
//  * 添加消息到队列
//  */
// export const addMessageToQueue = async ({
// 	project_id,
// 	topic_id,
// 	message_type,
// 	message_content,
// }: {
// 	project_id: string
// 	topic_id: string
// 	message_type: string
// 	message_content: any
// }) => {
// 	return magicClient.post("/api/v1/super-agent/message-queue", {
// 		project_id,
// 		topic_id,
// 		message_type,
// 		message_content,
// 	})
// }
//
// /**
//  * 主动消费队列消息
//  */
// export const consumeQueueMessage = async ({ messageId }: { messageId: string }) => {
// 	return magicClient.post(`/api/v1/super-agent/message-queue/${messageId}/consume`, {})
// }
//
// /**
//  * 删除队列消息
//  */
// export const deleteQueueMessage = async ({ messageId }: { messageId: string }) => {
// 	return magicClient.delete(`/api/v1/super-agent/message-queue/${messageId}`)
// }
//
// /**
//  * 编辑队列消息
//  */
// export const updateQueueMessage = async ({
// 	messageId,
// 	project_id,
// 	topic_id,
// 	message_type,
// 	message_content,
// }: {
// 	messageId: string
// 	project_id: string
// 	topic_id: string
// 	message_type: string
// 	message_content: any
// }) => {
// 	return magicClient.put(`/api/v1/super-agent/message-queue/${messageId}`, {
// 		project_id,
// 		topic_id,
// 		message_type,
// 		message_content,
// 	})
// }
//
// // ================ 消息撤回相关API ================
// /**
//  * 撤回消息
//  * @param topic_id 话题id
//  * @param message_id 消息id
//  */
// export const undoMessage = async ({
// 	topic_id,
// 	message_id,
// }: {
// 	topic_id: string
// 	message_id: string
// }) => {
// 	return magicClient.post(`/api/v1/super-agent/topics/${topic_id}/checkpoints/rollback/start`, {
// 		target_message_id: message_id,
// 	})
// }
//
// /*
//  * 确认撤回消息
//  * @param topic_id 话题id
//  */
// export const confirmUndoMessage = async ({ topic_id }: { topic_id: string }) => {
// 	return magicClient.post(`/api/v1/super-agent/topics/${topic_id}/checkpoints/rollback/commit`)
// }
//
// /**
//  * 取消消息撤回
//  * @param topic_id 话题id
//  */
// export const cancelUndoMessage = async ({ topic_id }: { topic_id: string }) => {
// 	return magicClient.post(`/api/v1/super-agent/topics/${topic_id}/checkpoints/rollback/undo`)
// }
//
// /**
//  * 确认是否可以撤回消息
//  * @param topic_id 话题id
//  * @param message_id 消息id
//  */
// export const checkCanUndoMessage = async ({
// 	topic_id,
// 	message_id,
// }: {
// 	topic_id: string
// 	message_id: string
// }) => {
// 	return magicClient.post<{
// 		can_rollback: boolean
// 	}>(`/api/v1/super-agent/topics/${topic_id}/checkpoints/rollback/check`, {
// 		target_message_id: message_id,
// 	})
// }
//
// /**
//  * 获取文件历史版本
//  * @param file_id 文件id
//  * @returns 文件历史版本
//  */
// export const getFileHistoryVersions = async ({
// 	file_id,
// 	page_size,
// }: {
// 	file_id: string
// 	page_size: number
// }) => {
// 	return magicClient.get<WithPage<FileHistoryVersion>>(
// 		genRequestUrl(`/api/v1/super-agent/file/${file_id}/versions`, {}, { page_size }),
// 	)
// }
//
// /**
//  * 获取文件信息
//  * @param file_id 文件id
//  * @returns 文件信息
//  */
// export const getFileInfo = async ({ file_id }: { file_id: string }) => {
// 	return magicClient.get<FileInfo>(`/api/v1/super-agent/file/${file_id}`)
// }
//
// /**
//  * 回滚文件版本
//  * @param file_id 文件id
//  * @param version 版本
//  * @returns 回滚文件版本结果
//  */
// export const rollbackFileVersion = async ({
// 	file_id,
// 	version,
// }: {
// 	file_id: string
// 	version: number
// }) => {
// 	return magicClient.post(`/api/v1/super-agent/file/${file_id}/rollback`, {
// 		file_id,
// 		version,
// 	})
// }
//
// /**
//  * Agent列表
//  */
// export const getAgentsList = async () => {
// 	return magicClient.post("/api/v1/super-magic/agents/queries")
// }
//
// /**
//  * 新增/编辑Agent
//  */
// export const editAgent = async ({ data }: { data: any }) => {
// 	return magicClient.post(`/api/v1/super-magic/agents`, data)
// }
// /**
//  * AI优化Agent
//  */
// export const AIOptimizationAgent = async ({
// 	data,
// }: {
// 	data: { optimization_type: string; agent: any }
// }) => {
// 	return magicClient.post(`/api/v1/super-magic/agents/ai-optimize`, data)
// }
// /**
//  * 获取Agent详情
//  */
// export const getAgentDetail = async ({ agent_id }: { agent_id: string }) => {
// 	return magicClient.get(`/api/v1/super-magic/agents/${agent_id}`)
// }
// /**
//  * 删除Agent
//  */
// export const deleteAgent = async ({ agent_id }: { agent_id: string }) => {
// 	return magicClient.delete(`/api/v1/super-magic/agents/${agent_id}`)
// }
//
// /**
//  * Agent列表排序
//  */
// export const sortAgents = async ({ data }: { data: { all: string[]; frequent: string[] } }) => {
// 	return magicClient.post(`/api/v1/super-magic/agents/order`, data)
// }
//
// /**
//  * 获取可用的自定义工具列表
//  */
// export const getAvailableCustomTools = async ({ with_builtin }: { with_builtin: boolean }) => {
// 	return magicClient.post(`/api/v1/flows/queries/tool-sets`, { with_builtin })
// }
//
// /**
//  * 获取内置工具列表
//  */
// export const getBuiltInTools = async () => {
// 	return magicClient.get("/api/v1/super-magic/agents/builtin-tools")
// }
//
// /**
//  * 置顶协作项目
//  * @param project_id 项目id
//  * @param data 数据
//  * @returns 更新项目置顶状态结果
//  */
// export const updateProjectPinStatus = async (
// 	project_id: string,
// 	data: {
// 		is_pin: boolean
// 	},
// ) => {
// 	return magicClient.put(`/api/v1/super-agent/projects/${project_id}/pin`, data)
// }

export * from "@/apis/modules/superMagic/recordSummary"

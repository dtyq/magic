// import request from "@/services/base/fetch/superMagic"
import magicClient from "@/opensource/apis/clients/magic"
// import { REMOTE_HTTP_URL } from "../constans"

export const getWorkspaces = async () => {
	return magicClient.post(
		`/api/v1/super-agent/workspaces/queries`,
		{
			page: 1,
			page_size: 999,
		},
		{
			headers: {
				"Content-Type": "application/json",
			},
		},
	)
}

export const deleteWorkspace = async ({ id }: { id: string }) => {
	return magicClient.post(
		`/api/v1/super-agent/workspaces/delete`,
		{ id },
		{
			headers: {
				"Content-Type": "application/json",
			},
		},
	)
}

// 没有workspaceId时，创建workspace 有workspaceId时，编辑workspace
export const editWorkspace = async ({
	id,
	workspace_name,
}: {
	id?: string
	workspace_name: string
}) => {
	return magicClient.post(
		`/api/v1/super-agent/workspaces/save`,
		{ id, workspace_name },
		{
			headers: {
				"Content-Type": "application/json",
			},
		},
	)
}

export const editThread = async ({
	id,
	topic_name,
	workspace_id,
}: {
	id?: string
	topic_name: string
	workspace_id: string
}) => {
	return magicClient.post(
		`/api/v1/super-agent/topics/save`,
		{ id, topic_name, workspace_id },
		{
			headers: {
				"Content-Type": "application/json",
			},
		},
	)
}

export const deleteThread = async ({ id, workspace_id }: { id: string; workspace_id: string }) => {
	return magicClient.post(
		`/api/v1/super-agent/topics/delete`,
		{ id, workspace_id },
		{
			headers: {
				"Content-Type": "application/json",
			},
		},
	)
}

// 通过话题id获取附件列表
export const getAttachmentsByThreadId = async ({ id }: { id: string }) => {
	const isMagicShare = window?.location?.pathname?.includes("magic-share")
	const url = isMagicShare
		? "/api/v1/super-agent/admin/topic/user-attachments"
		: `/api/v1/super-agent/topics/${id}/attachments`
	return magicClient.post(url, {
		page: 1,
		page_size: 999,
		file_type: ["user_upload", "process", "system_auto_upload"],
		// @ts-ignore 使用window添加临时的token
		token: window.temporary_token || "",
		topic_id: id,
	})
}

// 通过工作区id获取话题列表
export const getTopicsByWorkspaceId = async ({
	id,
	page,
	page_size,
}: {
	id: string
	page: number
	page_size: number
}) => {
	return magicClient.post(
		`/api/v1/super-agent/workspaces/${id}/topics`,
		{ page, page_size },
		{
			headers: {
				"Content-Type": "application/json",
			},
		},
	)
}

// 根据会话ID获取历史消息
export const getMessagesByConversationId = async ({
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
}): Promise<any> => {
	return magicClient.post(
		`/api/v1/im/conversations/${conversation_id}/messages/queries`,
		{
			limit,
			order,
			page_token,
			topic_id: chat_topic_id,
		},
		{
			headers: {
				"Content-Type": "application/json",
			},
		},
	)
}

// 通过文件id获取临时下载url
export const getTemporaryDownloadUrl = async ({ file_ids }: { file_ids: string[] }) => {
	const isMagicShare = window?.location?.pathname?.includes("magic-share")
	const apiPath = isMagicShare
		? "/api/v1/super-agent/admin/topic/user-attachment-url"
		: "/api/v1/super-agent/tasks/get-file-url"

	return magicClient.post(
		apiPath,
		// @ts-ignore 使用window添加临时的token
		{ file_ids, token: window.temporary_token || "" },
	)
}

// 从URL下载文件内容并返回文本
export const downloadFileContent = async (url: string): Promise<string> => {
	try {
		const response = await fetch(url, {
			method: "GET",
			headers: {
				"Content-Type": "application/json",
			},
		})

		if (!response.ok) {
			throw new Error(`下载失败: ${response.status} ${response.statusText}`)
		}

		return response.text()
	} catch (error) {
		console.error("下载文件内容时出错:", error)
		throw error
	}
}

// 创建分享话题
export const createShareTopic = async ({
	resource_id,
	resource_type,
	share_type,
	pwd,
}: {
	resource_id: string
	resource_type: number
	share_type: number
	pwd: string
}) => {
	const response = await magicClient.post("/api/v1/share/resources/create", {
		resource_id,
		resource_type,
		share_type,
		pwd,
	})
	return response
}

// 通过code获取分享的信息
export const getShareInfoByCode = async ({ code }: { code: string }) => {
	const response = await magicClient.get(`/api/v1/share/resources/${code}/setting`)
	return response
}

// 智能话题重命名
export const smartTopicRename = async ({
	id,
	user_question,
}: {
	id: string
	user_question: string
}) => {
	return magicClient.post("/api/v1/super-agent/topics/rename", {
		id,
		user_question,
	})
}

// 根据话题id获取话题详情
export const getTopicDetail = async ({ id }: { id: string }) => {
	return magicClient.get(`/api/v1/super-agent/topics/${id}`)
}

// 错误日志上报
export const reportErrorLog = async ({ log }: { log: any }) => {
	return magicClient.post("/api/v1/super-agent/log/report", {
		log,
	})
}
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
		console.log("getUsage with filters", {
			page,
			page_size,
			organization_code,
			user_name,
			topic_name,
			topic_id,
			sandbox_id,
			topic_status,
		})
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

// 获取话题沙箱状态
export const getTopicSandboxStatus = async ({ id }: { id: string }) => {
	return magicClient.get(`/api/v1/super-agent/admin/topic/${id}/sandbox`)
}

// 获取话题详情
export const getTopicDetailByTopicId = async ({ id }: { id: string }) => {
	return magicClient.get(`/api/v1/super-agent/topics/${id}`)
}

/**
 * Iframe API 专用接口层
 *
 * 使用 iframeClient（不携带全局 401 跳转、组织校验等拦截器），
 * 确保 iframe 场景下的请求错误被抛出而非导致主站跳转登录页。
 */

import iframeClient from "@/apis/clients/iframeClient"
import type { SaveFileContentResponse } from "@/apis/modules/superMagic"
import { userStore } from "@/models/user"
import { WorkspaceStateCache } from "@/pages/superMagic/utils/superMagicCache"
import { getSuperIdState } from "@/pages/superMagic/utils/query"

// ─── 文件下载 URL ────────────────────────────────────────────────────────────

export interface IframeDownloadUrlItem {
	file_id: string
	url: string
	expires_at?: string
}

/**
 * 获取文件临时下载 URL（iframe 专用）。
 * 仅保留 iframe FS 场景必要的参数，不处理水印/高清/magic-share 等逻辑。
 */
export async function getIframeDownloadUrl(fileIds: string[]): Promise<IframeDownloadUrlItem[]> {
	const workspaceState = WorkspaceStateCache.get(userStore.user.userInfo)
	const superIdState = getSuperIdState()

	return iframeClient.post<IframeDownloadUrlItem[]>("/api/v1/super-agent/tasks/get-file-url", {
		file_ids: fileIds,
		// @ts-ignore
		token: window.temporary_token || "",
		// @ts-ignore
		topic_id: window?.topic_id || workspaceState?.topicId || superIdState?.topicId || "",
		// @ts-ignore
		project_id: window.project_id || workspaceState?.projectId || superIdState?.projectId || "",
	})
}

// ─── 文件内容保存 ────────────────────────────────────────────────────────────

/**
 * 保存文件内容（iframe 专用）。
 */
export async function saveIframeFileContent(
	data: Array<{ file_id: string; content: string }>,
): Promise<SaveFileContentResponse> {
	return iframeClient.post<SaveFileContentResponse>("/api/v1/super-agent/file/save", data)
}

// ─── 创建文件/目录 ───────────────────────────────────────────────────────────

/**
 * 创建文件或目录（iframe 专用）。
 */
export async function createIframeFile(data: {
	project_id: string
	parent_id?: string | number
	file_name: string
	is_directory: boolean
	ignore_duplicate?: boolean
}): Promise<{ file_id?: string }> {
	return iframeClient.post("/api/v1/super-agent/file", data)
}

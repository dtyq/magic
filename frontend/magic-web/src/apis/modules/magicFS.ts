import type { ServiceHttpClient, RequestConfig } from "@/infrastructure/network/http/clients"
import type { FileScope } from "./fileScope"

/** MagicFS 文件节点。 */
export interface MagicFSFile {
	id: string
	name: string
	parent_id: string
	is_directory: boolean
	size: number
	mode: number
	file_metadata: Record<string, string>
	created_at: string
	updated_at: string
	version: number
	latest_version: number
}

export interface MagicFSFileTree extends MagicFSFile {
	children?: MagicFSFileTree[]
}

// 与服务端现有后代深度保护一致；边界目录仍可继续读取，不能当成空目录。
export const MAGIC_FS_TREE_DEPTH = 100

/** MagicFS 文件列表请求。 */
export interface ListMagicFSFilesParams {
	parent_id?: string
	scope?: FileScope
}

/** MagicFS 文件创建请求。 */
export interface CreateMagicFSFileParams {
	name: string
	parent_id: string
	is_directory: boolean
	space_type: "user"
}

/** MagicFS 单文件响应。 */
export interface MagicFSFileResponse {
	file: MagicFSFile
}

/**
 * 创建 MagicFS API。
 *
 * 该 API 只封装通用文件系统元数据操作，正文读取与保存继续复用 Super Agent 文件接口。
 */
export function generateMagicFSApi(fetch: ServiceHttpClient) {
	return {
		getFileTree(fileId: string, signal?: AbortSignal) {
			return fetch.post<{ file: MagicFSFileTree }>(
				`/api/v1/open-api/magicfs/files/${fileId}/tree`,
				{ depth: MAGIC_FS_TREE_DEPTH },
				{ signal },
			)
		},

		/** 查询指定目录的直接子节点。 */
		listFiles(params: ListMagicFSFilesParams, config?: Omit<RequestConfig, "url" | "body">) {
			return fetch.post<{ files: MagicFSFile[] }>(
				"/api/v1/open-api/magicfs/files/queries",
				params,
				config,
			)
		},

		/** 查询单个文件或目录的最新元数据。 */
		getFileInfo(fileId: string, config?: Omit<RequestConfig, "url" | "body">) {
			return fetch.post<MagicFSFileResponse>(
				`/api/v1/open-api/magicfs/files/${fileId}/queries`,
				{},
				config,
			)
		},

		/** 创建用户空间文件或目录。 */
		createFile(params: CreateMagicFSFileParams, config?: Omit<RequestConfig, "url" | "body">) {
			return fetch.post<MagicFSFileResponse>("/api/v1/open-api/magicfs/files", params, config)
		},
	}
}

import type { ServiceHttpClient } from "@/infrastructure/network/http/clients"
/** 业务层共用的回收站类型，通过 namespace 统一导出 */
export namespace RecycleBin {
	export interface DeletedByUser {
		user_id: string
		nickname: string
		avatar: string
		avatar_url?: string
	}

	export interface ListItem {
		id: string
		resource_type: number
		resource_type_name: string
		resource_id: string
		resource_name: string
		owner_id: string
		deleted_by: string
		deleted_by_name?: string
		deleted_by_user?: DeletedByUser
		deleted_at: string
		expire_at: string
		remaining_days?: number
		parent_id: string
		extra_data?: {
			space_type?: "user" | "project"
			workspace_name?: string
			project_name?: string
			relative_file_path?: string
			is_directory?: boolean
			original_parent_id?: string | number | null
			parent_info?: {
				workspace_id?: number
				workspace_name?: string
				project_id?: number
				project_name?: string
			}
		}
	}

	export interface ListParams {
		resource_type?: number
		keyword?: string
		order?: "asc" | "desc"
		page?: number
		page_size?: number
	}

	export interface CountsParams {
		keyword?: string
		project_id?: string
	}

	export interface ProjectListParams {
		project_id: string
		resource_type: 4
		include_total: false
		keyword?: string
		deleted_from?: string
		deleted_to?: string
		cursor?: string
		page_size: number
	}

	export interface SearchLimits {
		max_hours: number
		max_results: number
	}

	export interface ProjectListResult {
		list: ListItem[]
		has_more: boolean
		next_cursor: string | null
		search_limits: SearchLimits
	}

	export interface CountItem {
		resource_type: number
		resource_type_name: string
		resource_type_label: string
		count: number
	}

	export interface CheckItem {
		id: string
		resource_type: number
		resource_id: string
		resource_name: string
		parent_id: string | null
		is_directory?: boolean
		space_type?: "user" | "project"
		conflict?: {
			type?: "parent_missing" | "name_conflict" | string
			existing_file_id?: string
			existing_is_directory?: boolean
		}
	}

	export interface CheckParams {
		resource_ids: string[]
		resource_type: number
	}

	export interface RestoreParams {
		resource_ids: string[]
		resource_type: number
		conflict_resolutions?: Record<
			string,
			{
				parent_missing?: "restore_to_root"
				name_conflict?: "overwrite" | "skip"
			}
		>
	}

	export interface MoveProjectParams {
		source_project_id: string
		target_workspace_id: string
	}

	export interface BatchMoveProjectParams {
		project_ids: string[]
		target_workspace_id: string
	}

	export interface MoveTopicParams {
		source_topic_id: string
		target_project_id: string
	}

	export interface BatchMoveTopicParams {
		topic_ids: string[]
		target_project_id: string
	}

	export interface PermanentDeleteParams {
		ids: string[]
	}
}

export interface RecycleBinFilePreview {
	recycle_bin_id: string
	file_id: string
	file_name: string
	file_extension: string
	file_size: number
	is_directory: false
	space_type: "user" | "project"
	project_id: string
	relative_file_path: string
	updated_at: string
	url: string
	expires_at: string
}

export const generateRecycleBinApi = (fetch: ServiceHttpClient) => ({
	previewFile(id: string, projectId?: string, signal?: AbortSignal) {
		return fetch.get<RecycleBinFilePreview>(`/api/v1/recycle-bin/${id}/preview`, {
			params: projectId ? { project_id: projectId } : undefined,
			signal,
			enableErrorMessagePrompt: false,
		})
	},
	getProjectRecycleBinList(params: RecycleBin.ProjectListParams, signal?: AbortSignal) {
		return fetch.get<RecycleBin.ProjectListResult>("/api/v1/recycle-bin/list", {
			params: { ...params },
			signal,
			enableErrorMessagePrompt: false,
		})
	},
	getRecycleBinList(params: RecycleBin.ListParams) {
		return fetch.get<{ total: number; list: RecycleBin.ListItem[] }>(
			"/api/v1/recycle-bin/list",
			{ params: { ...params } },
		)
	},
	getRecycleBinCounts(params?: RecycleBin.CountsParams, signal?: AbortSignal) {
		return fetch.get<RecycleBin.CountItem[]>("/api/v1/recycle-bin/counts", {
			params: { ...params },
			...(signal ? { signal, enableErrorMessagePrompt: false } : {}),
		})
	},
	checkRecycleBinParent(params: RecycleBin.CheckParams) {
		return fetch.post<{
			/** 需移动的项（父级不存在） */
			items_need_move?: RecycleBin.CheckItem[]
			/** 无需移动的项（父级存在可直接恢复） */
			items_no_need_move?: RecycleBin.CheckItem[]
			/** 新版冲突结构：包含 parent_missing / name_conflict */
			items_with_conflict?: RecycleBin.CheckItem[]
			/** 新版无冲突结构 */
			items_no_conflict?: RecycleBin.CheckItem[]
		}>("/api/v1/recycle-bin/check", params)
	},
	restoreRecycleBinResources(params: RecycleBin.RestoreParams) {
		return fetch.post<{
			success_count: number
			failed_count: number
			results: Array<{
				id: string
				resource_type: number
				resource_id: string
				resource_name: string
				success: boolean
				error_message?: string
			}>
		}>("/api/v1/recycle-bin/restore", params)
	},
	moveRecycleBinProject(params: RecycleBin.MoveProjectParams) {
		return fetch.post<{ success: boolean }>("/api/v1/recycle-bin/move-project", params)
	},
	batchMoveRecycleBinProject(params: RecycleBin.BatchMoveProjectParams) {
		return fetch.post<{
			total: number
			success: number
			failed: number
			results: Array<{ project_id: string; success: boolean; message: string }>
		}>("/api/v1/recycle-bin/batch-move-project", params)
	},
	moveRecycleBinTopic(params: RecycleBin.MoveTopicParams) {
		return fetch.post<{ success: boolean; topic_id: string; message: string }>(
			"/api/v1/recycle-bin/move-topic",
			params,
		)
	},
	batchMoveRecycleBinTopic(params: RecycleBin.BatchMoveTopicParams) {
		return fetch.post<{
			total: number
			success: number
			failed: number
			results: Array<{ topic_id: string; success: boolean; message: string }>
		}>("/api/v1/recycle-bin/batch-move-topic", params)
	},
	permanentDeleteRecycleBin(params: RecycleBin.PermanentDeleteParams) {
		return fetch.post<{
			failed: Array<{
				id: string
				resource_type: number
				resource_id: string
				resource_name: string
			}>
		}>("/api/v1/recycle-bin/permanent-delete", params)
	},
})

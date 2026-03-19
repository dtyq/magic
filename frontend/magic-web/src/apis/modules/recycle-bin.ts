import { genRequestUrl } from "@/utils/http"
import type { HttpClient } from "@/apis/core/HttpClient"
/** 业务层共用的回收站类型，通过 namespace 统一导出 */
export namespace RecycleBin {
	export interface DeletedByUser {
		user_id: string
		nickname: string
		avatar: string
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
			workspace_name?: string
			project_name?: string
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

	export interface CheckItem {
		id: string
		resource_type: number
		resource_id: string
		resource_name: string
		parent_id: string | null
	}

	export interface CheckParams {
		resource_ids: string[]
		resource_type: number
	}

	export interface RestoreParams {
		resource_ids: string[]
		resource_type: number
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

export const generateRecycleBinApi = (fetch: HttpClient) => ({
	getRecycleBinList(params: RecycleBin.ListParams) {
		return fetch.get<{ total: number; list: RecycleBin.ListItem[] }>(
			genRequestUrl("/api/v1/recycle-bin/list", {}, params),
		)
	},
	checkRecycleBinParent(params: RecycleBin.CheckParams) {
		return fetch.post<{
			/** 需移动的项（父级不存在） */
			items_need_move: RecycleBin.CheckItem[]
			/** 无需移动的项（父级存在可直接恢复） */
			items_no_need_move: RecycleBin.CheckItem[]
		}>(genRequestUrl("/api/v1/recycle-bin/check", {}, params), params)
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
			}>
		}>(genRequestUrl("/api/v1/recycle-bin/restore", {}, params), params)
	},
	moveRecycleBinProject(params: RecycleBin.MoveProjectParams) {
		return fetch.post<{ success: boolean }>(
			genRequestUrl("/api/v1/recycle-bin/move-project"),
			params,
		)
	},
	batchMoveRecycleBinProject(params: RecycleBin.BatchMoveProjectParams) {
		return fetch.post<{
			total: number
			success: number
			failed: number
			results: Array<{ project_id: string; success: boolean; message: string }>
		}>(genRequestUrl("/api/v1/recycle-bin/batch-move-project", {}, params), params)
	},
	moveRecycleBinTopic(params: RecycleBin.MoveTopicParams) {
		return fetch.post<{ success: boolean; topic_id: string; message: string }>(
			genRequestUrl("/api/v1/recycle-bin/move-topic", {}, params),
			params,
		)
	},
	batchMoveRecycleBinTopic(params: RecycleBin.BatchMoveTopicParams) {
		return fetch.post<{
			total: number
			success: number
			failed: number
			results: Array<{ topic_id: string; success: boolean; message: string }>
		}>(genRequestUrl("/api/v1/recycle-bin/batch-move-topic", {}, params), params)
	},
	permanentDeleteRecycleBin(params: RecycleBin.PermanentDeleteParams) {
		return fetch.post<{
			failed: Array<{
				id: string
				resource_type: number
				resource_id: string
				resource_name: string
			}>
		}>(genRequestUrl("/api/v1/recycle-bin/permanent-delete", {}, params), params)
	},
})

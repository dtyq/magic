import { genRequestUrl } from "@/utils/http"
import { RequestUrl } from "../constant"
import type { DriveItem } from "@/types/drive"
import type { HttpClient } from "../core/HttpClient"

export interface FavoritesListRequest {
	page?: number
	page_size?: number
	tag_id?: string
	/**
	 * 默认为全部，-1-全部 1-消息记录 2-群聊 3-联系人 4-云盘
	 */
	type?: number
}

export interface DeleteFavoritesRequest {
	ids: string[]
}

export interface SearchFavoritesRequest {
	content: string
}

export interface RelationLabelRequest {
	// 文件id
	target_ids: Array<string>
	// 默认是1 收藏
	target_type: number | string
	tag_ids: Array<string>
}

export interface AddLabelRequest {
	name: string
	/**
	 * 标签类型：1-收藏
	 */
	type: number
}

export const generateFavoritesApi = (fetch: HttpClient) => ({
	/**
	 * 获取收藏列表
	 */
	getFavoritesList(data: FavoritesListRequest): Promise<any> {
		return fetch.post<DriveItem[]>(genRequestUrl(RequestUrl.getFavorites), data)
	},

	/**
	 * 删除收藏
	 */
	deleteFavorites(data: DeleteFavoritesRequest) {
		return fetch.delete<DriveItem[]>(genRequestUrl(RequestUrl.deleteFavorites), data)
	},

	/**
	 * 搜索收藏
	 */
	searchFavorites(data: SearchFavoritesRequest) {
		return fetch.post<DriveItem[]>(genRequestUrl(RequestUrl.searchFavorites), data)
	},

	/**
	 * 添加收藏
	 */
	addFavorites(data: SearchFavoritesRequest) {
		return fetch.post<DriveItem[]>(genRequestUrl(RequestUrl.addFavorites), data)
	},

	/**
	 * 关联标签
	 */
	relationLabel(data: RelationLabelRequest) {
		return fetch.put<DriveItem[]>(genRequestUrl(RequestUrl.relationLabel), data)
	},

	/**
	 * 添加标签
	 */
	addLabel(data: AddLabelRequest[]) {
		return fetch.post<DriveItem[]>(genRequestUrl(RequestUrl.addLabel), data)
	},

	/**
	 * 编辑标签
	 */
	editLabel(id: string, data: Record<"name", string>) {
		return fetch.put<DriveItem[]>(genRequestUrl(RequestUrl.editLabel, { id }), data)
	},

	/**
	 * 删除标签
	 */
	deleteLabel(data: Record<"ids", Array<string>>) {
		return fetch.delete<DriveItem[]>(genRequestUrl(RequestUrl.deleteLabel), data)
	},

	/**
	 * 获取标签列表
	 */
	getLabelList(): any {
		return fetch.get<DriveItem[]>(genRequestUrl(RequestUrl.getLabelList))
	},
})

import { useCallback, useMemo } from "react"
import { myGroupsStore } from "../stores/core"
import type { PaginationResponse } from "@/opensource/types/request"
import type { GroupConversationDetail } from "@/opensource/types/chat/conversation"

/**
 * useMyGroupsData - Hook for fetching My Groups data with caching
 * Now uses myGroupsStore for Stale-While-Revalidate caching strategy
 */
export const useMyGroupsData = () => {
	// 立即返回缓存数据（如果有）
	const initialData = useMemo(() => {
		if (myGroupsStore.groups.length > 0) {
			return {
				items: myGroupsStore.groups,
				has_more: myGroupsStore.hasMore,
				page_token: myGroupsStore.pageToken ?? "",
			}
		}
		return null
	}, [])

	// Data fetcher for MagicInfiniteList
	const fetchMyGroupsData = useCallback(
		async (
			params: { page_token?: string } = {},
		): Promise<PaginationResponse<GroupConversationDetail>> => {
			// 首次加载（无 page_token）
			if (!params.page_token) {
				// 有缓存：静默更新（等待完成后返回最新数据）
				if (myGroupsStore.groups.length > 0) {
					const result = await myGroupsStore.fetchAndUpdate(true)
					return {
						items: result.items,
						has_more: result.hasMore,
						page_token: result.pageToken ?? "",
					}
				}

				// 无缓存：正常加载
				const result = await myGroupsStore.fetchAndUpdate(false)
				return {
					items: result.items,
					has_more: result.hasMore,
					page_token: result.pageToken ?? "",
				}
			}

			// 分页加载：请求下一页数据
			const result = await myGroupsStore.fetchMore()
			return {
				items: result.items,
				has_more: result.hasMore,
				page_token: result.pageToken ?? "",
			}
		},
		[],
	)

	return {
		fetchMyGroupsData,
		initialData, // 返回初始缓存数据
	}
}

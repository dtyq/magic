import { useMemo } from "react"
import { useMemoizedFn } from "ahooks"
import { Friend } from "@/opensource/types/contact"
import { PaginationResponse } from "@/opensource/types/request"
import { aiAssistantStore } from "../stores/core"

/**
 * useAiAssistantData - Hook for fetching AI assistant friends data with caching
 * Now uses aiAssistantStore for Stale-While-Revalidate caching strategy
 *
 * @returns Data fetcher function
 */
export const useAiAssistantData = () => {
	// 立即返回缓存数据（如果有）
	const initialData = useMemo(() => {
		if (aiAssistantStore.friends.length > 0) {
			return {
				items: aiAssistantStore.friends,
				has_more: aiAssistantStore.hasMore,
				page_token: aiAssistantStore.pageToken ?? "",
			}
		}
		return null
	}, [])

	// Data fetcher function that can be used with MagicInfiniteList
	const fetchAiAssistantData = useMemoizedFn(
		async (params: { page_token?: string } = {}): Promise<PaginationResponse<Friend>> => {
			// 首次加载（无 page_token）
			if (!params.page_token) {
				// 有缓存：静默更新（等待完成后返回最新数据）
				if (aiAssistantStore.friends.length > 0) {
					const result = await aiAssistantStore.fetchAndUpdate(true)
					return {
						items: result.items,
						has_more: result.hasMore,
						page_token: result.pageToken ?? "",
					}
				}

				// 无缓存：正常加载
				const result = await aiAssistantStore.fetchAndUpdate(false)
				return {
					items: result.items,
					has_more: result.hasMore,
					page_token: result.pageToken ?? "",
				}
			}

			// 分页加载：请求下一页数据
			const result = await aiAssistantStore.fetchMore()
			return {
				items: result.items,
				has_more: result.hasMore,
				page_token: result.pageToken ?? "",
			}
		},
	)

	return {
		fetchAiAssistantData,
		initialData, // 返回初始缓存数据
		// For backward compatibility, keep the old trigger name
		trigger: fetchAiAssistantData,
	}
}

import { useMemoizedFn } from "ahooks"
import { ChatApi } from "@/apis"
import type { UserAvailableAgentInfo } from "@/apis/modules/chat/types"
import type { PaginationResponse } from "@/types/request"

/**
 * Fetch paginated assistant data for contacts pages.
 */
interface UseAiAssistantDataOptions {
	keyword?: string
	pageSize?: number
}

const DEFAULT_PAGE_SIZE = 20

function getPage(pageToken?: string) {
	const page = Number(pageToken)

	if (!pageToken || Number.isNaN(page) || page < 1) return 1

	return page
}

export const useAiAssistantData = ({
	keyword = "",
	pageSize = DEFAULT_PAGE_SIZE,
}: UseAiAssistantDataOptions = {}) => {
	const fetchAiAssistantData = useMemoizedFn(
		async (
			params: { page_token?: string } = {},
		): Promise<PaginationResponse<UserAvailableAgentInfo>> => {
			const page = getPage(params.page_token)
			const result = await ChatApi.getAssistantAvailableList({
				page,
				pageSize,
				keyword,
			})
			const hasMore = page * pageSize < result.total

			return {
				items: result.list,
				has_more: hasMore,
				page_token: hasMore ? String(page + 1) : "",
			}
		},
	)

	return {
		fetchAiAssistantData,
		initialData: null,
		trigger: fetchAiAssistantData,
	}
}

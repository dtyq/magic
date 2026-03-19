import type { PaginationResponse } from "@/types/request"

/**
 * 分页数据请求
 * @param fetch 请求函数
 * @param count 每页数据量
 * @param options 配置
 * @param initPageToken 初始化页码
 * @param prevData 上一次请求的数据
 * @returns
 */
export async function fetchPaddingData<I>(
	fetch: (params: { page_token: string }) => Promise<PaginationResponse<I>>,
	prevData: I[] = [],
	initPageToken = "",
): Promise<I[]> {
	let allData = [...prevData]
	let page_token = initPageToken
	let hasMore = true

	while (hasMore) {
		const response = await fetch({ page_token })

		const { items, has_more, page_token: nextPageToken } = response

		allData = [...allData, ...items]

		hasMore = has_more
		page_token = nextPageToken
	}

	return allData
}

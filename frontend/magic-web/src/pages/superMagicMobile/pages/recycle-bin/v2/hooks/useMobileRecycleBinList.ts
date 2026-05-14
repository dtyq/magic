import { useEffect, useMemo, useState } from "react"
import type { TFunction } from "i18next"
import { useDebounce, useMemoizedFn, useRequest } from "ahooks"
import { useTranslation } from "react-i18next"
import { RecycleBinApi } from "@/apis"
import type { RecycleBinItemData } from "../components/RecycleBinItem"
import { mapListItemToItemData, updateTabCounts } from "./mobileRecycleBinMappers"

const TAB_TO_RESOURCE_TYPE: Record<string, number> = {
	workspaces: 1,
	projects: 2,
	topics: 3,
	files: 4,
}

const RECYCLE_BIN_PAGE_SIZE = 100

export function useMobileRecycleBinList(props: {
	activeTab: string
	searchValue: string
	order?: "desc" | "asc"
	onTabCountChange?: (tabId: string, count: number) => void
}) {
	const { activeTab, searchValue, order = "desc", onTabCountChange } = props
	const { t } = useTranslation("super")
	// 回收站列表按接口关键字查询，统一使用防抖关键字减少移动端重复请求。
	const debouncedSearchValue = useDebounce(searchValue.trim(), { wait: 300 })

	const queryParams = useMemo(
		() => ({
			keyword: debouncedSearchValue || undefined,
			order,
			page: 1,
			page_size: RECYCLE_BIN_PAGE_SIZE,
		}),
		[debouncedSearchValue, order],
	)

	const [items, setItems] = useState<RecycleBinItemData[]>([])
	const [hasError, setHasError] = useState(false)
	const [total, setTotal] = useState(0)
	const [currentPage, setCurrentPage] = useState(1)
	const [isLoadingMore, setIsLoadingMore] = useState(false)

	const { run, loading } = useRequest(RecycleBinApi.getRecycleBinList, {
		manual: true,
		onBefore: () => setHasError(false),
		onSuccess: (data) => {
			const nextItems = data.list.map((item) => mapListItemToItemData(item, t as TFunction))
			setItems(nextItems)
			setTotal(data.total ?? nextItems.length)
			setCurrentPage(1)
			updateTabCounts(nextItems, onTabCountChange)
		},
		onError: () => setHasError(true),
	})

	useEffect(() => {
		run(queryParams)
	}, [queryParams, run])

	/**
	 * 加载下一页回收站数据并追加到现有列表，搜索态下禁止调用。
	 */
	const loadMore = useMemoizedFn(async () => {
		if (debouncedSearchValue || isLoadingMore) return
		const nextPage = currentPage + 1
		setIsLoadingMore(true)

		try {
			const data = await RecycleBinApi.getRecycleBinList({
				...queryParams,
				page: nextPage,
			})
			const nextItems = data.list.map((item) => mapListItemToItemData(item, t as TFunction))
			setItems((prev) => [...prev, ...nextItems])
			setTotal(data.total ?? total)
			setCurrentPage(nextPage)
		} catch (error) {
			console.error("加载更多回收站数据失败:", error)
		} finally {
			setIsLoadingMore(false)
		}
	})

	// 是否还有更多数据（搜索态禁用）
	const hasMore = !debouncedSearchValue && items.length < total

	const filteredItems = useMemo(() => {
		if (activeTab === "all") return items
		const targetType = TAB_TO_RESOURCE_TYPE[activeTab]
		if (!targetType) return items
		return items.filter((item) => item.resourceType === targetType)
	}, [items, activeTab])

	return {
		items,
		setItems,
		filteredItems,
		loading,
		hasError,
		queryParams,
		run,
		debouncedSearchValue,
		hasMore,
		loadMore,
	}
}

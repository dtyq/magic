import { useState, useCallback, useEffect, useRef } from "react"
import { useTranslation } from "react-i18next"
import { throttle } from "lodash-es"
import { SuperMagicApi } from "@/opensource/apis"
import type { ShareListApiResponse, ShareResourceApiItem, SharedTopicFilterStatus } from "../types"
import { ResourceType } from "../../Share/types"
import { SEARCH_DEBOUNCE_DELAY } from "../constants"
import magicToast from "@/opensource/components/base/MagicToaster/utils"

interface UseShareListOptions<T> {
	resourceType: ResourceType
	projectId?: string
	transformData: (item: ShareResourceApiItem, t: any) => T
	pageSize?: number
	filterStatus?: SharedTopicFilterStatus
	filterFn?: (item: ShareResourceApiItem) => boolean // 客户端过滤函数
}

export function useShareList<T>({
	resourceType,
	projectId,
	transformData,
	pageSize = 10,
	filterStatus,
	filterFn,
}: UseShareListOptions<T>) {
	const { t } = useTranslation("super")
	const [searchText, setSearchText] = useState("")
	const [isLoading, setIsLoading] = useState(false)
	const [isLoadingMore, setIsLoadingMore] = useState(false)
	const [hasMore, setHasMore] = useState(true)
	const [data, setData] = useState<T[]>([])
	const [page, setPage] = useState(1)
	const scrollableNodeRef = useRef<HTMLElement>()
	const isFirstLoadRef = useRef(true)

	// 使用 ref 保存最新的 transformData、t 和 filterFn，避免 fetchShareList 频繁重新创建
	const transformDataRef = useRef(transformData)
	const tRef = useRef(t)
	const filterFnRef = useRef(filterFn)

	useEffect(() => {
		transformDataRef.current = transformData
		tRef.current = t
		filterFnRef.current = filterFn
	}, [transformData, t, filterFn])

	// 获取分享列表
	const fetchShareList = useCallback(
		async (currentPage: number, keyword?: string, append = false) => {
			try {
				if (currentPage === 1) {
					setIsLoading(true)
				} else {
					setIsLoadingMore(true)
				}

				const apiResult = (await SuperMagicApi.getShareResourcesList({
					page: currentPage,
					page_size: pageSize,
					keyword: keyword || "",
					resource_type: resourceType,
					project_id: projectId,
					filter_type: filterStatus && filterStatus !== "all" ? filterStatus : undefined,
				})) as ShareListApiResponse

				// 先应用客户端过滤（如果有）
				const filteredList = filterFnRef.current
					? (apiResult.list || []).filter(filterFnRef.current)
					: apiResult.list || []

				// 转换 API 数据为组件需要的数据格式
				const newList: T[] = filteredList.map((item: ShareResourceApiItem) =>
					transformDataRef.current(item, tRef.current),
				)

				if (append) {
					setData((prev) => {
						const updated = [...prev, ...newList]
						setHasMore(updated.length < apiResult.total)
						return updated
					})
				} else {
					setData(newList)
					setHasMore(newList.length < apiResult.total)
				}
			} catch (error) {
				console.error("Failed to fetch share list:", error)
				magicToast.error(tRef.current("shareManagement.fetchFailed") || "获取分享列表失败")
			} finally {
				setIsLoading(false)
				setIsLoadingMore(false)
			}
		},
		[pageSize, resourceType, projectId, filterStatus],
	)

	// 初始加载和搜索（首次加载不防抖）
	useEffect(() => {
		if (isFirstLoadRef.current) {
			// 首次加载，立即执行
			isFirstLoadRef.current = false
			setPage(1)
			fetchShareList(1, searchText, false)
			return
		}

		// 后续搜索，使用防抖
		const timeoutId = setTimeout(() => {
			setPage(1)
			fetchShareList(1, searchText, false)
		}, SEARCH_DEBOUNCE_DELAY)

		return () => {
			clearTimeout(timeoutId)
		}
	}, [searchText, fetchShareList])

	// 使用 ref 保存最新的状态，避免滚动监听器中的闭包问题
	const stateRef = useRef({ isLoadingMore, hasMore, searchText, page })

	useEffect(() => {
		stateRef.current = { isLoadingMore, hasMore, searchText, page }
	}, [isLoadingMore, hasMore, searchText, page])

	// 滚动加载更多
	useEffect(() => {
		if (!scrollableNodeRef.current) return

		const handleScroll = throttle(() => {
			const { isLoadingMore, hasMore, searchText } = stateRef.current

			if (!scrollableNodeRef.current || isLoadingMore || !hasMore) return

			const { scrollTop, scrollHeight, clientHeight } = scrollableNodeRef.current
			const distanceFromBottom = scrollHeight - scrollTop - clientHeight

			// 距离底部 100px 时加载更多
			if (distanceFromBottom < 100) {
				setPage((prevPage) => {
					const nextPage = prevPage + 1
					fetchShareList(nextPage, searchText, true)
					return nextPage
				})
			}
		}, 200)

		const element = scrollableNodeRef.current
		element.addEventListener("scroll", handleScroll)

		return () => {
			handleScroll.cancel?.() // 取消未执行的 throttle
			element.removeEventListener("scroll", handleScroll)
		}
	}, [fetchShareList])

	// 刷新列表（用于取消分享等操作后）
	const refreshList = useCallback(() => {
		setPage(1)
		fetchShareList(1, stateRef.current.searchText, false)
	}, [fetchShareList])

	// 处理分享设置更新（更新列表中某一项的 share_type 和 extra）
	const handleShareSettingsUpdate = useCallback(
		(resourceId: string, newType: number, extraData?: any) => {
			setData((prevData) =>
				prevData.map((item: any) =>
					item.resource_id === resourceId
						? { ...item, share_type: newType, ...(extraData && { extra: extraData }) }
						: item,
				),
			)
		},
		[],
	)

	// 取消单个分享
	const handleCancelShare = useCallback(
		async (resourceId: string) => {
			try {
				await SuperMagicApi.cancelShareResource({ resourceId })
				magicToast.success(t("shareManagement.cancelShareSuccess"))

				// 判断是否只加载了一页
				if (stateRef.current.page === 1) {
					// 只有第一页，刷新列表以加载更多数据
					refreshList()
				} else {
					// 加载了多页，直接从列表移除
					setData((prevData) =>
						prevData.filter((item: any) => item.resource_id !== resourceId),
					)
				}
			} catch (error) {
				console.error("Cancel share failed:", error)
				magicToast.error(t("shareManagement.cancelShareFailed"))
			}
		},
		[refreshList, t],
	)

	// 批量取消分享
	const handleBatchCancelShare = useCallback(
		async (resourceIds: string[]) => {
			try {
				await SuperMagicApi.batchCancelShareResources({ resourceIds })
				magicToast.success(t("shareManagement.batchCancelShareSuccess"))

				// 判断是否只加载了一页
				if (stateRef.current.page === 1) {
					// 只有第一页，刷新列表以加载更多数据
					refreshList()
				} else {
					// 加载了多页，直接从列表移除选中项
					setData((prevData) =>
						prevData.filter((item: any) => !resourceIds.includes(item.resource_id)),
					)
				}
			} catch (error) {
				console.error("Batch cancel share failed:", error)
				magicToast.error(t("shareManagement.batchCancelShareFailed"))
			}
		},
		[refreshList, t],
	)

	return {
		data,
		setData,
		isLoading,
		isLoadingMore,
		hasMore,
		searchText,
		setSearchText,
		scrollableNodeRef,
		refreshList,
		fetchShareList,
		page,
		handleShareSettingsUpdate,
		handleCancelShare,
		handleBatchCancelShare,
	}
}

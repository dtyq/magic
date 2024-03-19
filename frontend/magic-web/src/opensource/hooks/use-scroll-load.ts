import { useState, useRef } from "react"
import { useMemoizedFn } from "ahooks"

interface ScrollLoadOptions<T> {
	/** Initial page size */
	pageSize?: number
	/** Load data function */
	loadFn: (params: { page: number; pageSize: number }) => Promise<{
		list: T[]
		hasMore?: boolean
	}>
}

interface ScrollLoadResult<T> {
	/** Current data list */
	data: T[]
	/** Loading state */
	loading: boolean
	/** Page information */
	pageInfo: {
		page: number
		pageSize: number
		hasMore: boolean
	}
	/** Scroll event handler */
	onScroll: (element?: HTMLElement) => void
	/** Manual load more function */
	loadMore: () => void
	/** Reload data from first page */
	reload: () => void
	/** Reset all data and state */
	reset: () => void
	/** Set data manually */
	setData: React.Dispatch<React.SetStateAction<T[]>>
}

/**
 * Hook for scroll-based infinite loading
 * @param options Configuration options
 * @returns Scroll load utilities and state
 */
function useScrollLoad<T = unknown>(options: ScrollLoadOptions<T>): ScrollLoadResult<T> {
	const { pageSize = 20, loadFn } = options

	const [data, setData] = useState<T[]>([])
	const [loading, setLoading] = useState(false)
	const [pageInfo, setPageInfo] = useState({
		page: 1,
		pageSize,
		hasMore: true,
	})

	const isLoadingRef = useRef(false)
	const scrollElementRef = useRef<HTMLElement | null>(null)

	// Load data function
	const loadData = useMemoizedFn(
		async (
			page: number,
			options: {
				append?: boolean
				force?: boolean
			} = {},
		) => {
			const { append = true, force = false } = options

			if (isLoadingRef.current || (!force && !pageInfo.hasMore)) return

			isLoadingRef.current = true
			setLoading(true)

			try {
				const result = await loadFn({
					page,
					pageSize: pageInfo.pageSize,
				})

				const newData = result.list || []
				const hasMore =
					result.hasMore !== undefined
						? result.hasMore
						: newData.length >= pageInfo.pageSize

				setData((prev) => (append ? [...prev, ...newData] : newData))
				setPageInfo((prev) => ({
					...prev,
					page,
					hasMore,
				}))
			} catch (error) {
				console.error("Failed to load data:", error)
			} finally {
				isLoadingRef.current = false
				setLoading(false)
			}
		},
	)

	// Check if scrolled to bottom
	const checkScrollBottom = useMemoizedFn((element: HTMLElement) => {
		const { scrollTop, clientHeight, scrollHeight } = element
		// Add small buffer (5px) to trigger loading before reaching absolute bottom
		return scrollTop + clientHeight >= scrollHeight - 5
	})

	// Scroll event handler
	const onScroll = useMemoizedFn((element?: HTMLElement) => {
		const targetElement = element || scrollElementRef.current
		if (!targetElement || !pageInfo.hasMore || isLoadingRef.current) return

		if (checkScrollBottom(targetElement)) loadData(pageInfo.page + 1)
	})

	// Load more function
	const loadMore = useMemoizedFn(() => {
		if (pageInfo.hasMore && !isLoadingRef.current) loadData(pageInfo.page + 1)
	})

	// Reload from first page
	const reload = useMemoizedFn(() => {
		setPageInfo((prev) => ({
			...prev,
			page: 1,
			hasMore: true,
		}))
		loadData(1, { append: false, force: true })
	})

	// Reset all data and state
	const reset = useMemoizedFn(() => {
		setData([])
		setLoading(false)
		setPageInfo({
			page: 1,
			pageSize,
			hasMore: true,
		})
		isLoadingRef.current = false
	})

	return {
		data,
		loading,
		pageInfo,
		onScroll,
		loadMore,
		reload,
		reset,
		setData,
	}
}

export default useScrollLoad
export type { ScrollLoadOptions, ScrollLoadResult }

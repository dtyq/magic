import { useState, useCallback } from "react"
import { useMount } from "ahooks"
import { unionBy } from "lodash-es"

// Types
import type {
	DataFetcher,
	PaginationResponse,
	UseInfiniteDataReturn,
	InfiniteDataState,
} from "../types"

/**
 * useInfiniteData - Generic infinite data fetching hook
 *
 * @param dataFetcher - Function to fetch data
 * @param options - Configuration options
 * @returns Hook state and methods
 */
export function useInfiniteData<T = any, P = any>(
	dataFetcher: DataFetcher<T, P>,
	options: {
		autoFetch?: boolean
		initialParams?: P
		keyExtractor?: (item: T) => string | number
		initialData?: PaginationResponse<T> | null
	} = {},
): UseInfiniteDataReturn<T, P> {
	const { autoFetch = true, initialParams, keyExtractor, initialData } = options

	// State management - 如果有 initialData，使用它初始化
	const [state, setState] = useState<InfiniteDataState<T>>({
		data: initialData
			? initialData
			: {
					items: [],
					has_more: true,
					page_token: "",
				},
		isLoading: false,
		error: null,
	})

	// Fetch data function
	const fetchData = useCallback(
		async (params?: P & { page_token?: string }) => {
			// Prevent multiple concurrent requests
			if (state.isLoading) return

			setState((prev) => ({
				...prev,
				isLoading: true,
				error: null,
			}))

			try {
				const mergedParams = {
					...initialParams,
					...params,
				} as P & { page_token?: string }

				const result = await dataFetcher(mergedParams)

				setState((prev) => {
					const isFirstPage = !params?.page_token
					let newItems: T[]

					if (isFirstPage) {
						newItems = result.items
					} else {
						if (keyExtractor) {
							newItems = unionBy(
								[...(prev.data?.items || []), ...result.items],
								keyExtractor,
							)
						} else {
							// If no keyExtractor, just concatenate arrays
							newItems = [...(prev.data?.items || []), ...result.items]
						}
					}

					return {
						...prev,
						data: {
							items: newItems,
							has_more: result.has_more,
							page_token: result.page_token,
						},
						isLoading: false,
					}
				})
			} catch (error) {
				setState((prev) => ({
					...prev,
					isLoading: false,
					error: error instanceof Error ? error : new Error(String(error)),
				}))
			}
		},
		[dataFetcher, initialParams, keyExtractor, state.isLoading],
	)

	// Reset data
	const reset = useCallback(() => {
		setState({
			data: {
				items: [],
				has_more: true,
				page_token: "",
			},
			isLoading: false,
			error: null,
		})
	}, [])

	// Refresh data (reset and fetch)
	const refresh = useCallback(async () => {
		reset()
		await fetchData(initialParams as P & { page_token?: string })
	}, [reset, fetchData, initialParams])

	// Auto fetch on mount
	useMount(() => {
		if (autoFetch) {
			// 如果有 initialData，触发后台静默更新（不显示 loading）
			if (initialData && initialData.items.length > 0) {
				// 静默更新：不改变 loading 状态
				dataFetcher(initialParams as P & { page_token?: string })
					.then((result) => {
						setState((prev) => ({
							...prev,
							data: {
								items: result.items,
								has_more: result.has_more,
								page_token: result.page_token,
							},
						}))
					})
					.catch((error) => {
						console.error("Silent update failed:", error)
					})
			} else {
				// 正常加载
				fetchData(initialParams as P & { page_token?: string })
			}
		}
	})

	return {
		data: state.data,
		isLoading: state.isLoading,
		error: state.error,
		fetchData,
		reset,
		refresh,
	}
}

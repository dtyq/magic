import { useState, useCallback, useEffect } from "react"
import { useMemoizedFn } from "ahooks"
import type { MentionStoreRequest } from "../dispatch"
import type {
	DataService,
	MentionItem,
	MentionPanelLoadStateOptions,
	MentionStoreRequestBuildOptions,
} from "../types"
import { PanelState } from "../types"
import {
	DEFAULT_ITEMS,
	ERROR_MESSAGES,
	DEBOUNCE_DELAYS,
	createDefaultItems,
	createErrorMessages,
} from "../constants"
import type { I18nTexts } from "../i18n/types"
import { buildMentionStoreRequest } from "../runtime/builtin/request-builder"
import { getMentionItemsByRequest } from "../utils/dataService"

interface UseDataSourceProps<TCatalogId extends string = string> {
	dataService?: DataService
	initialState?: PanelState
	t?: I18nTexts
	buildStoreRequest?: (
		options: MentionStoreRequestBuildOptions<TCatalogId>,
	) => MentionStoreRequest | null
}

interface UseDataSourceReturn<TCatalogId extends string = string> {
	items: MentionItem[]
	loading: boolean
	error?: string
	loadStateItems: (
		state: PanelState,
		options?: MentionPanelLoadStateOptions<TCatalogId>,
	) => Promise<void>
	loadDefaultItems: () => Promise<void>
	searchItems: (query: string, scopeFolderId?: string) => Promise<void>
	refreshData: () => Promise<void>
}

interface DataSourceContext<TCatalogId extends string = string> {
	state: PanelState
	catalogId?: TCatalogId
	itemId?: string
	query?: string
}

/**
 * useDataSource - Data source management hook
 *
 * @param props - Data source configuration
 * @returns Data source state and actions
 */
export function useDataSource<TCatalogId extends string = string>(
	props: UseDataSourceProps<TCatalogId>,
): UseDataSourceReturn<TCatalogId> {
	const { dataService, initialState = PanelState.DEFAULT, t, buildStoreRequest } = props

	const resolveStoreRequest = useCallback(
		(options: MentionStoreRequestBuildOptions<TCatalogId>) => {
			if (buildStoreRequest) return buildStoreRequest(options)

			return buildMentionStoreRequest(
				options as MentionStoreRequestBuildOptions<string>,
			) as MentionStoreRequest | null
		},
		[buildStoreRequest],
	)

	// State management
	const [items, setItems] = useState<MentionItem[]>([])
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState<string>()
	const [currentContext, setCurrentContext] = useState<DataSourceContext<TCatalogId>>({
		state: initialState,
	})

	// Create dynamic configurations based on translation
	const defaultItems = t ? createDefaultItems(t) : DEFAULT_ITEMS
	const errorMessages = t ? createErrorMessages(t) : ERROR_MESSAGES

	// Generic data loading wrapper
	const loadData = useCallback(
		async (
			loadFn: () => Promise<MentionItem[]> | MentionItem[],
			fallbackData?: MentionItem[],
		) => {
			setLoading(true)
			setError(undefined)

			try {
				const data = await loadFn()
				setItems(data)
			} catch (err) {
				const errorMessage =
					err instanceof Error ? err.message : errorMessages.UNKNOWN_ERROR
				setError(errorMessage)

				// Use fallback data if available
				if (fallbackData) {
					setItems(fallbackData)
				}
			} finally {
				setLoading(false)
			}
		},
		[errorMessages.UNKNOWN_ERROR],
	)

	// Load default items
	const loadDefaultItems = useMemoizedFn(async () => {
		setCurrentContext({
			state: PanelState.DEFAULT,
		})

		if (dataService) {
			const request = resolveStoreRequest({
				state: PanelState.DEFAULT,
				t: t as I18nTexts,
			})
			if (!request) return

			await loadData(
				() => getMentionItemsByRequest(dataService, request),
				defaultItems[PanelState.DEFAULT],
			)
		} else {
			// Use dynamic default items
			setItems(defaultItems[PanelState.DEFAULT])
		}
	})

	// Search items with debouncing
	const searchItems = useMemoizedFn(async (query: string, scopeFolderId?: string) => {
		// Don't auto-transition to default here - let the parent handle state transitions
		if (!query.trim()) {
			return
		}

		setCurrentContext({
			state: PanelState.SEARCH,
			query,
			itemId: scopeFolderId,
		})

		if (dataService) {
			const request = resolveStoreRequest({
				state: PanelState.SEARCH,
				query,
				scopeFolderId,
				t: t as I18nTexts,
			})
			if (!request) return

			await loadData(() => getMentionItemsByRequest(dataService, request))
		} else {
			// Mock search implementation
			await loadData(() => Promise.resolve([]))
		}
	})

	const loadStateItems = useMemoizedFn(
		async (state: PanelState, options?: MentionPanelLoadStateOptions<TCatalogId>) => {
			const request = resolveStoreRequest({
				state,
				catalogId: options?.catalogId,
				itemId: options?.itemId,
				query: options?.query,
				t: t as I18nTexts,
			})
			if (!request || !dataService) return

			setCurrentContext({
				state,
				catalogId: options?.catalogId,
				itemId: options?.itemId,
				query: options?.query,
			})

			if (options?.silent) {
				setItems(await getMentionItemsByRequest(dataService, request))
				return
			}

			const fallbackData =
				state === PanelState.DEFAULT ? defaultItems[PanelState.DEFAULT] : []
			await loadData(() => getMentionItemsByRequest(dataService, request), fallbackData)
		},
	)

	// Refresh current data
	const refreshData = useMemoizedFn(async () => {
		await loadStateItems(currentContext.state, {
			catalogId: currentContext.catalogId,
			itemId: currentContext.itemId,
			query: currentContext.query,
		})
	})

	const refreshCurrentStateSilently = useMemoizedFn(async () => {
		if (!dataService) return

		await loadStateItems(currentContext.state, {
			catalogId: currentContext.catalogId,
			itemId: currentContext.itemId,
			query: currentContext.query,
			silent: true,
		})
	})

	// 注册刷新回调（后台增量更新后静默刷新当前列表）
	useEffect(() => {
		if (!dataService?.setRefreshHandler) return

		dataService.setRefreshHandler(() => {
			void refreshCurrentStateSilently()
		})

		return () => dataService.setRefreshHandler?.(undefined)
	}, [dataService, refreshCurrentStateSilently])

	return {
		items,
		loading,
		error,
		loadStateItems,
		loadDefaultItems,
		searchItems,
		refreshData,
	}
}

// Debounced search hook
export function useDebouncedSearch(
	searchFn: (query: string, scopeFolderId?: string) => Promise<void>,
	delay: number = DEBOUNCE_DELAYS.SEARCH,
) {
	const [searchTimeoutId, setSearchTimeoutId] = useState<NodeJS.Timeout>()

	const debouncedSearch = useCallback(
		(query: string, scopeFolderId?: string) => {
			// Clear previous timeout
			if (searchTimeoutId) {
				clearTimeout(searchTimeoutId)
			}

			// Set new timeout
			const timeoutId = setTimeout(() => {
				void searchFn(query, scopeFolderId)
			}, delay)

			setSearchTimeoutId(timeoutId)
		},
		[searchFn, delay, searchTimeoutId],
	)

	// Cleanup on unmount
	const cleanup = useCallback(() => {
		if (searchTimeoutId) {
			clearTimeout(searchTimeoutId)
		}
	}, [searchTimeoutId])

	return { debouncedSearch, cleanup }
}

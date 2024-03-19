import { useState, useCallback, useEffect } from "react"
import { useMemoizedFn } from "ahooks"
import { MentionItem, PanelState, DataService } from "../types"
import {
	DEFAULT_ITEMS,
	ERROR_MESSAGES,
	DEBOUNCE_DELAYS,
	createDefaultItems,
	createErrorMessages,
} from "../constants"
import type { I18nTexts } from "../i18n/types"

interface UseDataSourceProps {
	dataService?: DataService
	initialState?: PanelState
	t: I18nTexts
}

interface UseDataSourceReturn {
	items: MentionItem[]
	loading: boolean
	error?: string
	loadDefaultItems: () => Promise<void>
	searchItems: (query: string) => Promise<void>
	loadFolderItems: (folderId: string) => Promise<void>
	loadUploadFiles: () => Promise<void>
	loadMcpExtensions: () => Promise<void>
	loadAgents: () => Promise<void>
	loadSkills: () => Promise<void>
	loadToolItems: (collectionId: string) => Promise<void>
	clearError: () => void
	refreshData: () => Promise<void>
	loadAllHistory: () => Promise<void>
	loadCurrentTabs: () => Promise<void>
}

/**
 * useDataSource - Data source management hook
 *
 * @param props - Data source configuration
 * @returns Data source state and actions
 */
export function useDataSource(props: UseDataSourceProps): UseDataSourceReturn {
	const { dataService, initialState = PanelState.DEFAULT, t } = props

	// State management
	const [items, setItems] = useState<MentionItem[]>([])
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState<string>()
	const [currentState, setCurrentState] = useState(initialState)

	// Create dynamic configurations based on translation
	const defaultItems = t ? createDefaultItems(t) : DEFAULT_ITEMS
	const errorMessages = t ? createErrorMessages(t) : ERROR_MESSAGES

	// Clear error state
	const clearError = useMemoizedFn(() => {
		setError(undefined)
	})

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
		setCurrentState(PanelState.DEFAULT)

		if (dataService?.getDefaultItems) {
			await loadData(() => dataService.getDefaultItems(t), defaultItems[PanelState.DEFAULT])
		} else {
			// Use dynamic default items
			setItems(defaultItems[PanelState.DEFAULT])
		}
	})

	// 注册刷新回调（CanvasDesignMentionDataService：上传成功后触发面板更新）
	useEffect(() => {
		const service = dataService as { setRefreshHandler?: (h: (() => void) | undefined) => void }
		if (service?.setRefreshHandler) {
			service.setRefreshHandler(() => loadDefaultItems())
			return () => service.setRefreshHandler?.(undefined)
		}
	}, [dataService, loadDefaultItems])

	// Search items with debouncing
	const searchItems = useMemoizedFn(async (query: string) => {
		// Don't auto-transition to default here - let the parent handle state transitions
		if (!query.trim()) {
			return
		}

		setCurrentState(PanelState.SEARCH)

		if (dataService?.searchItems) {
			await loadData(() => dataService.searchItems(query))
		} else {
			// Mock search implementation
			await loadData(() => Promise.resolve([]))
		}
	})

	// Load folder items
	const loadFolderItems = useMemoizedFn(async (folderId: string) => {
		setCurrentState(PanelState.FOLDER)

		if (dataService?.getFolderItems) {
			await loadData(() => dataService.getFolderItems(folderId), [])
		} else {
			await loadData(() => Promise.resolve([]))
		}
	})

	// Load upload files
	const loadUploadFiles = useMemoizedFn(async () => {
		setCurrentState(PanelState.UPLOAD_FILES)

		if (dataService?.getUploadFiles) {
			await loadData(dataService.getUploadFiles, [])
		} else {
			await loadData(() => Promise.resolve([]))
		}
	})

	// Load MCP extensions
	const loadMcpExtensions = useMemoizedFn(async () => {
		setCurrentState(PanelState.MCP)

		if (dataService?.getMcpExtensions) {
			await loadData(dataService.getMcpExtensions, [])
		} else {
			await loadData(() => Promise.resolve([]))
		}
	})

	// Load agents
	const loadAgents = useMemoizedFn(async () => {
		setCurrentState(PanelState.AGENT)

		if (dataService?.getAgents) {
			await loadData(dataService.getAgents, [])
		} else {
			await loadData(() => Promise.resolve([]))
		}
	})

	const loadSkills = useMemoizedFn(async () => {
		setCurrentState(PanelState.SKILLS)

		if (dataService?.getSkills) {
			await loadData(dataService.getSkills, [])
		} else {
			await loadData(() => Promise.resolve([]))
		}
	})

	// Load tool items
	const loadToolItems = useMemoizedFn(async (collectionId: string) => {
		setCurrentState(PanelState.TOOLS)

		if (dataService?.getToolItems) {
			await loadData(() => dataService.getToolItems(collectionId), [])
		} else {
			await loadData(() => Promise.resolve([]))
		}
	})

	const loadAllHistory = useMemoizedFn(async () => {
		setCurrentState(PanelState.HISTORIES)

		if (dataService?.getAllHistory) {
			await loadData(() => dataService.getAllHistory(), [])
		} else {
			await loadData(() => Promise.resolve([]))
		}
	})

	const loadCurrentTabs = useMemoizedFn(async () => {
		setCurrentState(PanelState.TABS)
		if (dataService?.getCurrentTabs) {
			await loadData(() => dataService.getCurrentTabs(), [])
		} else {
			await loadData(() => Promise.resolve([]))
		}
	})

	// Refresh current data
	const refreshData = useMemoizedFn(async () => {
		switch (currentState) {
			case PanelState.DEFAULT:
				await loadDefaultItems()
				break
			case PanelState.MCP:
				await loadMcpExtensions()
				break
			case PanelState.AGENT:
				await loadAgents()
				break
			case PanelState.SKILLS:
				await loadSkills()
				break
			// Search and folder states need specific parameters, skip refresh
			default:
				break
		}
	})

	return {
		items,
		loading,
		error,
		loadDefaultItems,
		searchItems,
		loadFolderItems,
		loadUploadFiles,
		loadMcpExtensions,
		loadAgents,
		loadSkills,
		loadToolItems,
		clearError,
		refreshData,
		loadAllHistory,
		loadCurrentTabs,
	}
}

// Debounced search hook
export function useDebouncedSearch(
	searchFn: (query: string) => Promise<void>,
	delay: number = DEBOUNCE_DELAYS.SEARCH,
) {
	const [searchTimeoutId, setSearchTimeoutId] = useState<NodeJS.Timeout>()

	const debouncedSearch = useCallback(
		(query: string) => {
			// Clear previous timeout
			if (searchTimeoutId) {
				clearTimeout(searchTimeoutId)
			}

			// Set new timeout
			const timeoutId = setTimeout(() => {
				searchFn(query)
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

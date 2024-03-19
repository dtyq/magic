import { useState, useEffect, useCallback, useRef } from "react"
import { useMemoizedFn } from "ahooks"
import {
	MentionPanelState,
	UseMentionPanelReturn,
	PanelState,
	NavigationItem,
	MentionItem,
	DataService,
	MentionItemType,
} from "../types"
import { STATE_TRANSITIONS } from "../constants"
import type { I18nTexts } from "../i18n/types"
import { useKeyboardNav } from "./useKeyboardNav"
import { useDataSource, useDebouncedSearch } from "./useDataSource"

interface UseMentionPanelProps {
	initialState?: PanelState
	onSelect?: (item: MentionItem, context?: { reset?: () => void }) => void
	onClose?: () => void
	dataService?: DataService
	enabled?: boolean
	t: I18nTexts // I18nTexts from the i18n system
}

/**
 * Find the first selectable item index
 * @param items - Items to search
 * @param startIndex - Starting index (default: 0)
 * @returns Index of first selectable item, or 0 if none found
 */
function findFirstSelectableIndex(items: MentionItem[], startIndex = 0): number {
	if (items.length === 0) return 0

	for (let i = startIndex; i < items.length; i++) {
		if (!items[i].unSelectable) {
			return i
		}
	}

	// If no selectable item found from startIndex, search from beginning
	if (startIndex > 0) {
		for (let i = 0; i < startIndex; i++) {
			if (!items[i].unSelectable) {
				return i
			}
		}
	}

	// If no selectable items found, return 0
	return 0
}

/**
 * Check if an index is valid and selectable
 * @param items - Items array
 * @param index - Index to check
 * @returns True if index is valid and selectable
 */
function isValidSelectableIndex(items: MentionItem[], index: number): boolean {
	return index >= 0 && index < items.length && !items[index]?.unSelectable
}

/**
 * Filter items based on search query
 * @param items - Items to filter
 * @param query - Search query
 * @returns Filtered items
 */
function filterItemsByQuery(items: MentionItem[], query: string): MentionItem[] {
	if (!query.trim()) return items

	const lowercaseQuery = query.toLowerCase()

	return items.filter((item) => {
		// Search in name
		if (item.name?.toLowerCase().includes(lowercaseQuery)) {
			return true
		}

		// Search in description
		if (item.description?.toLowerCase().includes(lowercaseQuery)) {
			return true
		}

		// Search in path (for files)
		if (item.path?.toLowerCase().includes(lowercaseQuery)) {
			return true
		}

		// Search in extension (for files)
		if (item.extension?.toLowerCase().includes(lowercaseQuery)) {
			return true
		}

		// Search in structured data based on item type
		if (item.data) {
			const data = item.data as Record<string, unknown>
			const fieldsToCheck = [
				"name",
				"description",
				"file_name",
				"file_path",
				"agent_name",
				"agent_description",
			]
			for (const key of fieldsToCheck) {
				const value = (data as Record<string, unknown>)[key]
				if (typeof value === "string" && value.toLowerCase().includes(lowercaseQuery))
					return true
			}
		}

		return false
	})
}

/**
 * useMentionPanel - Main logic hook for MentionPanel
 *
 * @param props - Panel configuration
 * @returns Panel state and actions
 */
export function useMentionPanel(props: UseMentionPanelProps): UseMentionPanelReturn {
	const {
		initialState = PanelState.DEFAULT,
		onSelect,
		onClose,
		dataService,
		enabled = true,
		t,
	} = props

	// Panel state with state-specific selection history
	const [panelState, setPanelState] = useState<MentionPanelState>({
		currentState: initialState,
		selectedIndex: 0,
		searchQuery: "",
		navigationStack: [],
		items: [],
		originalItems: [],
		loading: false,
	})

	// Keep track of the state before search to restore it correctly
	const [stateBeforeSearch, setStateBeforeSearch] = useState<PanelState>(initialState)

	// Keep track of selection indices for each state
	const [stateSelectionHistory, setStateSelectionHistory] = useState<Record<string, number>>({})

	// Keep track of search query before entering folders (for restoring search state when navigating back)
	const [searchQueryBeforeFolder, setSearchQueryBeforeFolder] = useState<string>("")

	// Trigger to focus search input
	const [shouldFocusSearch, setShouldFocusSearch] = useState<boolean>(false)

	// Transition lock to prevent concurrent state transitions
	const transitionLockRef = useRef<boolean>(false)

	// Data source management
	const dataSourceHook = useDataSource({
		dataService,
		initialState,
		t: t as I18nTexts,
	})

	// Note: Debounced search is no longer used for context-aware search
	// We keep the reference for potential future use with global search
	const { debouncedSearch, cleanup: cleanupSearch } = useDebouncedSearch(
		dataSourceHook.searchItems,
	)

	// Update panel state when data changes
	useEffect(() => {
		setPanelState((prev) => {
			const newItems = dataSourceHook.items

			// If we have a search query, filter the new items
			const filteredItems = prev.searchQuery
				? filterItemsByQuery(newItems, prev.searchQuery)
				: newItems

			return {
				...prev,
				items: filteredItems,
				// Only update originalItems when not searching to preserve search context
				originalItems: prev.searchQuery ? prev.originalItems : newItems,
				loading: dataSourceHook.loading,
				error: dataSourceHook.error,
			}
		})
	}, [
		dataSourceHook.items,
		dataSourceHook.loading,
		dataSourceHook.error,
		panelState.currentState,
		panelState.searchQuery,
		t,
	])

	// Reset selected index when items change
	useEffect(() => {
		if (panelState.items.length > 0) {
			setPanelState((prev) => {
				let newIndex = Math.min(prev.selectedIndex, prev.items.length - 1)

				// Check if current index is still valid and selectable
				if (!isValidSelectableIndex(prev.items, newIndex)) {
					// Find the first selectable item
					newIndex = findFirstSelectableIndex(prev.items)
				}

				return {
					...prev,
					selectedIndex: newIndex,
				}
			})
		}
	}, [panelState.items])

	// Handle initial data loading
	useEffect(() => {
		if (initialState === PanelState.DEFAULT) {
			dataSourceHook.loadDefaultItems()
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [initialState])

	useEffect(() => {
		if (enabled) {
			dataService?.preLoadList()
			dataSourceHook.loadDefaultItems()
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [enabled])

	// Cleanup debounced search on unmount
	useEffect(() => {
		return () => {
			cleanupSearch()
		}
	}, [cleanupSearch])

	// Navigation actions
	const selectItem = useMemoizedFn((index: number) => {
		if (index < 0 || index >= panelState.items.length) return

		// Check if the target index is selectable
		if (!isValidSelectableIndex(panelState.items, index)) {
			// Find the nearest selectable item
			const selectableIndex = findFirstSelectableIndex(panelState.items, index)
			if (
				selectableIndex !== index &&
				isValidSelectableIndex(panelState.items, selectableIndex)
			) {
				index = selectableIndex
			} else {
				return // No selectable item found
			}
		}

		setPanelState((prev) => ({
			...prev,
			selectedIndex: index,
		}))
	})

	const selectPrevious = useMemoizedFn(() => {
		setPanelState((prev) => {
			if (prev.items.length === 0) return prev

			// Find the previous selectable item
			let newIndex = prev.selectedIndex
			let attempts = 0
			const maxAttempts = prev.items.length

			do {
				newIndex = newIndex > 0 ? newIndex - 1 : prev.items.length - 1
				attempts++
			} while (prev.items[newIndex]?.unSelectable && attempts < maxAttempts)

			// If all items are unselectable, stay at current position
			if (prev.items[newIndex]?.unSelectable) {
				return prev
			}

			return {
				...prev,
				selectedIndex: newIndex,
			}
		})
	})

	const selectNext = useMemoizedFn(() => {
		setPanelState((prev) => {
			if (prev.items.length === 0) return prev

			// Find the next selectable item
			let newIndex = prev.selectedIndex
			let attempts = 0
			const maxAttempts = prev.items.length

			do {
				newIndex = newIndex < prev.items.length - 1 ? newIndex + 1 : 0
				attempts++
			} while (prev.items[newIndex]?.unSelectable && attempts < maxAttempts)

			// If all items are unselectable, stay at current position
			if (prev.items[newIndex]?.unSelectable) {
				return prev
			}

			return {
				...prev,
				selectedIndex: newIndex,
			}
		})
	})

	// Navigation stack management
	const pushNavigation = useCallback((item: NavigationItem) => {
		setPanelState((prev) => ({
			...prev,
			navigationStack: [...prev.navigationStack, item],
		}))
	}, [])

	const popNavigation = useCallback(() => {
		setPanelState((prev) => ({
			...prev,
			navigationStack: prev.navigationStack.slice(0, -1),
		}))
	}, [])

	const deleteHistoryItem = useCallback(
		async (item: MentionItem) => {
			// Remove from store
			dataService?.removeFromHistory(item.id)

			// Always immediately remove from current items to provide instant feedback
			setPanelState((prev) => ({
				...prev,
				items: prev.items.filter((i) => i.id !== item.id),
			}))

			// If we're in default state and not searching, async reload to get new history items
			if (panelState.currentState === PanelState.DEFAULT && !panelState.searchQuery) {
				// Don't await - let it reload in background to avoid UI flash
				setTimeout(() => {
					dataSourceHook.loadDefaultItems()
				}, 0)
			}
		},
		[dataService, panelState.currentState, panelState.searchQuery, dataSourceHook],
	)

	// Navigate directly to a specific breadcrumb level
	const navigateToBreadcrumb = useMemoizedFn(async (targetIndex: number) => {
		const stackLength = panelState.navigationStack.length
		if (targetIndex < 0 || targetIndex >= stackLength) return
		if (targetIndex === stackLength - 1) return

		const targetNav = panelState.navigationStack[targetIndex]

		// Special handling for search results virtual breadcrumb
		if (targetNav.id === "search-results") {
			// Clear navigation stack and restore search state
			setPanelState((prev) => ({
				...prev,
				navigationStack: [],
				selectedIndex: findFirstSelectableIndex(prev.items),
				searchQuery: "",
			}))

			// Check if we need to restore search state
			if (searchQueryBeforeFolder.trim()) {
				console.log(
					"[useMentionPanel] restoring search state from breadcrumb:",
					searchQueryBeforeFolder,
				)
				await transitionToState(PanelState.DEFAULT)
				// Restore the search query after transitioning to default state
				await search(searchQueryBeforeFolder)
				// Focus search input after restoring search
				setShouldFocusSearch(true)
				// Clear the saved search query
				setSearchQueryBeforeFolder("")
			} else {
				await transitionToState(PanelState.DEFAULT)
			}
			return
		}

		setPanelState((prev) => ({
			...prev,
			navigationStack: prev.navigationStack.slice(0, targetIndex + 1),
			selectedIndex: findFirstSelectableIndex(prev.items),
			searchQuery: "",
		}))

		await transitionToState(PanelState.FOLDER, { itemId: targetNav.id })
	})

	// State transition logic with selection history preservation
	const transitionToState = useCallback(
		async (newState: PanelState, context?: { itemId?: string; query?: string }) => {
			// Prevent concurrent transitions
			if (transitionLockRef.current) {
				console.log(
					"[useMentionPanel] Skipping transition - another transition in progress",
				)
				return
			}

			// Prevent unnecessary transitions to the same state
			if (panelState.currentState === newState && !context) {
				console.log(
					"[useMentionPanel] Skipping transition - already in target state:",
					newState,
				)
				return
			}

			console.log("[useMentionPanel] transitionToState:", {
				from: panelState.currentState,
				to: newState,
				context,
			})

			// Set transition lock
			transitionLockRef.current = true

			try {
				// Cancel any pending search requests when transitioning states
				cleanupSearch()

				// Save current selection index for the current state
				setStateSelectionHistory((prev) => ({
					...prev,
					[panelState.currentState]: panelState.selectedIndex,
				}))

				// Get the previous selection index for the new state, or default to 0
				const previousSelectionIndex = stateSelectionHistory[newState] || 0

				setPanelState((prev) => ({
					...prev,
					currentState: newState,
					selectedIndex: previousSelectionIndex,
					searchQuery: "", // Clear search query when transitioning states
				}))

				// Update state before search to the new state
				setStateBeforeSearch(newState)

				// Load appropriate data for the new state
				switch (newState) {
					case PanelState.DEFAULT:
						console.log("[useMentionPanel] loading default items")
						await dataSourceHook.loadDefaultItems()
						// Focus search input when returning to default state
						setShouldFocusSearch(true)
						break
					case PanelState.HISTORIES:
						await dataSourceHook.loadAllHistory()
						break
					case PanelState.TABS:
						await dataSourceHook.loadCurrentTabs()
						break
					case PanelState.FOLDER:
						// 如果当前是工具文件夹，则加载工具列表
						if (context?.itemId === PanelState.TOOLS) {
							await dataSourceHook.loadToolItems(context.itemId)
						} else if (context?.itemId) {
							await dataSourceHook.loadFolderItems(context.itemId)
						}
						break
					case PanelState.TOOLS:
						if (context?.itemId) {
							await dataSourceHook.loadToolItems(context.itemId)
						}
						break
					case PanelState.UPLOAD_FILES:
						await dataSourceHook.loadUploadFiles()
						break
					case PanelState.MCP:
						await dataSourceHook.loadMcpExtensions()
						break
					case PanelState.AGENT:
						await dataSourceHook.loadAgents()
						break
					case PanelState.SKILLS:
						await dataSourceHook.loadSkills()
						break
				}

				// After data is loaded, ensure the selection index is valid and selectable
				setPanelState((prev) => {
					let newIndex = Math.min(
						previousSelectionIndex,
						Math.max(0, prev.items.length - 1),
					)

					// Check if the index is selectable
					if (!isValidSelectableIndex(prev.items, newIndex)) {
						newIndex = findFirstSelectableIndex(prev.items)
					}

					return {
						...prev,
						selectedIndex: newIndex,
					}
				})
			} finally {
				// Always release transition lock
				transitionLockRef.current = false
			}
		},
		[
			panelState.currentState,
			panelState.selectedIndex,
			cleanupSearch,
			stateSelectionHistory,
			dataSourceHook,
		],
	)

	// Note: We removed the automatic initialState response to prevent infinite loops
	// State changes should be driven by explicit actions like search() instead

	// Action handlers
	const confirmSelection = useMemoizedFn(
		async ({ enterFolder = false }: { enterFolder?: boolean } = {}) => {
			const selectedItem = panelState.items[panelState.selectedIndex]
			if (!selectedItem || panelState.loading || transitionLockRef.current) return

			// Check if item is unselectable - if so, don't select it
			if (selectedItem.unSelectable) {
				return
			}

			// Check if this is a history item - if so, select directly
			if (selectedItem.tags?.includes("history")) {
				onSelect?.(selectedItem, { reset })
				return
			}

			// In TABS state, folders from tabs should be selectable directly
			// When not explicitly entering folder (enterFolder = false), select the folder directly
			if (
				panelState.currentState === PanelState.TABS &&
				selectedItem.type === MentionItemType.FOLDER &&
				!enterFolder
			) {
				onSelect?.(selectedItem, { reset })
				return
			}

			// Dynamic state transition logic based on item type
			let targetState: PanelState | null = null

			// Check static transitions first (for built-in items)
			const stateTransitions = STATE_TRANSITIONS[panelState.currentState]
			const staticTransition = stateTransitions?.[selectedItem.id]

			if (staticTransition) {
				targetState = staticTransition
			} else {
				// Dynamic transitions based on item type
				switch (selectedItem.type) {
					case MentionItemType.FOLDER:
						if (enterFolder) {
							if (selectedItem.isFolder) {
								targetState = PanelState.FOLDER
							}
						} else {
							targetState = null
						}
						break
					case MentionItemType.TOOL:
						if (selectedItem.isFolder) {
							targetState = PanelState.TOOLS
						} else {
							targetState = null
						}
						break
					case MentionItemType.TABS:
						targetState = PanelState.TABS
						break
					case MentionItemType.HISTORIES:
						targetState = PanelState.HISTORIES
						break
					case MentionItemType.MCP:
					case MentionItemType.AGENT:
					case MentionItemType.SKILL:
					case MentionItemType.PROJECT_FILE:
					case MentionItemType.UPLOAD_FILE:
					case MentionItemType.CLOUD_FILE:
						// These items are selected directly, no state transition
						targetState = null
						break
				}
			}

			if (targetState) {
				// Navigate to the next state
				// 确定当前所在的父文件夹ID (仅在文件夹导航时需要)
				let currentParentId: string | undefined
				if (
					panelState.currentState === PanelState.FOLDER &&
					panelState.navigationStack.length > 0
				) {
					// 如果在文件夹中，最后一个导航栈项目就是当前所在的父文件夹
					currentParentId =
						panelState.navigationStack[panelState.navigationStack.length - 1].id
				}
				// 如果是从默认状态进入顶级文件夹，currentParentId 保持 undefined

				// Save search query before entering folder if we're in default state with an active search
				const isFromSearchResults =
					panelState.currentState === PanelState.DEFAULT &&
					panelState.searchQuery.trim() &&
					targetState === PanelState.FOLDER

				if (isFromSearchResults) {
					setSearchQueryBeforeFolder(panelState.searchQuery)
				}

				// Push current state to navigation stack (for back navigation)
				// If entering folder from search results, add "Search Results" as the first breadcrumb
				if (isFromSearchResults) {
					// First push "Search Results" as virtual breadcrumb
					pushNavigation({
						id: "search-results",
						name: t?.searchResults || "Search Results",
						state: PanelState.DEFAULT,
						parentId: undefined,
					})
				}

				pushNavigation({
					id: selectedItem.id,
					name: selectedItem.name || "",
					state: panelState.currentState,
					parentId: currentParentId,
				})

				// Transition to new state
				await transitionToState(targetState, { itemId: selectedItem.id })
			} else {
				// No transition available, select the item directly
				onSelect?.(selectedItem, { reset })
			}
		},
	)

	const navigateBack = useMemoizedFn(async () => {
		if (panelState.navigationStack.length > 0) {
			// 先获取当前导航栈的信息，再决定返回逻辑
			const currentStackLength = panelState.navigationStack.length

			// 弹出当前导航项
			popNavigation()

			// 基于弹出前的栈长度决定返回逻辑
			if (currentStackLength > 1) {
				// 有上级，检查上级是否是搜索结果虚拟项
				const parentNav = panelState.navigationStack[currentStackLength - 2]

				if (parentNav.id === "search-results") {
					// 上级是搜索结果虚拟项，返回到搜索状态
					// 需要再弹出一次来移除搜索结果虚拟项
					popNavigation()

					// Check if we need to restore search state
					if (searchQueryBeforeFolder.trim()) {
						console.log(
							"[useMentionPanel] restoring search state:",
							searchQueryBeforeFolder,
						)
						await transitionToState(PanelState.DEFAULT)
						// Restore the search query after transitioning to default state
						await search(searchQueryBeforeFolder)
						// Focus search input after restoring search
						setShouldFocusSearch(true)
						// Clear the saved search query
						setSearchQueryBeforeFolder("")
					} else {
						await transitionToState(PanelState.DEFAULT)
					}
				} else {
					// 正常的文件夹上级，返回到上级文件夹
					await transitionToState(PanelState.FOLDER, { itemId: parentNav.id })
				}
			} else {
				// 只有一级，返回到默认状态
				// Check if we need to restore search state
				if (searchQueryBeforeFolder.trim()) {
					// 如果之前有搜索查询，需要恢复搜索状态
					console.log(
						"[useMentionPanel] restoring search state:",
						searchQueryBeforeFolder,
					)
					await transitionToState(PanelState.DEFAULT)
					// Restore the search query after transitioning to default state
					await search(searchQueryBeforeFolder)
					// Focus search input after restoring search
					setShouldFocusSearch(true)
					// Clear the saved search query
					setSearchQueryBeforeFolder("")
				} else {
					await transitionToState(PanelState.DEFAULT)
				}
			}
		} else if (panelState.currentState !== PanelState.DEFAULT) {
			// 没有导航栈但不在默认状态，直接返回默认状态
			await transitionToState(PanelState.DEFAULT)
		}
	})

	const enterFolder = useMemoizedFn(async () => {
		// Same as confirm selection for now
		await confirmSelection({ enterFolder: true })
	})

	const search = useMemoizedFn(async (query: string) => {
		console.log("[useMentionPanel] search called with:", {
			query,
			trimmed: query.trim(),
			currentState: panelState.currentState,
			currentQuery: panelState.searchQuery,
		})

		// Prevent unnecessary operations if query hasn't actually changed
		if (panelState.searchQuery === query) {
			console.log("[useMentionPanel] search query unchanged, skipping")
			return
		}

		if (query.trim()) {
			// Check if we're in Default state - if so, use global search
			if (panelState.currentState === PanelState.DEFAULT) {
				// Global search: search all types of content
				console.log("[useMentionPanel] performing global search for Default state")

				// Save the state before search (only if not already searching)
				if (!panelState.searchQuery) {
					setStateBeforeSearch(panelState.currentState)
				}

				setPanelState((prev) => ({
					...prev,
					searchQuery: query,
					loading: true,
					selectedIndex: findFirstSelectableIndex(prev.items),
				}))

				// Use debounced search to get global results
				await debouncedSearch(query)
			} else {
				// Context-aware search: filter items based on current panel's data
				setPanelState((prev) => {
					// If this is the first search (no previous search query), save current items as original
					const originalItems = prev.searchQuery ? prev.originalItems : prev.items
					const filteredItems = filterItemsByQuery(originalItems, query)

					return {
						...prev,
						searchQuery: query,
						items: filteredItems,
						originalItems,
						selectedIndex: findFirstSelectableIndex(filteredItems), // Reset selection to first selectable item
					}
				})

				console.log("[useMentionPanel] context-aware search completed:", {
					originalCount: panelState.originalItems.length,
					currentState: panelState.currentState,
				})
			}
		} else {
			// Clear search: restore original items for current panel
			// Cancel any pending search requests
			cleanupSearch()

			if (
				stateBeforeSearch === PanelState.DEFAULT ||
				panelState.currentState === PanelState.SEARCH
			) {
				// For Default state or when in search state (which indicates global search), reload default items
				console.log("[useMentionPanel] clearing global search, reloading default items")
				setPanelState((prev) => ({
					...prev,
					searchQuery: query,
					selectedIndex: findFirstSelectableIndex(prev.items),
				}))
				await dataSourceHook.loadDefaultItems()

				// Reset state before search
				setStateBeforeSearch(PanelState.DEFAULT)
			} else {
				// For other states, restore original items
				setPanelState((prev) => ({
					...prev,
					searchQuery: query,
					items: prev.originalItems,
					selectedIndex: findFirstSelectableIndex(prev.originalItems), // Reset selection to first selectable item
				}))

				console.log("[useMentionPanel] search cleared, restored original items:", {
					restoredCount: panelState.originalItems.length,
					currentState: panelState.currentState,
				})
			}
		}
	})

	const exit = useMemoizedFn(async () => {
		// If there's a search query, clear it first instead of closing the panel
		if (panelState.searchQuery.trim()) {
			// Clear search query and restore original items
			await search("")
		} else {
			// Close the panel
			onClose?.()
		}
	})

	const reset = useMemoizedFn(async () => {
		// Cancel any pending search requests
		cleanupSearch()

		setPanelState({
			currentState: PanelState.DEFAULT,
			selectedIndex: 0,
			searchQuery: "",
			navigationStack: [],
			items: [],
			originalItems: [],
			loading: false,
		})

		// Clear selection history
		setStateSelectionHistory({})

		// Reset state before search
		setStateBeforeSearch(PanelState.DEFAULT)

		// Clear saved search query
		setSearchQueryBeforeFolder("")

		await dataSourceHook.loadDefaultItems()
	})

	// Keyboard navigation
	useKeyboardNav({
		onSelectPrevious: selectPrevious,
		onSelectNext: selectNext,
		onConfirm: confirmSelection,
		onNavigateBack: navigateBack,
		onEnterFolder: enterFolder,
		onExit: exit,
		enabled,
		preventDefault: true,
	})

	// Computed properties
	const canNavigateBack =
		panelState.navigationStack.length > 0 || panelState.currentState !== PanelState.DEFAULT

	const canEnterFolder = (() => {
		const selectedItem = panelState.items[panelState.selectedIndex]

		if (!selectedItem) return false

		if (
			selectedItem.type === MentionItemType.TITLE ||
			selectedItem.type === MentionItemType.DIVIDER
		) {
			return false
		}

		return selectedItem?.hasChildren || false
	})()

	const hasSelection = panelState.items.length > 0

	// Function to clear focus trigger
	const clearFocusTrigger = useMemoizedFn(() => {
		setShouldFocusSearch(false)
	})

	return {
		state: panelState,
		actions: {
			selectItem,
			confirmSelection,
			navigateBack,
			navigateToBreadcrumb,
			enterFolder,
			search,
			exit,
			reset,
			deleteHistoryItem,
		},
		computed: {
			canNavigateBack,
			canEnterFolder,
			hasSelection,
		},
		dataSource: {
			...dataSourceHook,
		},
		focus: {
			shouldFocusSearch,
			clearFocusTrigger,
		},
	}
}

// Utility hook for managing panel visibility
export function usePanelVisibility(initialVisible = false) {
	const [visible, setVisible] = useState(initialVisible)

	const show = useMemoizedFn(() => setVisible(true))
	const hide = useMemoizedFn(() => setVisible(false))
	const toggle = useMemoizedFn(() => setVisible((prev) => !prev))

	return {
		visible,
		show,
		hide,
		toggle,
	}
}

// Hook for managing panel position
export function usePanelPosition(
	triggerRef: React.RefObject<HTMLElement>,
	panelRef: React.RefObject<HTMLElement>,
) {
	const [position, setPosition] = useState({ top: 0, left: 0 })

	const updatePosition = useCallback(() => {
		if (!triggerRef.current || !panelRef.current) return

		const triggerRect = triggerRef.current.getBoundingClientRect()
		const panelRect = panelRef.current.getBoundingClientRect()
		const viewportHeight = window.innerHeight
		const viewportWidth = window.innerWidth

		// Calculate optimal position
		let top = triggerRect.bottom + 8
		let left = triggerRect.left

		// Adjust if panel would go off screen
		if (top + panelRect.height > viewportHeight) {
			top = triggerRect.top - panelRect.height - 8
		}

		if (left + panelRect.width > viewportWidth) {
			left = viewportWidth - panelRect.width - 16
		}

		setPosition({ top, left })
	}, [triggerRef, panelRef])

	useEffect(() => {
		updatePosition()

		// Update position on resize
		window.addEventListener("resize", updatePosition)
		return () => window.removeEventListener("resize", updatePosition)
	}, [updatePosition])

	return { position, updatePosition }
}

import { useState, useEffect, useCallback, useRef } from "react"
import { useMemoizedFn } from "ahooks"
import type { MentionStoreRequest } from "../dispatch"
import { MentionItemType, PanelState } from "../types"
import type {
	MentionPanelState,
	UseMentionPanelReturn,
	NavigationItem,
	MentionItem,
	DataService,
	MentionPanelCatalogBehavior,
	MentionPanelLoadStateOptions,
	MentionStoreRequestBuildOptions,
	StateTransition,
} from "../types"
import type { I18nTexts } from "../i18n/types"
import { useKeyboardNav } from "./useKeyboardNav"
import { useDataSource, useDebouncedSearch } from "./useDataSource"

interface UseMentionPanelProps<TCatalogId extends string = string> {
	initialState?: PanelState
	initialLoadOptions?: MentionPanelLoadStateOptions<TCatalogId>
	initialNavigationStack?: NavigationItem<TCatalogId>[]
	onSelect?: (item: MentionItem, context?: { reset?: () => void }) => void
	onClose?: () => void
	dataService?: DataService
	enabled?: boolean
	/** 为 false 时仍加载数据，但禁用键盘 Enter/方向键等（移动端多选面板需避免 Enter 直接插入） */
	keyboardShortcutsEnabled?: boolean
	t: I18nTexts // I18nTexts from the i18n system
	catalogBehavior: MentionPanelCatalogBehavior<TCatalogId>
	buildStoreRequest?: (
		options: MentionStoreRequestBuildOptions<TCatalogId>,
	) => MentionStoreRequest | null
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

		// Search in package_name (for skills)
		if (item.package_name?.toLowerCase().includes(lowercaseQuery)) {
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
				"package_name",
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

function getCurrentCatalogId<TCatalogId extends string = string>(
	navigationStack: NavigationItem<TCatalogId>[],
): TCatalogId | undefined {
	return navigationStack[navigationStack.length - 1]?.catalogId
}

/**
 * useMentionPanel - Main logic hook for MentionPanel
 *
 * @param props - Panel configuration
 * @returns Panel state and actions
 */
export function useMentionPanel<TCatalogId extends string = string>(
	props: UseMentionPanelProps<TCatalogId>,
): UseMentionPanelReturn<TCatalogId> {
	const {
		initialState = PanelState.DEFAULT,
		initialLoadOptions,
		initialNavigationStack,
		onSelect,
		onClose,
		dataService,
		enabled = true,
		keyboardShortcutsEnabled = true,
		t,
		catalogBehavior,
		buildStoreRequest,
	} = props

	// Panel state with state-specific selection history
	const [panelState, setPanelState] = useState<MentionPanelState<TCatalogId>>({
		currentState: initialState,
		selectedIndex: 0,
		searchQuery: "",
		navigationStack: initialNavigationStack ?? [],
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
	const dataSourceHook = useDataSource<TCatalogId>({
		dataService,
		initialState,
		t: t as I18nTexts,
		buildStoreRequest,
	})
	const { loadDefaultItems, loadStateItems } = dataSourceHook

	// Note: Debounced search is no longer used for context-aware search
	// We keep the reference for potential future use with global search
	const { debouncedSearch, cleanup: cleanupSearch } = useDebouncedSearch(
		dataSourceHook.searchItems,
	)

	// Update panel state when data changes
	// Note: Do NOT re-filter search results here. Items from the search pipeline
	// (dataSourceHook.items) are already correctly filtered by domain-specific
	// search plugins. Re-filtering would require duplicating all matching logic
	// and risk inconsistent field coverage (e.g., package_name, new fields).
	// Local filtering (CATALOG/FOLDER) is handled in the search action directly.
	useEffect(() => {
		setPanelState((prev) => {
			const newItems = dataSourceHook.items

			return {
				...prev,
				items: newItems,
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

	const initializePanel = useCallback(async () => {
		setStateSelectionHistory({})
		setStateBeforeSearch(initialState)
		setSearchQueryBeforeFolder("")

		setPanelState({
			currentState: initialState,
			selectedIndex: 0,
			searchQuery: "",
			navigationStack: initialNavigationStack ?? [],
			items: [],
			originalItems: [],
			loading: false,
		})

		if (
			initialState === PanelState.DEFAULT &&
			!initialLoadOptions?.catalogId &&
			!initialLoadOptions?.itemId &&
			!initialLoadOptions?.query
		) {
			await loadDefaultItems()
			return
		}

		await loadStateItems(initialState, initialLoadOptions)
	}, [initialLoadOptions, initialNavigationStack, initialState, loadDefaultItems, loadStateItems])

	useEffect(() => {
		if (!enabled) return

		dataService?.preLoadList?.()
		void initializePanel()
	}, [dataService, enabled, initializePanel])

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
	const pushNavigation = useCallback((item: NavigationItem<TCatalogId>) => {
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
			const historyItemId =
				typeof item.metadata?.historyItemId === "string"
					? item.metadata.historyItemId
					: item.id

			// Remove from store
			dataService?.removeFromHistory?.(historyItemId)

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

		if (targetNav.catalogId) {
			await transitionToState(PanelState.CATALOG, {
				catalogId: targetNav.catalogId,
				itemId: targetNav.id,
			})
			return
		}

		await transitionToState(PanelState.FOLDER, { itemId: targetNav.id })
	})

	// State transition logic with selection history preservation
	const transitionToState = useCallback(
		async (newState: PanelState, context?: MentionPanelLoadStateOptions<TCatalogId>) => {
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

				if (newState === PanelState.DEFAULT)
					console.log("[useMentionPanel] loading default items")

				await dataSourceHook.loadStateItems(newState, {
					catalogId: context?.catalogId,
					itemId: context?.itemId,
					query: context?.query,
				})

				if (newState === PanelState.DEFAULT) {
					// Focus search input when returning to default state
					setShouldFocusSearch(true)
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

			// Check if this is a history item - if so, select directly
			if (selectedItem.tags?.includes("history")) {
				onSelect?.(selectedItem, { reset })
				return
			}

			const currentCatalogId = getCurrentCatalogId(panelState.navigationStack)
			const shouldEnterFolderDirectly =
				catalogBehavior.shouldEnterFolderDirectly?.({
					currentState: panelState.currentState,
					currentCatalogId,
					selectedItem,
					enterFolder,
				}) ?? false
			const nextEnterFolder = enterFolder || shouldEnterFolderDirectly

			// unSelectable 项不能被插入；右箭头会带 enterFolder，但仅对真实文件夹应放行（否则禁用文件会落到下方 onSelect）
			const allowUnselectableForFolderNavigation =
				nextEnterFolder && selectedItem.isFolder === true

			if (selectedItem.unSelectable && !allowUnselectableForFolderNavigation) {
				return
			}

			if (
				catalogBehavior.shouldSelectItemDirectly?.({
					currentState: panelState.currentState,
					currentCatalogId,
					selectedItem,
					enterFolder: nextEnterFolder,
				})
			) {
				onSelect?.(selectedItem, { reset })
				return
			}

			const targetTransition: StateTransition<TCatalogId> | null =
				catalogBehavior.getStaticTransition?.({
					currentState: panelState.currentState,
					itemId: selectedItem.id,
				}) ??
				catalogBehavior.getDynamicTransition?.({
					currentState: panelState.currentState,
					currentCatalogId,
					selectedItem,
					enterFolder: nextEnterFolder,
				}) ??
				null

			if (targetTransition) {
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
					targetTransition.state === PanelState.FOLDER

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
					catalogId: targetTransition.catalogId,
					parentId: currentParentId,
				})

				// Transition to new state
				await transitionToState(targetTransition.state, {
					catalogId: targetTransition.catalogId,
					itemId: selectedItem.id,
				})
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
					if (parentNav.catalogId) {
						await transitionToState(PanelState.CATALOG, {
							catalogId: parentNav.catalogId,
							itemId: parentNav.id,
						})
						return
					}

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
			} else if (panelState.currentState === PanelState.FOLDER) {
				const folderNav = panelState.navigationStack[panelState.navigationStack.length - 1]
				const scopeFolderId = folderNav?.id
				if (!scopeFolderId) {
					setPanelState((prev) => {
						const originalItems = prev.searchQuery ? prev.originalItems : prev.items
						const filteredItems = filterItemsByQuery(originalItems, query)
						return {
							...prev,
							searchQuery: query,
							items: filteredItems,
							originalItems,
							selectedIndex: findFirstSelectableIndex(filteredItems),
						}
					})
					return
				}

				if (!panelState.searchQuery) {
					setStateBeforeSearch(panelState.currentState)
				}

				setPanelState((prev) => ({
					...prev,
					searchQuery: query,
					loading: true,
					selectedIndex: findFirstSelectableIndex(prev.items),
				}))

				await debouncedSearch(query, scopeFolderId)
			} else {
				// CATALOG 等：仍仅对当前列表做本地过滤
				setPanelState((prev) => {
					const originalItems = prev.searchQuery ? prev.originalItems : prev.items
					const filteredItems = filterItemsByQuery(originalItems, query)

					return {
						...prev,
						searchQuery: query,
						items: filteredItems,
						originalItems,
						selectedIndex: findFirstSelectableIndex(filteredItems),
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
			} else if (
				panelState.currentState === PanelState.FOLDER &&
				panelState.navigationStack.length > 0
			) {
				const folderId =
					panelState.navigationStack[panelState.navigationStack.length - 1].id
				setPanelState((prev) => ({
					...prev,
					searchQuery: query,
					selectedIndex: 0,
				}))
				await dataSourceHook.loadStateItems(PanelState.FOLDER, { itemId: folderId })
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
		enabled: enabled && keyboardShortcutsEnabled,
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
	triggerRef: React.RefObject<HTMLElement | null>,
	panelRef: React.RefObject<HTMLElement | null>,
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

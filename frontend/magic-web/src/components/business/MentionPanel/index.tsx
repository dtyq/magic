import {
	forwardRef,
	useEffect,
	useImperativeHandle,
	useRef,
	useCallback,
	useState,
	useMemo,
	lazy,
	Suspense,
} from "react"
import type { CSSProperties, RefObject } from "react"
import { observer } from "mobx-react-lite"
import { Virtuoso, VirtuosoGrid } from "react-virtuoso"
import type { VirtuosoGridHandle, VirtuosoHandle } from "react-virtuoso"

// Types
import type {
	MentionItem,
	MentionPanelProps,
	MentionPanelRef,
	MentionPanelSelectionAssetType,
	MentionSelectContext,
} from "./types"
import { MentionPanelViewMode, PanelState } from "./types"

// Hooks
import { useMentionPanel } from "./hooks/useMentionPanel"
import { useMentionSelectionSession } from "./hooks/useMentionSelectionSession"
import { useI18nStatic } from "./hooks/useI18n"
import { useIsMobile } from "../../../hooks/useIsMobile"
import { createDefaultConfig } from "./constants"

// Components
import MenuItem from "./components/MenuItem"
import GalleryItem from "./components/GalleryItem"
import SelectedItemsStrip from "./components/SelectedItemsStrip"
import ViewModeSwitcher from "./components/ViewModeSwitcher"
import { isMentionPanelGalleryPreviewTarget } from "./components/GalleryPreviewDialog"
import MagicIcon from "../../base/MagicIcon"
import {
	IconArrowBack,
	IconArrowNarrowLeft,
	IconArrowNarrowRight,
	IconSearch,
} from "@tabler/icons-react"
import { cn } from "@/utils/cn"
import { Button } from "@/components/shadcn-ui/button"
import { Popover, PopoverAnchor, PopoverContent } from "@/components/shadcn-ui/popover"
import { ChevronLeft, Plug, Puzzle } from "lucide-react"
import useGeistFont from "@/styles/fonts/geist"
import { MentionPanelRootProviders } from "./renderers/context"
import { resolveMentionPanelRuntime } from "./runtime/default-runtime"
import {
	canTogglePendingItem,
	getMentionItemSelectionKey,
	isRootDefaultCategoryScreen,
	isMentionFolderItem,
} from "./utils/multiSelect"
import { prepareMentionItemForPending } from "./utils/multiSelectValidation"
import {
	canAcceptPendingItem,
	getMentionPanelSelectionSummaryCounts,
} from "./utils/selectionSummary"
import { resolveMentionPanelHeight } from "./utils/panelSize"
import { MentionPanelBuiltinItemId } from "./runtime/builtin/catalog-ids"
import { createOtherProjectMentionItem } from "./utils/otherProjectMention"
import projectFilesStore from "@/stores/projectFiles"
import type { ProjectResourceSelection } from "@/pages/superMagic/components/SelectPathModal/types"

const MentionPanelMobile = lazy(() => import("./MentionPanelMobile"))
const GalleryPreviewDialog = lazy(() => import("./components/GalleryPreviewDialog"))
const OtherProjectFileMentionModal = lazy(() => import("./components/OtherProjectFileMentionModal"))

const LIST_PANEL_WIDTH = 320
const GALLERY_PANEL_WIDTH = 600
const GALLERY_PANEL_HEIGHT = 468
const GALLERY_GRID_COLUMN_COUNT = 4
const GALLERY_GRID_INCREASE_VIEWPORT_BY = {
	top: GALLERY_PANEL_HEIGHT,
	bottom: GALLERY_PANEL_HEIGHT,
}

/**
 * MentionPanel - Mention panel component with multi-state support
 *
 * @param props - Component properties
 * @returns JSX.Element
 */
const MentionPanel = observer(
	forwardRef<MentionPanelRef, MentionPanelProps>((props, ref) => {
		const {
			visible = true,
			onSelect,
			onClose,
			initialState,
			initialLoadOptions,
			initialNavigationStack,
			searchPlaceholder,
			triggerRef,
			language,
			className,
			style,
			disableKeyboardShortcuts = false,
			enableMultiSelect = true,
			multiSelectNavigationPolicy = "clear",
			selectionScopeId,
			selectionSummary,
			lockDismissToExplicitClose = false,
			canToggleMultiSelectItem,
			viewMode = MentionPanelViewMode.LIST,
			galleryOptions,
			runtime,
			dataService,
			catalogBehavior,
			buildStoreRequest,
			...restProps
		} = props

		const isMobile = useIsMobile()

		// Load Geist font
		useGeistFont()

		// Internal search state
		const [internalSearchQuery, setInternalSearchQuery] = useState("")
		const [previewItem, setPreviewItem] = useState<MentionItem | null>(null)
		const [internalViewMode, setInternalViewMode] = useState<MentionPanelViewMode>(viewMode)
		const [otherProjectModalVisible, setOtherProjectModalVisible] = useState(false)
		const searchInputRef = useRef<HTMLInputElement>(null)
		const keyboardConfirmHandlerRef = useRef<() => boolean>(() => false)
		const keyboardMetaEnterHandlerRef = useRef<() => boolean>(() => false)
		const keyboardNavigateBackHandlerRef = useRef<() => void>(() => undefined)
		const keyboardEnterFolderHandlerRef = useRef<() => boolean>(() => false)

		// Internationalization
		const t = useI18nStatic(language)
		const defaultConfig = useMemo(() => createDefaultConfig(t), [t])

		const canSwitchViewMode = viewMode === MentionPanelViewMode.GALLERY && !isMobile
		const activeViewMode = canSwitchViewMode ? internalViewMode : viewMode
		const isGalleryMode = activeViewMode === MentionPanelViewMode.GALLERY && !isMobile

		const resolvedRuntime = useMemo(
			() =>
				resolveMentionPanelRuntime({
					runtime,
					dataService,
					catalogBehavior,
					buildStoreRequest,
				}),
			[runtime, dataService, catalogBehavior, buildStoreRequest],
		)
		const handlePanelSelect = useCallback(
			(item: MentionItem, context?: MentionSelectContext) => {
				if (item.id === MentionPanelBuiltinItemId.OTHER_PROJECT_FILES) {
					setOtherProjectModalVisible(true)
					return
				}
				onSelect?.(item, context)
			},
			[onSelect],
		)

		useEffect(() => {
			setInternalViewMode(viewMode)
		}, [viewMode])

		// Main panel logic
		const { state, actions, computed, dataSource, focus } = useMentionPanel({
			initialState,
			initialLoadOptions,
			initialNavigationStack,
			onSelect: handlePanelSelect,
			onClose,
			enabled: visible && !disableKeyboardShortcuts,
			keyboardShortcutsEnabled: !isMobile,
			onKeyboardConfirm: !isMobile ? () => keyboardConfirmHandlerRef.current() : undefined,
			onKeyboardMetaEnter: !isMobile
				? () => keyboardMetaEnterHandlerRef.current()
				: undefined,
			onKeyboardNavigateBack: !isMobile
				? () => keyboardNavigateBackHandlerRef.current()
				: undefined,
			onKeyboardEnterFolder: !isMobile
				? () => keyboardEnterFolderHandlerRef.current()
				: undefined,
			keyboardNavigationMode: isGalleryMode ? "grid" : "list",
			keyboardGridColumnCount: GALLERY_GRID_COLUMN_COUNT,
			dataService: resolvedRuntime.dataService,
			t,
			catalogBehavior: resolvedRuntime.catalogBehavior,
			buildStoreRequest: resolvedRuntime.buildStoreRequest,
		})

		// Destructure focus properties to avoid ESLint dependency warnings
		const { shouldFocusSearch, clearFocusTrigger } = focus

		const canToggleBaseItem = useCallback(
			(item: MentionItem) => {
				if (!enableMultiSelect) return false
				if (!canTogglePendingItem(item)) return false
				return canToggleMultiSelectItem ? canToggleMultiSelectItem(item) : true
			},
			[canToggleMultiSelectItem, enableMultiSelect],
		)

		const navigationSignature = useMemo(
			() =>
				[
					state.currentState,
					...state.navigationStack.map(
						(item) => `${item.state}:${item.catalogId ?? ""}:${item.id}`,
					),
				].join("|"),
			[state.currentState, state.navigationStack],
		)

		const {
			multiSelectMode,
			pendingByKey,
			pendingEntries,
			submittablePendingEntries,
			enterMultiSelectMode,
			leaveMultiSelectMode,
			togglePendingForItem,
			removePendingKey,
			clearForNavigation,
			reset: resetLocalMultiSelectState,
		} = useMentionSelectionSession({
			enabled: visible && enableMultiSelect && !isMobile,
			canToggleItem: canToggleBaseItem,
			navigationStack: state.navigationStack,
			navigationKey: navigationSignature,
			navigationPolicy: multiSelectNavigationPolicy,
			scopeId: selectionScopeId,
			prepareItem: prepareMentionItemForPending,
		})

		// 多选可勾选判定：基础类型/文件夹过滤之上，再叠加容量上限。
		// 已暂存项允许取消勾选；新增项需满足「已提交 + 暂存」的 per-type / 总上限。
		const canToggleMultiSelectItemForItem = useCallback(
			(item: MentionItem) => {
				if (!canToggleBaseItem(item)) return false
				if (pendingByKey.has(getMentionItemSelectionKey(item))) return true
				return canAcceptPendingItem(item, selectionSummary, pendingByKey.values())
			},
			[canToggleBaseItem, pendingByKey, selectionSummary],
		)

		// Current references are the committed base; pending entries are session-local
		// and may have been collected from folders that are no longer visible.
		const selectionSummaryCounts = useMemo(() => {
			if (!multiSelectMode) return undefined
			return getMentionPanelSelectionSummaryCounts(selectionSummary, pendingByKey.values())
		}, [multiSelectMode, pendingByKey, selectionSummary])

		const selectionSummaryItems = useMemo(() => {
			if (!selectionSummaryCounts || !selectionSummary) return []

			const summaryDefinitions: Array<{
				type: MentionPanelSelectionAssetType
				label: string
			}> = [
				{ type: "image", label: t.selectionSummary.image },
				{ type: "video", label: t.selectionSummary.video },
				{ type: "audio", label: t.selectionSummary.audio },
			]

			return summaryDefinitions
				.map((definition) => {
					const limit = selectionSummary.limits[definition.type]
					const isActive =
						typeof limit === "number" && Number.isFinite(limit) && limit > 0
					return {
						...definition,
						limit,
						isActive,
						reached:
							isActive && selectionSummaryCounts[definition.type] >= (limit ?? 0),
					}
				})
				.filter((item) => item.isActive)
		}, [selectionSummary, selectionSummaryCounts, t.selectionSummary])
		const showSelectionSummary = Boolean(
			multiSelectMode && selectionSummary && selectionSummaryCounts,
		)
		const showSelectedItems = multiSelectMode && pendingEntries.length > 0
		const panelWidth = isGalleryMode ? GALLERY_PANEL_WIDTH : LIST_PANEL_WIDTH
		const panelHeight = resolveMentionPanelHeight({
			baseHeight: isGalleryMode ? GALLERY_PANEL_HEIGHT : defaultConfig.height,
			isGalleryMode,
			showSelectionSummary,
			showSelectedItems,
		})
		const panelSizeStyle = useMemo<CSSProperties>(
			() => ({
				width: panelWidth,
				height: panelHeight,
			}),
			[panelHeight, panelWidth],
		)

		// Auto-focus search input when panel becomes visible
		useEffect(() => {
			if (visible && !isMobile) {
				// Small delay to ensure the DOM is ready
				const timeoutId = setTimeout(() => {
					searchInputRef.current?.focus()
				}, 100)

				return () => clearTimeout(timeoutId)
			}
		}, [visible, isMobile])

		// Auto-focus search input when triggered by state changes (e.g., returning to default state)
		useEffect(() => {
			if (shouldFocusSearch && visible && !isMobile) {
				// Small delay to ensure the state update is complete
				const timeoutId = setTimeout(() => {
					searchInputRef.current?.focus()
					clearFocusTrigger()
				}, 150)

				return () => clearTimeout(timeoutId)
			}
		}, [shouldFocusSearch, visible, isMobile, clearFocusTrigger])

		// Handle internal search query changes
		const handleSearchChange = useCallback(
			(event: React.ChangeEvent<HTMLInputElement>) => {
				const newQuery = event.target.value
				setInternalSearchQuery(newQuery)
				actions.search(newQuery)
			},
			[actions],
		)

		// Handle search area click to focus input
		const handleSearchAreaClick = useCallback(() => {
			searchInputRef.current?.focus()
		}, [])

		const handleViewModeChange = useCallback((nextViewMode: MentionPanelViewMode) => {
			setInternalViewMode(nextViewMode)
			if (nextViewMode !== MentionPanelViewMode.GALLERY) setPreviewItem(null)
		}, [])

		// Clear search when panel closes
		useEffect(() => {
			if (!visible) {
				setInternalSearchQuery("")
				setPreviewItem(null)
				resetLocalMultiSelectState()
				// Mobile editor blur will set MentionPanel `visible` to false while the
				// other-project selector is open. Keep that selector mounted until it
				// closes or submits itself; do not reset `otherProjectModalVisible` here.
			}
		}, [visible, resetLocalMultiSelectState])

		// Sync internal search query with panel state search query
		// This ensures that when search is changed programmatically (e.g., when entering/exiting folders),
		// the UI search input is also updated
		useEffect(() => {
			if (state.searchQuery !== internalSearchQuery) {
				setInternalSearchQuery(state.searchQuery)
			}
		}, [state.searchQuery, internalSearchQuery])

		// Use state.items directly as history is now integrated in useMentionPanel
		const displayItems = state.items
		const panelPreviewItems = useMemo(() => {
			if (pendingEntries.length === 0) return displayItems

			const items = [...displayItems]
			const seenKeys = new Set(items.map((item) => getMentionItemSelectionKey(item)))
			for (const { item } of pendingEntries) {
				const key = getMentionItemSelectionKey(item)
				if (seenKeys.has(key)) continue
				seenKeys.add(key)
				items.push(item)
			}
			return items
		}, [displayItems, pendingEntries])

		const canUseMultiSelectInCurrentList = useMemo(() => {
			if (!enableMultiSelect) return false
			if (isRootDefaultCategoryScreen(state)) return false
			return displayItems.some((item) => canToggleMultiSelectItemForItem(item))
		}, [canToggleMultiSelectItemForItem, displayItems, enableMultiSelect, state])

		useEffect(() => {
			if (multiSelectMode && !canUseMultiSelectInCurrentList && pendingByKey.size === 0) {
				leaveMultiSelectMode()
			}
		}, [
			canUseMultiSelectInCurrentList,
			leaveMultiSelectMode,
			multiSelectMode,
			pendingByKey.size,
		])

		// Create internal ref for DOM element
		const internalRef = useRef<HTMLDivElement>(null)
		const menuListRef = useRef<HTMLDivElement>(null)
		const virtuosoRef = useRef<VirtuosoHandle>(null)
		const virtuosoGridRef = useRef<VirtuosoGridHandle>(null)

		// Auto-scroll when the selected item or the logical list changes. The list can
		// also be refreshed asynchronously while the user is scrolling; tying this
		// effect to `state.items.length` would scroll the list back to the selected
		// item (usually index 0) and overwrite the user's scroll position.
		useEffect(() => {
			if (state.selectedIndex < 0) {
				return
			}

			const element = isGalleryMode ? virtuosoGridRef.current : virtuosoRef.current
			if (!element) return

			const frame = requestAnimationFrame(() => {
				element.scrollToIndex({
					index: state.selectedIndex,
					behavior: "smooth",
					align: "center",
				})
			})

			return () => {
				cancelAnimationFrame(frame)
			}
		}, [isGalleryMode, navigationSignature, state.searchQuery, state.selectedIndex])

		const handleClosePanel = useCallback(() => {
			resetLocalMultiSelectState()
			onClose?.()
		}, [onClose, resetLocalMultiSelectState])

		const handleOtherProjectResourceSelect = useCallback(
			async (selections: ProjectResourceSelection[]) => {
				setOtherProjectModalVisible(false)
				for (let index = 0; index < selections.length; index++) {
					const isLast = index === selections.length - 1
					const result = onSelect?.(createOtherProjectMentionItem(selections[index]), {
						batch: {
							index,
							total: selections.length,
						},
						...(isLast
							? {
									reset: () => {
										resetLocalMultiSelectState()
										actions.reset()
									},
								}
							: undefined),
					})
					await Promise.resolve(result)
				}
			},
			[actions, onSelect, resetLocalMultiSelectState],
		)

		const handleConfirmMultiSelect = useCallback(async () => {
			const entries = submittablePendingEntries
			if (entries.length === 0) {
				handleClosePanel()
				return
			}

			for (let i = 0; i < entries.length; i++) {
				const { item, mcpValidated } = entries[i]
				const isLast = i === entries.length - 1
				const result = onSelect?.(item, {
					mcpValidated,
					batch: {
						index: i,
						total: entries.length,
					},
					...(isLast
						? {
								reset: () => {
									resetLocalMultiSelectState()
									actions.reset()
								},
							}
						: undefined),
				})
				await Promise.resolve(result)
			}
			resetLocalMultiSelectState()
		}, [
			actions,
			handleClosePanel,
			onSelect,
			resetLocalMultiSelectState,
			submittablePendingEntries,
		])

		const handleMultiSelectAction = useCallback(() => {
			if (!multiSelectMode) {
				if (!canUseMultiSelectInCurrentList) return false
				enterMultiSelectMode()
				return true
			}
			void handleConfirmMultiSelect()
			return true
		}, [
			canUseMultiSelectInCurrentList,
			enterMultiSelectMode,
			handleConfirmMultiSelect,
			multiSelectMode,
		])

		const canEnterFolderForItem = useCallback(
			(item: MentionItem, enterFolder = true) => {
				const currentCatalogId =
					state.navigationStack[state.navigationStack.length - 1]?.catalogId
				const shouldEnterFolderDirectly =
					resolvedRuntime.catalogBehavior.shouldEnterFolderDirectly?.({
						currentState: state.currentState,
						currentCatalogId,
						selectedItem: item,
						enterFolder,
					}) ?? false
				const nextEnterFolder = enterFolder || shouldEnterFolderDirectly
				const allowUnselectableForFolderNavigation =
					nextEnterFolder && isMentionFolderItem(item)

				if (item.unSelectable && !allowUnselectableForFolderNavigation) {
					return false
				}

				if (
					resolvedRuntime.catalogBehavior.shouldSelectItemDirectly?.({
						currentState: state.currentState,
						currentCatalogId,
						selectedItem: item,
						enterFolder: nextEnterFolder,
					})
				) {
					return false
				}

				const targetTransition =
					resolvedRuntime.catalogBehavior.getStaticTransition?.({
						currentState: state.currentState,
						itemId: item.id,
					}) ??
					resolvedRuntime.catalogBehavior.getDynamicTransition?.({
						currentState: state.currentState,
						currentCatalogId,
						selectedItem: item,
						enterFolder: nextEnterFolder,
					}) ??
					null

				return Boolean(targetTransition)
			},
			[resolvedRuntime.catalogBehavior, state.currentState, state.navigationStack],
		)

		const handleKeyboardSelectInMultiSelect = useCallback(
			({ preferEnterFolder = false }: { preferEnterFolder?: boolean } = {}) => {
				if (!multiSelectMode) return false

				const selectedItem = displayItems[state.selectedIndex]
				if (!selectedItem) return true

				const shouldEnterFolderDirectly =
					isMentionFolderItem(selectedItem) &&
					!canToggleMultiSelectItemForItem(selectedItem)
				if (
					(preferEnterFolder || shouldEnterFolderDirectly) &&
					canEnterFolderForItem(selectedItem, true)
				) {
					actions.confirmSelection({ enterFolder: true })
					return true
				}

				if (canToggleMultiSelectItemForItem(selectedItem)) {
					void togglePendingForItem(selectedItem)
					return true
				}

				return true
			},
			[
				actions,
				canEnterFolderForItem,
				canToggleMultiSelectItemForItem,
				displayItems,
				multiSelectMode,
				state.selectedIndex,
				togglePendingForItem,
			],
		)

		const handleKeyboardConfirm = useCallback(() => {
			if (!multiSelectMode) return false
			return handleKeyboardSelectInMultiSelect()
		}, [handleKeyboardSelectInMultiSelect, multiSelectMode])

		const handleKeyboardMetaEnter = useCallback(() => {
			return handleMultiSelectAction()
		}, [handleMultiSelectAction])

		const handleKeyboardNavigateBack = useCallback(() => {
			if (!multiSelectMode) return
			clearForNavigation({ exitMode: true })
		}, [clearForNavigation, multiSelectMode])

		const handleNavigateBack = useCallback(() => {
			clearForNavigation({ exitMode: true })
			actions.navigateBack()
		}, [actions, clearForNavigation])

		const handleNavigateToBreadcrumb = useCallback(
			(index: number) => {
				clearForNavigation({ exitMode: true })
				actions.navigateToBreadcrumb(index)
			},
			[actions, clearForNavigation],
		)

		const handleKeyboardEnterFolder = useCallback(() => {
			if (!multiSelectMode) return false
			return handleKeyboardSelectInMultiSelect({ preferEnterFolder: true })
		}, [handleKeyboardSelectInMultiSelect, multiSelectMode])

		keyboardConfirmHandlerRef.current = handleKeyboardConfirm
		keyboardMetaEnterHandlerRef.current = handleKeyboardMetaEnter
		keyboardNavigateBackHandlerRef.current = handleKeyboardNavigateBack
		keyboardEnterFolderHandlerRef.current = handleKeyboardEnterFolder

		// Expose methods via ref
		useImperativeHandle(
			ref,
			() => ({
				open: () => {
					// Implementation depends on your panel opening logic
					// If you have a parent component controlling visibility, you might need to call onOpen callback
				},
				close: () => {
					console.log("close")
					handleClosePanel()
				},
				search: (query: string) => {
					setInternalSearchQuery(query)
					actions.search(query)
				},
				reset: () => {
					console.log("reset")
					resetLocalMultiSelectState()
					actions.reset()
				},
				isVisible: () => visible,
				getCurrentState: () => state.currentState,
			}),
			[visible, state.currentState, actions, handleClosePanel, resetLocalMultiSelectState],
		)

		// Handle item click/confirmation
		const handleItemClick = useCallback(
			(index: number, event?: React.MouseEvent) => {
				const selectedItem = displayItems[index]
				if (!selectedItem) return

				const currentCatalogId =
					state.navigationStack[state.navigationStack.length - 1]?.catalogId

				const eventTarget = event?.target
				const isRightArrow =
					eventTarget instanceof HTMLElement
						? Boolean(eventTarget.closest("[data-right-arrow]"))
						: false
				const shouldEnterFolderDirectly =
					resolvedRuntime.catalogBehavior.shouldEnterFolderDirectly?.({
						currentState: state.currentState,
						currentCatalogId,
						selectedItem,
						enterFolder: isRightArrow,
					}) ?? false
				const enterFolder = isRightArrow || shouldEnterFolderDirectly

				// Check if item is unselectable - if so, don't handle click
				if (selectedItem.unSelectable && !enterFolder) {
					return
				}

				// Update selection index
				actions.selectItem(index)

				// A host may mark folders as navigation-only. Resolve that intent before
				// the generic multi-select toggle so a malformed capability predicate
				// cannot turn a directory into a pending mention.
				const shouldEnterFolderInMultiSelect =
					multiSelectMode &&
					isMentionFolderItem(selectedItem) &&
					!canToggleMultiSelectItemForItem(selectedItem)
				if (
					shouldEnterFolderInMultiSelect &&
					canEnterFolderForItem(selectedItem, enterFolder)
				) {
					setTimeout(() => {
						actions.confirmSelection({ enterFolder: isRightArrow })
					})
					return
				}

				if (multiSelectMode && isRightArrow && canEnterFolderForItem(selectedItem, true)) {
					setTimeout(() => {
						actions.confirmSelection({ enterFolder: true })
					})
					return
				}

				if (multiSelectMode) {
					if (isRootDefaultCategoryScreen(state)) {
						if (canEnterFolderForItem(selectedItem, false)) {
							setTimeout(() => actions.confirmSelection({ enterFolder: false }))
						}
						return
					}

					if (canToggleMultiSelectItemForItem(selectedItem)) {
						void togglePendingForItem(selectedItem)
						return
					}

					if (canEnterFolderForItem(selectedItem, false)) {
						setTimeout(() => actions.confirmSelection({ enterFolder: false }))
					}
					return
				}

				// Use normal confirmation process (history items are handled in useMentionPanel)
				setTimeout(() => {
					actions.confirmSelection({ enterFolder })
				})
			},
			[
				actions,
				canEnterFolderForItem,
				canToggleMultiSelectItemForItem,
				displayItems,
				multiSelectMode,
				resolvedRuntime.catalogBehavior,
				state,
				togglePendingForItem,
			],
		)

		// Handle delete history item
		const handleDeleteHistoryItem = useCallback(
			async (item: MentionItem) => {
				await actions.deleteHistoryItem(item)
			},
			[actions],
		)

		// Find the last history item index
		const lastHistoryIndex = useMemo(() => {
			let lastIndex = -1
			for (let i = displayItems.length - 1; i >= 0; i--) {
				if (displayItems[i].tags?.includes("history")) {
					lastIndex = i
					break
				}
			}
			return lastIndex
		}, [displayItems])

		const multiSelectModifierKeyLabel = useMemo(() => {
			if (
				typeof navigator !== "undefined" &&
				/Mac|iPhone|iPad|iPod/.test(navigator.platform)
			) {
				return "⌘"
			}
			return "Ctrl"
		}, [])

		// Virtual list item renderer
		const renderItem = useCallback(
			(index: number) => {
				const item = displayItems[index]
				if (!item) return null

				// Check if this is a history item
				const isHistoryItem = item.tags?.includes("history")
				const key = getMentionItemSelectionKey(item)
				const showCheckbox =
					multiSelectMode &&
					canToggleMultiSelectItemForItem(item) &&
					!isRootDefaultCategoryScreen(state)

				return (
					<MenuItem
						key={`${isHistoryItem ? "history-" : ""}${item.id}`}
						item={item}
						selected={index === state.selectedIndex}
						onClick={(e) => handleItemClick(index, e)}
						isSearch={Boolean(state.searchQuery.trim())}
						t={t}
						onDelete={isHistoryItem ? handleDeleteHistoryItem : undefined}
						showCheckbox={showCheckbox}
						checkboxChecked={pendingByKey.has(key)}
					/>
				)
			},
			[
				displayItems,
				canToggleMultiSelectItemForItem,
				multiSelectMode,
				pendingByKey,
				state,
				t,
				handleDeleteHistoryItem,
				handleItemClick,
			],
		)

		const renderGalleryItem = useCallback(
			(index: number) => {
				const item = displayItems[index]
				if (!item) return null

				const key = getMentionItemSelectionKey(item)
				const showCheckbox =
					multiSelectMode &&
					canToggleMultiSelectItemForItem(item) &&
					!isRootDefaultCategoryScreen(state)

				return (
					<GalleryItem
						key={item.id}
						item={item}
						selected={index === state.selectedIndex}
						onClick={(e) => handleItemClick(index, e)}
						onPreview={setPreviewItem}
						isSearch={Boolean(state.searchQuery.trim())}
						t={t}
						showCheckbox={showCheckbox}
						checkboxChecked={pendingByKey.has(key)}
						enablePreview={galleryOptions?.enablePreviewModal}
					/>
				)
			},
			[
				canToggleMultiSelectItemForItem,
				displayItems,
				galleryOptions?.enablePreviewModal,
				handleItemClick,
				multiSelectMode,
				pendingByKey,
				state,
				t,
			],
		)

		const otherProjectFileMentionModal = otherProjectModalVisible ? (
			<Suspense fallback={null}>
				<OtherProjectFileMentionModal
					visible
					currentProject={projectFilesStore.currentSelectedProject}
					onClose={() => setOtherProjectModalVisible(false)}
					onSelect={handleOtherProjectResourceSelect}
				/>
			</Suspense>
		) : null

		// Don't render if not visible
		if (!isMobile && !visible) return null

		// Use mobile version on mobile devices
		if (isMobile) {
			return (
				<>
					<Suspense fallback={null}>
						<MentionPanelMobile
							ref={ref}
							visible={visible && !otherProjectModalVisible}
							onSelect={handlePanelSelect}
							onClose={onClose}
							initialState={initialState}
							initialLoadOptions={initialLoadOptions}
							initialNavigationStack={initialNavigationStack}
							searchPlaceholder={searchPlaceholder}
							triggerRef={triggerRef}
							language={language}
							className={className}
							lastHistoryIndex={lastHistoryIndex}
							style={style}
							runtime={resolvedRuntime}
							dataService={dataService}
							catalogBehavior={catalogBehavior}
							buildStoreRequest={buildStoreRequest}
							canToggleMultiSelectItem={canToggleMultiSelectItem}
							enableMultiSelect={enableMultiSelect}
							multiSelectNavigationPolicy={multiSelectNavigationPolicy}
							selectionScopeId={selectionScopeId}
							selectionSummary={selectionSummary}
							{...restProps}
						/>
					</Suspense>
					{otherProjectFileMentionModal}
				</>
			)
		}

		const panelClassName = cn(
			// Base styles matching Figma design
			"z-dropdown flex origin-top-left flex-col items-start overflow-hidden rounded-lg border border-solid border-border bg-popover shadow-md transition-[width,height] duration-200 ease-out will-change-[width,height]",
			className,
		)

		const currentNavigationItem = state.navigationStack[state.navigationStack.length - 1]
		const currentCatalogId = currentNavigationItem?.catalogId
		const multiSelectActions = t.multiSelectActions ?? { enter: "多选", complete: "完成" }
		const multiSelectActionLabel = multiSelectMode
			? multiSelectActions.complete
			: multiSelectActions.enter
		const showMultiSelectAction = multiSelectMode || canUseMultiSelectInCurrentList

		const stateHeader = (() => {
			if (!currentNavigationItem || state.currentState === PanelState.SEARCH) return null

			const catalogHeaderMeta = resolvedRuntime.getCatalogHeaderMeta(currentCatalogId, t)

			if (catalogHeaderMeta.icon === "mcp") {
				return (
					<div className="flex items-center gap-1 px-1.5">
						<div className="inline-flex flex-1 items-center gap-1.5 break-words pb-1.5 pl-1.5 pt-2 font-['Geist'] text-xs leading-[13px] text-foreground">
							<Plug size={16} />
							<span>{currentNavigationItem.name}</span>
						</div>
						<span className="ml-auto text-[10px] leading-[13px] text-muted-foreground">
							{catalogHeaderMeta.hint}
						</span>
					</div>
				)
			}

			if (catalogHeaderMeta.icon === "skills") {
				return (
					<div className="flex items-center gap-1 px-1.5">
						<div className="inline-flex flex-1 items-center gap-1.5 break-words pb-1.5 pl-1.5 pt-2 font-['Geist'] text-xs leading-[13px] text-foreground">
							<Puzzle size={15} />
							<span>{currentNavigationItem.name}</span>
						</div>
						<span className="ml-auto text-[10px] leading-[13px] text-muted-foreground">
							{catalogHeaderMeta.hint}
						</span>
					</div>
				)
			}

			return (
				<div className="flex min-w-0 items-center gap-1 px-1.5">
					<div className="inline min-w-0 flex-1 break-words pb-1.5 pl-1.5 pt-2 font-['Geist'] text-xs leading-[16px] text-foreground">
						{state.navigationStack.map((item, index) => (
							<span key={item.id}>
								{index > 0 && <span className="mx-0.5">/</span>}
								<span
									role={
										index < state.navigationStack.length - 1
											? "button"
											: undefined
									}
									onClick={
										index < state.navigationStack.length - 1
											? () => handleNavigateToBreadcrumb(index)
											: undefined
									}
									className={
										index < state.navigationStack.length - 1
											? "cursor-pointer"
											: undefined
									}
								>
									{item.name}
								</span>
							</span>
						))}
					</div>
				</div>
			)
		})()

		const panelBody = (
			<MentionPanelRootProviders
				dataService={resolvedRuntime.dataService}
				getItemRenderer={resolvedRuntime.getItemRenderer}
				items={panelPreviewItems}
			>
				<div className="flex w-full flex-1 flex-col overflow-hidden transition-all duration-200 ease-out">
					{/* Search header (matches Figma design) */}
					<div className="flex h-9 w-full items-start">
						{/* Back button - show when not in default state or has navigation stack */}
						{(state.currentState !== PanelState.DEFAULT ||
							state.navigationStack.length > 0) && (
							<Button
								variant="outline"
								size="icon"
								className="border-b-1 size-9 shrink-0 rounded-none border-l-0 border-t-0 border-input shadow-xs"
								onClick={handleNavigateBack}
								role="button"
								aria-label={t.ariaLabels.goBackButton}
								tabIndex={-1}
							>
								<ChevronLeft />
							</Button>
						)}

						{/* Search area */}
						<div className="flex min-w-0 flex-1 flex-col items-start gap-2">
							<div
								className={cn(
									"relative flex h-9 w-full cursor-text items-center gap-1 overflow-hidden border-b border-input bg-background px-3 py-1 shadow-xs",
									canSwitchViewMode ? "rounded-tl-lg" : "rounded-t-lg",
								)}
								onClick={handleSearchAreaClick}
								role="searchbox"
								aria-label="Search input area"
							>
								{/* Search icon */}
								<div className="flex size-6 shrink-0 items-center justify-center text-muted-foreground">
									<MagicIcon component={IconSearch} size={16} />
								</div>

								{/* Search text - show search placeholder when empty, hide when typing */}
								{!internalSearchQuery && (
									<p
										className={cn(
											"pointer-events-none min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap font-['Geist'] text-sm font-normal leading-5 text-muted-foreground",
											showMultiSelectAction && "pr-[88px]",
										)}
									>
										{t.searchPlaceholder}
									</p>
								)}

								{/* Hidden input field */}
								<input
									ref={searchInputRef}
									type="text"
									value={internalSearchQuery}
									onChange={handleSearchChange}
									className={cn(
										"absolute bottom-0 left-9 top-0 z-[1] m-0 h-full border-none bg-transparent p-0 pl-1 font-['Geist'] text-sm leading-4 text-foreground/80 outline-none placeholder:text-transparent focus:outline-none",
										showMultiSelectAction ? "right-[92px]" : "right-0",
									)}
									disabled={disableKeyboardShortcuts}
									placeholder={t.searchPlaceholder}
								/>
								{showMultiSelectAction && (
									<button
										type="button"
										className={cn(
											"absolute right-0 top-0 z-[2] flex h-full items-center gap-0.5 whitespace-nowrap border-l border-input bg-background px-2 font-['Geist'] text-[11px] leading-[14px] transition-colors hover:bg-accent",
											multiSelectMode ? "text-primary" : "text-foreground",
										)}
										onClick={(event) => {
											event.preventDefault()
											event.stopPropagation()
											handleMultiSelectAction()
										}}
										aria-label={`${multiSelectActionLabel} ${multiSelectModifierKeyLabel} Enter`}
										tabIndex={-1}
									>
										<span>{multiSelectActionLabel}</span>
										<span className="text-muted-foreground">
											({multiSelectModifierKeyLabel}↵)
										</span>
									</button>
								)}
							</div>
						</div>
						{canSwitchViewMode && (
							<ViewModeSwitcher
								isGalleryMode={isGalleryMode}
								t={t}
								onViewModeChange={handleViewModeChange}
							/>
						)}
					</div>

					{/* Search query display (when in search state) */}
					{state.searchQuery.trim() && (
						<div className="flex items-center gap-1 px-1.5">
							<div className="inline flex-1 break-words pb-1.5 pl-1.5 pt-2 font-['Geist'] text-xs leading-[16px] text-foreground">
								{t.searchResults}
							</div>
						</div>
					)}

					{/* Navigation breadcrumb / state header（搜索态仅展示「搜索结果」行，不叠面包屑） */}
					{!state.searchQuery.trim() && stateHeader}

					{/* Menu Items */}
					<div
						ref={menuListRef}
						className={cn(
							"flex min-h-0 flex-1 flex-col gap-0 overflow-hidden transition-all duration-200 ease-out",
							isGalleryMode
								? "p-2 [&_div[data-virtuoso-scroller]::-webkit-scrollbar]:hidden [&_div[data-virtuoso-scroller]]:[-ms-overflow-style:none] [&_div[data-virtuoso-scroller]]:[scrollbar-width:none]"
								: "[&_div[data-virtuoso-scroller]]:scrollbar-thin [&_div[data-virtuoso-scroller]]:scrollbar-thumb-border [&_div[data-virtuoso-scroller]]:scrollbar-track-transparent [&_div[data-virtuoso-scroller]]:scrollbar-thumb-rounded p-1 [&_div[data-virtuoso-scroller]]:mr-0.5",
						)}
						role="listbox"
					>
						{dataSource.loading ? (
							<div className="flex items-center justify-center p-5 text-xs text-muted-foreground">
								{t.loading}
							</div>
						) : dataSource.error ? (
							<div className="flex flex-col items-center justify-center p-5 text-center text-xs text-destructive">
								<div>{dataSource.error}</div>
								<Button
									onClick={dataSource.refreshData}
									aria-label={t.ariaLabels.retryButton}
									variant="outline"
									size="sm"
									className="mt-2"
								>
									{t.retry}
								</Button>
							</div>
						) : displayItems.length === 0 ? (
							<div className="flex flex-col items-center justify-center p-5 text-center text-xs text-muted-foreground">
								{t.empty}
							</div>
						) : isGalleryMode ? (
							<VirtuosoGrid
								ref={virtuosoGridRef}
								totalCount={displayItems.length}
								itemContent={renderGalleryItem}
								computeItemKey={(index) => displayItems[index]?.id ?? index}
								increaseViewportBy={GALLERY_GRID_INCREASE_VIEWPORT_BY}
								listClassName="grid auto-rows-min grid-cols-4 gap-2 pr-0.5"
								itemClassName="min-w-0"
								style={{
									height: "100%",
									width: "100%",
								}}
							/>
						) : (
							<Virtuoso
								ref={virtuosoRef}
								totalCount={displayItems.length}
								itemContent={renderItem}
								style={{
									height: "100%",
									width: "100%",
								}}
							/>
						)}
					</div>

					{showSelectionSummary && selectionSummary && selectionSummaryCounts && (
						<div
							className="mx-1 flex shrink-0 items-center justify-start gap-1 overflow-hidden whitespace-nowrap px-1.5 pb-1 font-['Geist'] text-[10px] leading-[16px] text-muted-foreground"
							data-testid="mention-panel-selection-summary"
							aria-label={t.selectionSummary.selected}
						>
							<span>
								{t.selectionSummary.selected} {pendingByKey.size}
							</span>
							{selectionSummaryItems.map(({ type, label, reached }) => (
								<span key={type} className="inline-flex items-center gap-1">
									<span aria-hidden>{" · "}</span>
									<span className={cn(reached && "text-destructive")}>
										{label} {selectionSummaryCounts[type]}/
										{selectionSummary.limits[type]}
									</span>
								</span>
							))}
						</div>
					)}

					{showSelectedItems && (
						<SelectedItemsStrip
							entries={pendingEntries}
							isGalleryMode={isGalleryMode}
							t={t}
							onRemove={removePendingKey}
						/>
					)}

					{/* Keyboard Hints */}
					<div className="mx-1 mb-1 flex flex-nowrap items-center gap-1.5 rounded bg-accent px-1.5 py-1.5">
						<div className="flex items-center gap-0.5">
							{(isGalleryMode ? ["↑", "↓", "←", "→"] : ["↓", "↑"]).map((key) => (
								<div
									key={key}
									className="flex min-h-[16px] min-w-[16px] items-center justify-center rounded border border-border bg-background font-['Geist'] text-[10px] text-secondary-foreground"
								>
									{key}
								</div>
							))}
							<span className="whitespace-nowrap font-['Geist'] text-[10px] leading-[13px] text-foreground">
								{t.keyboardHints.navigate}
							</span>
						</div>
						<div className="flex items-center gap-0.5">
							<div className="flex min-h-[16px] min-w-[16px] items-center justify-center rounded border border-border bg-background font-['Geist'] text-[10px] text-secondary-foreground">
								<MagicIcon component={IconArrowBack} size={12} />
							</div>
							<span className="whitespace-nowrap font-['Geist'] text-[10px] leading-[13px] text-foreground">
								{t.keyboardHints.confirm}
							</span>
						</div>
						{!isGalleryMode && computed.canNavigateBack && (
							<div className="flex items-center gap-0.5">
								<div className="flex min-h-[16px] min-w-[16px] items-center justify-center rounded border border-border bg-background font-['Geist'] text-[10px] text-secondary-foreground">
									<MagicIcon component={IconArrowNarrowLeft} size={12} />
								</div>
								<span className="whitespace-nowrap font-['Geist'] text-[10px] leading-[13px] text-foreground">
									{state.currentState !== PanelState.SEARCH
										? t.keyboardHints.goBack
										: t.keyboardHints.exitSearch}
								</span>
							</div>
						)}
						{!isGalleryMode && computed.canEnterFolder && (
							<div className="flex items-center gap-0.5">
								<div className="flex min-h-[16px] min-w-[16px] items-center justify-center rounded border border-border bg-background font-['Geist'] text-[10px] text-secondary-foreground">
									<MagicIcon component={IconArrowNarrowRight} size={12} />
								</div>
								<span className="whitespace-nowrap font-['Geist'] text-[10px] leading-[13px] text-foreground">
									{t.keyboardHints.goForward}
								</span>
							</div>
						)}
					</div>
				</div>
				{isGalleryMode && galleryOptions?.enablePreviewModal && previewItem && (
					<Suspense fallback={null}>
						<GalleryPreviewDialog
							item={previewItem}
							items={displayItems}
							onItemChange={setPreviewItem}
						/>
					</Suspense>
				)}
			</MentionPanelRootProviders>
		)

		// Fallback for legacy callers without triggerRef
		if (!triggerRef) {
			return (
				<>
					<div
						ref={internalRef}
						data-mention-panel
						className={cn("fixed", panelClassName)}
						style={{
							...style,
							...panelSizeStyle,
						}}
						role="dialog"
						aria-modal="true"
						aria-label={t.ariaLabels.panel}
						tabIndex={-1}
						{...restProps}
					>
						{panelBody}
					</div>
					{otherProjectFileMentionModal}
				</>
			)
		}

		const handleOpenChange = (open: boolean) => {
			if (!open) {
				if (otherProjectModalVisible) return
				handleClosePanel()
			}
		}

		const handleOpenAutoFocus = (event: Event) => {
			event.preventDefault()
			if (!disableKeyboardShortcuts) {
				requestAnimationFrame(() => {
					searchInputRef.current?.focus()
				})
			}
		}

		return (
			<>
				<Popover open={visible} onOpenChange={handleOpenChange} modal={false}>
					<PopoverAnchor virtualRef={triggerRef as unknown as RefObject<HTMLElement>} />
					<PopoverContent
						ref={internalRef}
						data-mention-panel
						className={cn(panelClassName, "p-0")}
						side="bottom"
						align="start"
						sideOffset={4}
						collisionPadding={8}
						avoidCollisions
						onOpenAutoFocus={handleOpenAutoFocus}
						onCloseAutoFocus={(event) => event.preventDefault()}
						onInteractOutside={(event) => {
							if (otherProjectModalVisible) {
								event.preventDefault()
								return
							}
							const root = internalRef.current
							const target = event.target
							if (isMentionPanelGalleryPreviewTarget(target)) {
								event.preventDefault()
								return
							}
							if (lockDismissToExplicitClose) {
								event.preventDefault()
								return
							}
							const outsideDetail = event as unknown as {
								detail?: { originalEvent?: Event }
							}
							const orig = outsideDetail.detail?.originalEvent
							const path =
								orig && typeof orig.composedPath === "function"
									? orig.composedPath()
									: []
							const pathInsideRoot =
								root && path.some((n) => n instanceof Node && root.contains(n))
							const targetInsideRoot =
								root && target instanceof Node && root.contains(target)
							if (pathInsideRoot || targetInsideRoot) {
								event.preventDefault()
								return
							}
							if (disableKeyboardShortcuts) {
								event.preventDefault()
							}
						}}
						style={{
							...style,
							...panelSizeStyle,
						}}
						role="dialog"
						aria-modal="true"
						aria-label={t.ariaLabels.panel}
						tabIndex={-1}
						{...restProps}
					>
						{panelBody}
					</PopoverContent>
				</Popover>
				{otherProjectFileMentionModal}
			</>
		)
	}),
)

export default MentionPanel

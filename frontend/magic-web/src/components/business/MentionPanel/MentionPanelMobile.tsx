import {
	forwardRef,
	useImperativeHandle,
	useRef,
	useCallback,
	useState,
	useEffect,
	useMemo,
	memo,
} from "react"
import { observer } from "mobx-react-lite"
import { Virtuoso, VirtuosoHandle } from "react-virtuoso"
import { SafeArea } from "antd-mobile"
import { Check, ChevronDown, ChevronLeft, Eraser, Search, X } from "lucide-react"

// Types
import type { MentionItem, MentionPanelProps, MentionPanelRef } from "./types"
import { MentionItemType } from "./types"

// Components
import MagicPopup from "../../base-mobile/MagicPopup"
import MobileMenuItem from "./components/MobileMenuItem"
import { cn } from "@/utils/cn"
import {
	canTogglePendingLeafItem,
	getMentionItemSelectionKey,
	inferRootEntryIdFromItem,
	isRootDefaultCategoryScreen,
} from "./utils/multiSelect"
import { prepareMentionItemForPending } from "./utils/multiSelectValidation"

// Styles
import { getMobileItemIconStyle, useMobileStyles } from "./mobileStyles"

// Hooks
import { useMentionPanel } from "./hooks/useMentionPanel"
import { useMentionSelectionSession } from "./hooks/useMentionSelectionSession"
import { useI18nStatic } from "./hooks/useI18n"
import type { I18nTexts } from "./i18n/types"
import { MentionPanelRootProviders, useMentionItemRenderer } from "./renderers/context"
import { resolveMentionPanelRuntime } from "./runtime/default-runtime"
import { MentionPanelBuiltinItemId } from "./runtime/builtin/catalog-ids"
import { MentionPanelItemType } from "./runtime/builtin/panel-item-types"

// Store
import { useMemoizedFn } from "ahooks"

type MobileSheetView = "browse" | "selected"

interface SelectedPendingListItemProps {
	item: MentionItem
	onRemove: () => void
	t: I18nTexts
}

const SelectedPendingListItem = memo(function SelectedPendingListItem({
	item,
	onRemove,
	t,
}: SelectedPendingListItemProps) {
	const { styles, cx } = useMobileStyles()
	const renderer = useMentionItemRenderer(item.type)
	const rendererContext = {
		item,
		t,
		isSearch: false,
		platform: "mobile" as const,
	}
	const iconStyle = getMobileItemIconStyle(item.type)

	return (
		<div className="flex h-12 items-center gap-2 rounded-[10px] px-3">
			<div className={cx(styles.menuItemIcon, iconStyle)} aria-hidden>
				{renderer.renderIcon?.(rendererContext)}
			</div>
			<span className="min-w-0 flex-1 truncate text-base text-foreground">{item.name}</span>
			<button
				type="button"
				className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full active:opacity-60"
				onClick={onRemove}
				aria-label={`${t.ariaLabels.removeSelectedItem}: ${item.name}`}
			>
				<X className="h-4 w-4 text-foreground" aria-hidden />
			</button>
		</div>
	)
})

SelectedPendingListItem.displayName = "SelectedPendingListItem"

/**
 * MentionPanelMobile - Mobile version of MentionPanel using MagicPopup
 *
 * 交互对齐原型 MentionSheet：多选暂存、顶部已选数量、仅右上角确认后批量写入并关闭。
 */
const MentionPanelMobile = observer(
	forwardRef<MentionPanelRef, MentionPanelProps>((props, ref) => {
		const {
			visible = false,
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
			lastHistoryIndex,
			runtime,
			dataService,
			catalogBehavior,
			buildStoreRequest,
			canToggleMultiSelectItem,
			enableMultiSelect = true,
			multiSelectNavigationPolicy = "clear",
			selectionScopeId,
			selectionSummary,
			...restProps
		} = props

		const { styles } = useMobileStyles()
		void triggerRef
		void style
		void lastHistoryIndex
		void selectionSummary

		const t = useI18nStatic(language)
		const resolvedRuntime = resolveMentionPanelRuntime({
			runtime,
			dataService,
			catalogBehavior,
			buildStoreRequest,
		})

		const { state, actions, computed, dataSource } = useMentionPanel({
			initialState,
			initialLoadOptions,
			initialNavigationStack,
			onSelect,
			onClose,
			enabled: visible,
			keyboardShortcutsEnabled: false,
			dataService: resolvedRuntime.dataService,
			t,
			catalogBehavior: resolvedRuntime.catalogBehavior,
			buildStoreRequest: resolvedRuntime.buildStoreRequest,
		})

		const virtuosoRef = useRef<VirtuosoHandle>(null)
		const searchInputRef = useRef<HTMLInputElement>(null)

		const [internalSearchQuery, setInternalSearchQuery] = useState("")
		const [mobileSheetView, setMobileSheetView] = useState<MobileSheetView>("browse")
		const isRootMobileMenu = isRootDefaultCategoryScreen(state)
		const displayItems = useMemo(() => {
			if (!isRootMobileMenu) return state.items

			const projectFilesIndex = state.items.findIndex(
				(item) => item.id === MentionPanelBuiltinItemId.PROJECT_FILES,
			)
			const existingOtherProjectItem = state.items.find(
				(item) => item.id === MentionPanelBuiltinItemId.OTHER_PROJECT_FILES,
			)
			const uploadFilesIndex = state.items.findIndex(
				(item) => item.id === MentionPanelBuiltinItemId.UPLOAD_FILES,
			)
			const expectedIndex =
				projectFilesIndex >= 0
					? projectFilesIndex + 1
					: uploadFilesIndex >= 0
						? uploadFilesIndex + 1
						: state.items.length
			if (state.items[expectedIndex] === existingOtherProjectItem) return state.items

			const nextItems = state.items.filter(
				(item) => item.id !== MentionPanelBuiltinItemId.OTHER_PROJECT_FILES,
			)
			const nextProjectFilesIndex = nextItems.findIndex(
				(item) => item.id === MentionPanelBuiltinItemId.PROJECT_FILES,
			)
			const nextUploadFilesIndex = nextItems.findIndex(
				(item) => item.id === MentionPanelBuiltinItemId.UPLOAD_FILES,
			)
			const nextInsertIndex =
				nextProjectFilesIndex >= 0
					? nextProjectFilesIndex + 1
					: nextUploadFilesIndex >= 0
						? nextUploadFilesIndex + 1
						: nextItems.length
			nextItems.splice(
				nextInsertIndex,
				0,
				existingOtherProjectItem || {
					id: MentionPanelBuiltinItemId.OTHER_PROJECT_FILES,
					type: MentionPanelItemType.OTHER_PROJECT_FILES,
					name: t.defaultItems.otherProjectFiles || "其它项目/文件",
					icon: "file-folder",
					hasChildren: false,
					isFolder: false,
				},
			)
			return nextItems
		}, [isRootMobileMenu, state.items, t.defaultItems.otherProjectFiles])

		const canTogglePendingItemForItem = useCallback(
			(item: MentionItem) => {
				if (!enableMultiSelect) return false
				if (!canTogglePendingLeafItem(item)) return false
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
			pendingByKey,
			submittablePendingEntries,
			togglePendingForItem,
			removePendingKey,
			clearPendingItems,
			clearForNavigation,
			reset: resetSelectionSession,
		} = useMentionSelectionSession({
			enabled: visible && enableMultiSelect,
			canToggleItem: canTogglePendingItemForItem,
			navigationStack: state.navigationStack,
			navigationKey: navigationSignature,
			navigationPolicy: multiSelectNavigationPolicy,
			scopeId: selectionScopeId,
			prepareItem: prepareMentionItemForPending,
		})

		const totalPending = pendingByKey.size

		const rootPendingCounts = useMemo(() => {
			const m = new Map<string, number>()
			for (const { item, sourceRootId } of Array.from(pendingByKey.values())) {
				const bucket = sourceRootId ?? inferRootEntryIdFromItem(item)
				if (!bucket) continue
				m.set(bucket, (m.get(bucket) ?? 0) + 1)
			}
			return m
		}, [pendingByKey])

		const resetLocalSelectionState = useMemoizedFn(() => {
			setMobileSheetView("browse")
			resetSelectionSession()
		})

		useEffect(() => {
			if (!visible) {
				setInternalSearchQuery("")
				resetLocalSelectionState()
			}
		}, [visible, resetLocalSelectionState])

		useEffect(() => {
			if (state.searchQuery !== internalSearchQuery) {
				setInternalSearchQuery(state.searchQuery)
			}
		}, [state.searchQuery, internalSearchQuery])

		useImperativeHandle(
			ref,
			() => ({
				open: () => undefined,
				close: () => {
					onClose?.()
				},
				search: (query: string) => {
					setInternalSearchQuery(query)
					actions.search(query)
				},
				reset: () => {
					resetLocalSelectionState()
					actions.reset()
				},
				isVisible: () => visible,
				getCurrentState: () => state.currentState,
			}),
			[visible, state.currentState, actions, onClose, resetLocalSelectionState],
		)

		// Keep root navigation and leaf selection separate; the session hook owns
		// validation, duplicate suppression, and cross-directory pending state.
		const requestPendingToggleForItem = useCallback(
			async (item: MentionItem) => {
				// Root entries only drill into their catalog; selectable rows update the pending map in place.
				if (isRootDefaultCategoryScreen(state) || !canTogglePendingItemForItem(item)) return
				await togglePendingForItem(item)
			},
			[canTogglePendingItemForItem, state, togglePendingForItem],
		)

		// Checkbox taps select the current row visually, then only toggle pending selection.
		const handleItemCheckboxClick = useCallback(
			async (index: number) => {
				const selectedItem = displayItems[index]
				if (!selectedItem) return
				const stateIndex = state.items.indexOf(selectedItem)
				if (stateIndex < 0) return

				actions.selectItem(stateIndex)
				await requestPendingToggleForItem(selectedItem)
			},
			[actions, displayItems, requestPendingToggleForItem, state.items],
		)

		const handleItemClick = useCallback(
			async (index: number, event?: React.MouseEvent) => {
				const selectedItem = displayItems[index]
				if (!selectedItem) return

				event?.stopPropagation()
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
				const isHistoryItem = selectedItem.tags?.includes("history")
				const isRootDefaultScreen = isRootDefaultCategoryScreen(state)
				const isFolderRow =
					selectedItem.type === MentionItemType.FOLDER &&
					!isHistoryItem &&
					!isRootDefaultScreen
				const enterFolder = isRightArrow || shouldEnterFolderDirectly || isFolderRow
				if (selectedItem.unSelectable && !enterFolder) return

				if (
					isRootDefaultScreen &&
					selectedItem.id === MentionPanelBuiltinItemId.OTHER_PROJECT_FILES
				) {
					onSelect?.(selectedItem)
					return
				}

				const stateIndex = state.items.indexOf(selectedItem)
				if (stateIndex < 0) return
				actions.selectItem(stateIndex)

				if (enterFolder) {
					setTimeout(() => {
						actions.confirmSelection({ enterFolder })
					}, 100)
					return
				}

				if (isHistoryItem) {
					setTimeout(() => {
						actions.confirmSelection({ enterFolder: false })
					}, 100)
					return
				}

				// Root category rows only drill down and never write to the pending selection map.
				if (isRootDefaultScreen) {
					const canDrillDown =
						Boolean(selectedItem.hasChildren || selectedItem.children?.length) &&
						!isHistoryItem
					if (canDrillDown) {
						setTimeout(() => actions.confirmSelection({ enterFolder: false }), 100)
					}
					return
				}

				if (!enableMultiSelect) {
					setTimeout(() => {
						actions.confirmSelection({ enterFolder: false })
					}, 100)
					return
				}

				if (!canTogglePendingItemForItem(selectedItem)) {
					const canDrillDown =
						Boolean(
							selectedItem.hasChildren ||
							selectedItem.children?.length ||
							selectedItem.type === MentionItemType.FOLDER,
						) && !isHistoryItem
					if (canDrillDown) {
						setTimeout(() => actions.confirmSelection({ enterFolder }), 100)
					}
					return
				}

				await requestPendingToggleForItem(selectedItem)
			},
			[
				actions,
				canTogglePendingItemForItem,
				displayItems,
				onSelect,
				requestPendingToggleForItem,
				enableMultiSelect,
				resolvedRuntime.catalogBehavior,
				state,
			],
		)

		const handleBackClick = useCallback(() => {
			if (computed.canNavigateBack) {
				clearForNavigation({ exitMode: false })
				actions.navigateBack()
			}
		}, [actions, clearForNavigation, computed.canNavigateBack])

		const handleClose = useMemoizedFn(() => {
			resetLocalSelectionState()
			onClose?.()
		})

		const handleConfirmApply = useMemoizedFn(async () => {
			const entries = submittablePendingEntries
			const items = entries.map((e) => e.item)
			if (items.length === 0) {
				handleClose()
				return
			}
			for (let i = 0; i < items.length; i++) {
				const item = items[i]
				const isLast = i === items.length - 1
				const key = getMentionItemSelectionKey(item)
				const entry = pendingByKey.get(key)
				const result = onSelect?.(item, {
					mcpValidated: entry?.mcpValidated,
					batch: {
						index: i,
						total: items.length,
					},
					...(isLast
						? {
								reset: () => {
									resetLocalSelectionState()
									actions.reset()
								},
							}
						: undefined),
				})
				await Promise.resolve(result)
			}
			resetLocalSelectionState()
		})

		const handleLeftButton = useMemoizedFn(() => {
			if (mobileSheetView === "selected") {
				setMobileSheetView("browse")
				return
			}
			if (computed.canNavigateBack) {
				handleBackClick()
				return
			}
			handleClose()
		})

		const handleRightButton = useMemoizedFn(() => {
			if (mobileSheetView === "selected") {
				clearPendingItems()
				return
			}
			void handleConfirmApply()
		})

		const handleContainerClick = useMemoizedFn((e: React.MouseEvent) => {
			e.stopPropagation()
		})

		const handleSearchInputChange = useMemoizedFn(
			(event: React.ChangeEvent<HTMLInputElement>) => {
				const newQuery = event.target.value
				setInternalSearchQuery(newQuery)
				actions.search(newQuery)
			},
		)

		const handleClearSearch = useCallback(() => {
			setInternalSearchQuery("")
			actions.search("")
		}, [actions])

		const handleSearchKeyDown = useCallback(
			(e: React.KeyboardEvent<HTMLInputElement>) => {
				if (e.key === "Enter") {
					e.preventDefault()
					actions.search(internalSearchQuery)
				}
			},
			[actions, internalSearchQuery],
		)

		const handleDeleteHistoryItem = useCallback(
			async (item: MentionItem) => {
				const key = getMentionItemSelectionKey(item)
				removePendingKey(key)
				await actions.deleteHistoryItem(item)
			},
			[actions, removePendingKey],
		)

		const renderItem = useCallback(
			(index: number) => {
				const item = displayItems[index]
				if (!item) return null

				const isHistoryItem = item.tags?.includes("history")
				const key = getMentionItemSelectionKey(item)
				const showCb =
					canTogglePendingItemForItem(item) && !isRootDefaultCategoryScreen(state)
				const rootBadge =
					isRootDefaultCategoryScreen(state) && totalPending > 0
						? (rootPendingCounts.get(item.id) ?? 0)
						: undefined

				return (
					<MobileMenuItem
						key={`${isHistoryItem ? "history-" : ""}${item.id}`}
						item={item}
						selected={false}
						onClick={(e) => handleItemClick(index, e)}
						onCheckboxClick={() => {
							void handleItemCheckboxClick(index)
						}}
						isSearch={Boolean(state.searchQuery.trim())}
						t={t}
						onDelete={isHistoryItem ? handleDeleteHistoryItem : undefined}
						showCheckbox={showCb}
						checkboxChecked={pendingByKey.has(key)}
						rootPendingBadgeCount={rootBadge}
					/>
				)
			},
			[
				displayItems,
				state,
				t,
				canTogglePendingItemForItem,
				handleDeleteHistoryItem,
				handleItemCheckboxClick,
				handleItemClick,
				pendingByKey,
				rootPendingCounts,
				totalPending,
			],
		)

		useEffect(() => {
			if (!virtuosoRef.current || state.selectedIndex < 0 || mobileSheetView === "selected") {
				return
			}

			const element = virtuosoRef.current
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
		}, [state.selectedIndex, displayItems.length, mobileSheetView])

		const leftAriaLabel = useMemo(() => {
			if (mobileSheetView === "selected") return t.ariaLabels.goBackButton
			if (computed.canNavigateBack) return t.ariaLabels.goBackButton
			return t.ariaLabels.closeButton
		}, [mobileSheetView, computed.canNavigateBack, t.ariaLabels])

		const a11yTitle = useMemo(() => {
			if (!enableMultiSelect) return searchPlaceholder || t.searchPlaceholder
			if (mobileSheetView === "selected") return t.mobileSelectedItemsTitle
			return `${t.mobileSelectedItemsLabel} (${totalPending})`
		}, [enableMultiSelect, mobileSheetView, searchPlaceholder, t, totalPending])

		const pendingEntries = useMemo(() => Array.from(pendingByKey.entries()), [pendingByKey])

		return (
			<MagicPopup
				visible={visible}
				onClose={handleClose}
				className={cn(
					"rounded-t-[14px] border-0 bg-muted shadow-[0_-4px_24px_rgba(0,0,0,0.08)]",
				)}
				bodyClassName="rounded-t-[14px] border-0 bg-muted p-0 overflow-hidden"
				handlerClassName="bg-muted-foreground mb-1.5 h-1 w-20 rounded-full"
				overlayClassName={styles.mask}
				position="bottom"
				title={a11yTitle}
				{...restProps}
			>
				<MentionPanelRootProviders
					getItemRenderer={resolvedRuntime.getItemRenderer}
					items={displayItems}
				>
					<div
						className={cn(
							"flex h-[min(768px,calc(100vh-var(--safe-area-inset-top)-var(--safe-area-inset-bottom)-44px))] min-h-0 w-full flex-col overflow-hidden bg-muted",
							className,
						)}
						onClick={handleContainerClick}
						data-mention-panel
					>
						<div className="relative z-10 flex h-14 w-full shrink-0 items-center justify-center px-16 py-2">
							<button
								type="button"
								className="absolute left-2.5 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-card"
								style={{ boxShadow: "0px 8px 25px 0px rgba(0,0,0,0.10)" }}
								onClick={handleLeftButton}
								aria-label={leftAriaLabel}
							>
								{mobileSheetView === "selected" || computed.canNavigateBack ? (
									<ChevronLeft
										className="h-[22px] w-[22px] text-foreground"
										aria-hidden
									/>
								) : (
									<X className="h-[22px] w-[22px] text-foreground" aria-hidden />
								)}
							</button>

							{!enableMultiSelect ? (
								<h2 className="max-w-[min(100%,247px)] truncate text-center text-lg font-medium leading-6 text-foreground">
									{searchPlaceholder || t.searchPlaceholder}
								</h2>
							) : mobileSheetView === "selected" ? (
								<h2 className="max-w-[min(100%,247px)] truncate text-center text-lg font-medium leading-6 text-foreground">
									{t.mobileSelectedItemsTitle}
								</h2>
							) : (
								<button
									type="button"
									onClick={() => setMobileSheetView("selected")}
									className="flex max-w-[min(100%,247px)] items-center justify-center gap-1.5 truncate text-center text-lg font-medium leading-6 text-foreground transition-opacity active:opacity-60"
									aria-label={t.ariaLabels.viewSelectedItems}
								>
									{t.mobileSelectedItemsLabel} ({totalPending})
									<ChevronDown
										className="h-5 w-5 shrink-0 text-foreground"
										aria-hidden
									/>
								</button>
							)}

							{enableMultiSelect ? (
								<button
									type="button"
									className={cn(
										"absolute right-2.5 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full",
										mobileSheetView === "selected" ? "bg-card" : "bg-primary",
									)}
									style={{ boxShadow: "0px 8px 25px 0px rgba(0,0,0,0.10)" }}
									onClick={handleRightButton}
									aria-label={
										mobileSheetView === "selected"
											? t.ariaLabels.clearAllSelected
											: t.ariaLabels.confirmButton
									}
								>
									{mobileSheetView === "selected" ? (
										<Eraser
											className="h-[22px] w-[22px] text-foreground"
											aria-hidden
										/>
									) : (
										<Check
											className="h-[22px] w-[22px] text-primary-foreground"
											strokeWidth={2.5}
											aria-hidden
										/>
									)}
								</button>
							) : null}
						</div>

						<div className="relative flex min-h-0 flex-1 flex-col overflow-hidden px-3.5 pb-1 pt-2">
							{mobileSheetView === "selected" ? (
								<div className="no-scrollbar flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto px-1 py-1">
									{pendingEntries.length === 0 ? (
										<div className={styles.empty}>{t.empty}</div>
									) : (
										pendingEntries.map(([key, entry]) => (
											<SelectedPendingListItem
												key={key}
												item={entry.item}
												onRemove={() => removePendingKey(key)}
												t={t}
											/>
										))
									)}
								</div>
							) : dataSource.loading ? (
								<div
									className={cn(
										styles.loading,
										"flex min-h-0 flex-1 items-center justify-center",
									)}
								>
									{t.loading}
								</div>
							) : dataSource.error ? (
								<div
									className={cn(
										styles.error,
										"flex min-h-0 flex-1 flex-col items-center justify-center",
									)}
								>
									<div>{dataSource.error}</div>
									<button
										type="button"
										className={styles.retryButton}
										onClick={dataSource.refreshData}
										aria-label={t.ariaLabels.retryButton}
									>
										{t.retry}
									</button>
								</div>
							) : displayItems.length === 0 ? (
								<div
									className={cn(
										styles.empty,
										"flex min-h-0 flex-1 items-center justify-center",
									)}
								>
									{t.empty}
								</div>
							) : (
								<Virtuoso
									ref={virtuosoRef}
									totalCount={displayItems.length}
									itemContent={renderItem}
									className={styles.virtuosoContainer}
									style={{
										height: "100%",
										width: "100%",
									}}
									fixedItemHeight={48}
								/>
							)}
						</div>

						{mobileSheetView === "browse" ? (
							<div className="shrink-0 px-2.5 pb-[max(var(--safe-area-inset-bottom),10px)] pt-2">
								<div className="flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2.5 shadow-sm">
									<Search
										className="h-4 w-4 shrink-0 text-muted-foreground"
										strokeWidth={2}
										aria-hidden
									/>
									<input
										ref={searchInputRef}
										type="search"
										value={internalSearchQuery}
										onChange={handleSearchInputChange}
										onKeyDown={handleSearchKeyDown}
										placeholder={searchPlaceholder || t.searchPlaceholder}
										className="min-h-0 flex-1 border-0 bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground"
										autoComplete="off"
										autoCorrect="off"
										autoCapitalize="off"
										spellCheck={false}
										enterKeyHint="search"
										aria-label={t.ariaLabels.searchInput}
									/>
									{internalSearchQuery ? (
										<button
											type="button"
											className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted-foreground text-background transition active:opacity-80"
											onClick={handleClearSearch}
											aria-label={t.clearSearch}
										>
											<X className="h-3 w-3" strokeWidth={2.5} aria-hidden />
										</button>
									) : null}
								</div>
							</div>
						) : null}

						<SafeArea position="bottom" />
					</div>
				</MentionPanelRootProviders>
			</MagicPopup>
		)
	}),
)

MentionPanelMobile.displayName = "MentionPanelMobile"

export default MentionPanelMobile

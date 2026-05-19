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
import type {
	CloudFileMentionData,
	McpMentionData,
	MentionItem,
	MentionPanelProps,
	MentionPanelRef,
	NavigationItem,
} from "./types"
import { MentionItemType, PanelState } from "./types"
import { MentionPanelBuiltinItemId as BuiltinRootId } from "./runtime/builtin/catalog-ids"

// Components
import MagicPopup from "../../base-mobile/MagicPopup"
import MobileMenuItem from "./components/MobileMenuItem"
import {
	checkMCPOAuth,
	MCPOAuthType,
} from "@/components/Agent/MCP/AgentSettings/AgentPanel/MCPPanel/helpers"
import { cn } from "@/lib/utils"
import { isSelectableBuiltinItemId } from "./runtime/builtin/default-items"

// Styles
import { getMobileItemIconStyle, useMobileStyles } from "./mobileStyles"

// Hooks
import { useMentionPanel } from "./hooks/useMentionPanel"
import { useI18nStatic } from "./hooks/useI18n"
import type { I18nTexts } from "./i18n/types"
import { MentionPanelRootProviders, useMentionItemRenderer } from "./renderers/context"
import { resolveMentionPanelRuntime } from "./runtime/default-runtime"

// Store
import { useMemoizedFn } from "ahooks"

type MobileSheetView = "browse" | "selected"

function getMentionItemSelectionKey(item: MentionItem): string {
	return `${item.type}:${item.id}`
}

function canTogglePendingItem(item: MentionItem): boolean {
	if (item.type === MentionItemType.TITLE || item.type === MentionItemType.DIVIDER) return false
	if (item.unSelectable) return false
	if (item.hasChildren || item.children?.length) return false
	return isSelectableBuiltinItemId(item.id)
}

/** 一级类目入口页：仅下钻，不展示多选、不写入暂存 */
function isRootDefaultCategoryScreen(state: {
	currentState: PanelState
	navigationStack: { length: number }
	searchQuery: string
}): boolean {
	return (
		state.currentState === PanelState.DEFAULT &&
		state.navigationStack.length === 0 &&
		!state.searchQuery.trim()
	)
}

interface PendingMentionEntry {
	item: MentionItem
	/** 归属的一级入口行 id（如 project-files），用于根列表角标 */
	sourceRootId: string | null
	mcpValidated?: boolean
}

/** 无导航栈时按条目类型归因到一级入口 */
function inferRootEntryIdFromItem(item: MentionItem): string | null {
	switch (item.type) {
		case MentionItemType.PROJECT_FILE:
			return BuiltinRootId.PROJECT_FILES
		case MentionItemType.MCP:
			return BuiltinRootId.MCP_EXTENSIONS
		case MentionItemType.AGENT:
			return BuiltinRootId.AGENTS
		case MentionItemType.SKILL:
			return BuiltinRootId.SKILLS
		case MentionItemType.TOOL:
			return BuiltinRootId.TOOLS
		case MentionItemType.UPLOAD_FILE:
			return BuiltinRootId.UPLOAD_FILES
		case MentionItemType.CLOUD_FILE: {
			const p = (item.data as CloudFileMentionData | undefined)?.cloud_provider
			if (p === "enterprise") return BuiltinRootId.ENTERPRISE_DRIVE
			if (p === "personal") return BuiltinRootId.PERSONAL_DRIVE
			return BuiltinRootId.PERSONAL_DRIVE
		}
		case MentionItemType.FOLDER:
			return BuiltinRootId.PROJECT_FILES
		default:
			return null
	}
}

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

function getPendingSourceRootId(
	navigationStack: NavigationItem[],
	item: MentionItem,
): string | null {
	if (navigationStack.length > 0) {
		const first = navigationStack[0]
		if (first.id === "search-results") {
			if (navigationStack.length > 1) {
				const second = navigationStack[1]
				return second.catalogId ?? second.id
			}
			return inferRootEntryIdFromItem(item)
		}
		return first.catalogId ?? first.id
	}
	return inferRootEntryIdFromItem(item)
}

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
			...restProps
		} = props

		const { styles } = useMobileStyles()
		void triggerRef
		void style
		void lastHistoryIndex

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
		const [pendingByKey, setPendingByKey] = useState<Map<string, PendingMentionEntry>>(
			() => new Map(),
		)

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
			setPendingByKey(new Map())
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

		const togglePendingForItem = useMemoizedFn(
			(item: MentionItem, options?: { mcpValidated?: boolean }) => {
				if (!canTogglePendingItem(item)) return
				const key = getMentionItemSelectionKey(item)
				const sourceRootId = getPendingSourceRootId(state.navigationStack, item)
				setPendingByKey((prev) => {
					const next = new Map(prev)
					if (next.has(key)) next.delete(key)
					else
						next.set(key, {
							item,
							sourceRootId,
							mcpValidated: options?.mcpValidated,
						})
					return next
				})
			},
		)

		const removePendingKey = useMemoizedFn((key: string) => {
			setPendingByKey((prev) => {
				const next = new Map(prev)
				next.delete(key)
				return next
			})
		})

		const ensureMcpItemReadyForPending = useMemoizedFn(async (item: MentionItem) => {
			if (item.type !== MentionItemType.MCP) return { canSelect: true, mcpValidated: false }

			const mcpData = item.data as McpMentionData | undefined
			if (!mcpData) return { canSelect: true, mcpValidated: false }

			const result = await checkMCPOAuth(mcpData)
			if (result === MCPOAuthType.validationFailed) {
				return { canSelect: false, mcpValidated: false }
			}

			await Promise.resolve(
				resolvedRuntime.dataService?.dispatch({
					kind: "effect",
					effect: "refresh-mcp",
				}),
			)
			return { canSelect: true, mcpValidated: true }
		})

		const handleItemClick = useCallback(
			async (index: number, event?: React.MouseEvent) => {
				const selectedItem = state.items[index]
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
				const enterFolder = isRightArrow || shouldEnterFolderDirectly
				if (selectedItem.unSelectable && !enterFolder) return

				actions.selectItem(index)

				if (enterFolder) {
					setTimeout(() => {
						actions.confirmSelection({ enterFolder })
					}, 100)
					return
				}

				if (selectedItem.tags?.includes("history")) {
					setTimeout(() => {
						actions.confirmSelection({ enterFolder: false })
					}, 100)
					return
				}

				// 第一页：类目入口，只下钻不勾选
				if (isRootDefaultCategoryScreen(state)) {
					const canDrillDown =
						Boolean(selectedItem.hasChildren || selectedItem.children?.length) &&
						!selectedItem.tags?.includes("history")
					if (canDrillDown) {
						setTimeout(() => actions.confirmSelection({ enterFolder: false }), 100)
					}
					return
				}

				if (!canTogglePendingItem(selectedItem)) {
					const canDrillDown =
						Boolean(selectedItem.hasChildren || selectedItem.children?.length) &&
						!selectedItem.tags?.includes("history")
					if (canDrillDown) {
						setTimeout(() => actions.confirmSelection({ enterFolder: false }), 100)
					}
					return
				}

				const key = getMentionItemSelectionKey(selectedItem)
				if (pendingByKey.has(key)) {
					togglePendingForItem(selectedItem)
					return
				}

				const pendingPreparation = await ensureMcpItemReadyForPending(selectedItem)
				if (!pendingPreparation.canSelect) return

				togglePendingForItem(selectedItem, {
					mcpValidated: pendingPreparation.mcpValidated,
				})
			},
			[
				actions,
				ensureMcpItemReadyForPending,
				pendingByKey,
				resolvedRuntime.catalogBehavior,
				state,
				togglePendingForItem,
			],
		)

		const handleBackClick = useCallback(() => {
			if (computed.canNavigateBack) {
				actions.navigateBack()
			}
		}, [actions, computed.canNavigateBack])

		const handleClose = useMemoizedFn(() => {
			resetLocalSelectionState()
			onClose?.()
		})

		const handleConfirmApply = useMemoizedFn(async () => {
			const items = Array.from(pendingByKey.values())
				.map((e) => e.item)
				.filter((item) => isSelectableBuiltinItemId(item.id))
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
					...(isLast ? { reset: actions.reset } : undefined),
				})
				await Promise.resolve(result)
			}
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
				setPendingByKey(new Map())
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
				const item = state.items[index]
				if (!item) return null

				const isHistoryItem = item.tags?.includes("history")
				const key = getMentionItemSelectionKey(item)
				const showCb = canTogglePendingItem(item) && !isRootDefaultCategoryScreen(state)
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
				state,
				t,
				handleDeleteHistoryItem,
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
		}, [state.selectedIndex, state.items.length, mobileSheetView])

		const leftAriaLabel = useMemo(() => {
			if (mobileSheetView === "selected") return t.ariaLabels.goBackButton
			if (computed.canNavigateBack) return t.ariaLabels.goBackButton
			return t.ariaLabels.closeButton
		}, [mobileSheetView, computed.canNavigateBack, t.ariaLabels])

		const a11yTitle = useMemo(() => {
			if (mobileSheetView === "selected") return t.mobileSelectedItemsTitle
			return `${t.mobileSelectedItemsLabel} (${totalPending})`
		}, [mobileSheetView, t, totalPending])

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
					items={state.items}
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

							{mobileSheetView === "selected" ? (
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
							) : state.items.length === 0 ? (
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
									totalCount={state.items.length}
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

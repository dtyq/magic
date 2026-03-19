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
import { observer } from "mobx-react-lite"
import { Virtuoso, VirtuosoHandle } from "react-virtuoso"

// Types
import type { MentionPanelProps, MentionPanelRef, MentionItem } from "./types"
import { PanelState } from "./types"

// Hooks
import { useMentionPanel } from "./hooks/useMentionPanel"
import { useI18nStatic } from "./hooks/useI18n"
import { useIsMobile } from "../../../hooks/useIsMobile"
import { createDefaultConfig } from "./constants"

// Components
import MenuItem from "./components/MenuItem"
import MagicIcon from "../../base/MagicIcon"
import {
	IconArrowBack,
	IconArrowNarrowDown,
	IconArrowNarrowLeft,
	IconArrowNarrowRight,
	IconSearch,
} from "@tabler/icons-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/shadcn-ui/button"
import { Popover, PopoverAnchor, PopoverContent } from "@/components/shadcn-ui/popover"
import { ChevronLeft, Plug, Puzzle } from "lucide-react"
import useGeistFont from "@/styles/fonts/geist"
import PlugIcon from "./components/icons/PlugIcon"
import SkillIcon from "./components/icons/SkillIcon"

const MentionPanelMobile = lazy(() => import("./MentionPanelMobile"))

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
			searchPlaceholder,
			triggerRef,
			language,
			className,
			style,
			disableKeyboardShortcuts = false,
			dataService,
			...restProps
		} = props

		const isMobile = useIsMobile()

		// Load Geist font
		useGeistFont()

		// Internal search state
		const [internalSearchQuery, setInternalSearchQuery] = useState("")
		const searchInputRef = useRef<HTMLInputElement>(null)

		// Internationalization
		const t = useI18nStatic(language)
		const defaultConfig = useMemo(() => createDefaultConfig(t), [t])

		// Main panel logic
		const { state, actions, computed, dataSource, focus } = useMentionPanel({
			initialState,
			onSelect,
			onClose,
			enabled: visible && !disableKeyboardShortcuts,
			dataService,
			t,
		})

		// Destructure focus properties to avoid ESLint dependency warnings
		const { shouldFocusSearch, clearFocusTrigger } = focus

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

		// Clear search when panel closes
		useEffect(() => {
			if (!visible) {
				setInternalSearchQuery("")
			}
		}, [visible])

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

		// Create internal ref for DOM element
		const internalRef = useRef<HTMLDivElement>(null)
		const menuListRef = useRef<HTMLDivElement>(null)
		const virtuosoRef = useRef<VirtuosoHandle>(null)

		const menuListStyle = useMemo(() => {
			const searchHeaderHeight = defaultConfig.headerHeight
			const keyboardHintsHeight = 36
			const breadcrumbHeight = 16
			const panelPadding = 4
			const reservedHeight =
				searchHeaderHeight + keyboardHintsHeight + breadcrumbHeight + panelPadding

			return {
				height: Math.max(defaultConfig.height - reservedHeight, 160),
			}
		}, [defaultConfig])

		// Auto-scroll to selected item when selectedIndex changes
		useEffect(() => {
			if (!virtuosoRef.current || state.selectedIndex < 0) {
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
		}, [state.selectedIndex, state.items.length])

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
					onClose?.()
				},
				search: (query: string) => {
					setInternalSearchQuery(query)
					actions.search(query)
				},
				reset: () => {
					console.log("reset")
					actions.reset()
				},
				isVisible: () => visible,
				getCurrentState: () => state.currentState,
			}),
			[visible, state.currentState, actions, onClose],
		)

		// Handle item click/confirmation
		const handleItemClick = useCallback(
			(index: number, event?: React.MouseEvent) => {
				const selectedItem = displayItems[index]
				if (!selectedItem) return

				// Check if item is unselectable - if so, don't handle click
				if (selectedItem.unSelectable) {
					return
				}

				const isRightArrow = (event?.target as HTMLElement)?.getAttribute(
					"data-right-arrow",
				)

				// Update selection index
				actions.selectItem(index)

				// Use normal confirmation process (history items are handled in useMentionPanel)
				setTimeout(() => {
					actions.confirmSelection({ enterFolder: isRightArrow ? true : false })
				})
			},
			[actions, displayItems],
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

		// Virtual list item renderer
		const renderItem = useCallback(
			(index: number) => {
				const item = displayItems[index]
				if (!item) return null

				// Check if this is a history item
				const isHistoryItem = item.tags?.includes("history")

				return (
					<MenuItem
						key={`${isHistoryItem ? "history-" : ""}${item.id}`}
						item={item}
						selected={index === state.selectedIndex}
						onClick={(e) => handleItemClick(index, e)}
						isSearch={
							state.currentState === PanelState.DEFAULT && Boolean(state.searchQuery)
						}
						t={t}
						onDelete={isHistoryItem ? handleDeleteHistoryItem : undefined}
					/>
				)
			},
			[
				displayItems,
				state.selectedIndex,
				state.currentState,
				state.searchQuery,
				t,
				handleDeleteHistoryItem,
				handleItemClick,
			],
		)

		// Don't render if not visible
		if (!isMobile && !visible) return null

		// Use mobile version on mobile devices
		if (isMobile) {
			return (
				<Suspense fallback={null}>
					<MentionPanelMobile
						ref={ref}
						visible={visible}
						onSelect={onSelect}
						onClose={onClose}
						initialState={initialState}
						searchPlaceholder={searchPlaceholder}
						triggerRef={triggerRef}
						language={language}
						className={className}
						lastHistoryIndex={lastHistoryIndex}
						style={style}
						dataService={dataService}
						{...restProps}
					/>
				</Suspense>
			)
		}

		const panelClassName = cn(
			// Base styles matching Figma design
			"z-[9999] flex w-80 flex-col items-start overflow-hidden rounded-lg border border-solid border-border bg-popover shadow-md",
			className,
		)

		const currentNavigationItem = state.navigationStack[state.navigationStack.length - 1]

		const stateHeader = (() => {
			if (!currentNavigationItem || state.currentState === PanelState.SEARCH) return null

			if (state.currentState === PanelState.MCP) {
				return (
					<div className="flex items-center gap-1 px-1.5">
						<div className="inline-flex flex-1 items-center gap-1.5 break-words pb-1.5 pl-1.5 pt-2 font-['Geist'] text-xs leading-[13px] text-foreground">
							<Plug size={16} />
							<span>{currentNavigationItem.name}</span>
						</div>
						<span className="ml-auto text-[10px] leading-[13px] text-muted-foreground">
							{t.mcpHint}
						</span>
					</div>
				)
			}

			if (state.currentState === PanelState.SKILLS) {
				return (
					<div className="flex items-center gap-1 px-1.5">
						<div className="inline-flex flex-1 items-center gap-1.5 break-words pb-1.5 pl-1.5 pt-2 font-['Geist'] text-xs leading-[13px] text-foreground">
							<Puzzle size={15} />
							<span>{currentNavigationItem.name}</span>
						</div>
						<span className="ml-auto text-[10px] leading-[13px] text-muted-foreground">
							{t.skillHint}
						</span>
					</div>
				)
			}

			return (
				<div className="flex items-center gap-1 px-1.5">
					<div className="inline flex-1 break-words pb-1.5 pl-1.5 pt-2 font-['Geist'] text-xs leading-[13px] text-foreground">
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
											? () => actions.navigateToBreadcrumb(index)
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
								onClick={actions.navigateBack}
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
							className="relative flex h-9 w-full cursor-text items-center gap-1 overflow-hidden rounded-t-lg border-b border-input bg-background px-3 py-1 shadow-xs"
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
								<p className="pointer-events-none min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap font-['Geist'] text-sm font-normal leading-5 text-muted-foreground">
									{t.searchPlaceholder}
								</p>
							)}

							{/* Hidden input field */}
							<input
								ref={searchInputRef}
								type="text"
								value={internalSearchQuery}
								onChange={handleSearchChange}
								className="absolute bottom-0 left-9 right-0 top-0 z-[1] m-0 h-full border-none bg-transparent p-0 pl-1 font-['Geist'] text-sm leading-4 text-foreground/80 outline-none placeholder:text-transparent focus:outline-none"
								disabled={disableKeyboardShortcuts}
								placeholder={t.searchPlaceholder}
							/>
						</div>
					</div>
				</div>

				{/* Search query display (when in search state) */}
				{state.searchQuery && state.currentState === PanelState.DEFAULT && (
					<div className="flex items-center gap-1 px-1.5">
						<div className="inline flex-1 break-words pb-1.5 pl-1.5 pt-2 font-['Geist'] text-xs leading-[13px] text-foreground">
							{t.searchResults}
						</div>
					</div>
				)}

				{/* Navigation breadcrumb / state header */}
				{stateHeader}

				{/* Menu Items */}
				<div
					ref={menuListRef}
					className="[&_div[data-virtuoso-scroller]]:scrollbar-thin [&_div[data-virtuoso-scroller]]:scrollbar-thumb-border [&_div[data-virtuoso-scroller]]:scrollbar-track-transparent [&_div[data-virtuoso-scroller]]:scrollbar-thumb-rounded flex flex-1 flex-col gap-0 overflow-hidden p-1 transition-all duration-200 ease-out [&_div[data-virtuoso-scroller]]:mr-0.5"
					style={menuListStyle}
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

				{/* Keyboard Hints */}
				<div className="mx-1 mb-1 flex flex-nowrap items-center gap-2.5 rounded bg-accent px-2.5 py-1.5">
					<div className="flex items-center gap-1">
						<div className="flex min-h-[22px] min-w-[22px] items-center justify-center rounded border border-border bg-background font-['Geist'] text-[10px] text-secondary-foreground">
							↓
						</div>
						<div className="flex min-h-[22px] min-w-[22px] items-center justify-center rounded border border-border bg-background font-['Geist'] text-[10px] text-secondary-foreground">
							↑
						</div>
						<span className="whitespace-nowrap font-['Geist'] text-[10px] leading-[13px] text-foreground">
							{t.keyboardHints.navigate}
						</span>
					</div>
					<div className="flex items-center gap-1">
						<div className="flex min-h-[22px] min-w-[22px] items-center justify-center rounded border border-border bg-background font-['Geist'] text-[10px] text-secondary-foreground">
							<MagicIcon component={IconArrowBack} size={12} />
						</div>
						<span className="whitespace-nowrap font-['Geist'] text-[10px] leading-[13px] text-foreground">
							{t.keyboardHints.confirm}
						</span>
					</div>
					{computed.canNavigateBack && (
						<div className="flex items-center gap-1">
							<div className="flex min-h-[22px] min-w-[22px] items-center justify-center rounded border border-border bg-background font-['Geist'] text-[10px] text-secondary-foreground">
								<MagicIcon component={IconArrowNarrowLeft} size={12} />
							</div>
							<span className="whitespace-nowrap font-['Geist'] text-[10px] leading-[13px] text-foreground">
								{state.currentState !== PanelState.SEARCH
									? t.keyboardHints.goBack
									: t.keyboardHints.exitSearch}
							</span>
						</div>
					)}
					{computed.canEnterFolder && (
						<div className="flex items-center gap-1">
							<div className="flex min-h-[22px] min-w-[22px] items-center justify-center rounded border border-border bg-background font-['Geist'] text-[10px] text-secondary-foreground">
								<MagicIcon component={IconArrowNarrowRight} size={12} />
							</div>
							<span className="whitespace-nowrap font-['Geist'] text-[10px] leading-[13px] text-foreground">
								{t.keyboardHints.goForward}
							</span>
						</div>
					)}
				</div>
			</div>
		)

		// Fallback for legacy callers without triggerRef
		if (!triggerRef) {
			return (
				<div
					ref={internalRef}
					data-mention-panel
					className={cn("fixed", panelClassName)}
					style={{
						...style,
						height: defaultConfig.height,
					}}
					role="dialog"
					aria-modal="true"
					aria-label={t.ariaLabels.panel}
					tabIndex={-1}
					{...restProps}
				>
					{panelBody}
				</div>
			)
		}

		const handleOpenChange = (open: boolean) => {
			if (!open) {
				onClose?.()
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
			<Popover open={visible} onOpenChange={handleOpenChange} modal={false}>
				<PopoverAnchor virtualRef={triggerRef} />
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
						if (disableKeyboardShortcuts) {
							event.preventDefault()
						}
					}}
					style={{
						...style,
						height: defaultConfig.height,
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
		)
	}),
)

export default MentionPanel

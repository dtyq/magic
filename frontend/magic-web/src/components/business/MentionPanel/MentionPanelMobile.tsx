import { forwardRef, useImperativeHandle, useRef, useCallback, useState, useEffect } from "react"
import { observer } from "mobx-react-lite"
import { Virtuoso, VirtuosoHandle } from "react-virtuoso"
import { SafeArea } from "antd-mobile"

// Types
import type { MentionItem, MentionPanelProps, MentionPanelRef } from "./types"
import { PanelState } from "./types"

// Components
import MagicPopup from "../../base-mobile/MagicPopup"
import MagicIcon from "../../base/MagicIcon"
import MobileMenuItem from "./components/MobileMenuItem"
import { IconX, IconChevronLeft, IconSearch } from "@tabler/icons-react"

// Styles
import { useMobileStyles, getMobileStateTitle } from "./mobileStyles"

// Hooks
import { useMentionPanel } from "./hooks/useMentionPanel"
import { useI18nStatic } from "./hooks/useI18n"

// Store
import { useMemoizedFn } from "ahooks"

/**
 * MentionPanelMobile - Mobile version of MentionPanel using MagicPopup
 *
 * @param props - Component properties
 * @returns JSX.Element
 */
const MentionPanelMobile = observer(
	forwardRef<MentionPanelRef, MentionPanelProps>((props, ref) => {
		const {
			visible = false,
			onSelect,
			onClose,
			initialState,
			searchPlaceholder,
			triggerRef,
			language,
			className,
			style,
			lastHistoryIndex,
			dataService,
			...restProps
		} = props

		const { styles } = useMobileStyles()
		void triggerRef
		void className
		void style
		void lastHistoryIndex

		// Internationalization
		const t = useI18nStatic(language)

		// Main panel logic
		const { state, actions, computed, dataSource } = useMentionPanel({
			initialState,
			onSelect,
			onClose,
			enabled: visible,
			dataService,
			t,
		})

		// Refs
		const virtuosoRef = useRef<VirtuosoHandle>(null)
		const searchInputRef = useRef<HTMLInputElement>(null)

		// Internal search state (same as PC version)
		const [internalSearchQuery, setInternalSearchQuery] = useState("")

		// Clear search when panel closes
		useEffect(() => {
			if (!visible) {
				setInternalSearchQuery("")
			}
		}, [visible])

		// Sync internal search query with panel state search query (same as PC version)
		// This ensures that when search is changed programmatically (e.g., when entering/exiting folders),
		// the UI search input is also updated
		useEffect(() => {
			if (state.searchQuery !== internalSearchQuery) {
				setInternalSearchQuery(state.searchQuery)
			}
		}, [state.searchQuery, internalSearchQuery])

		// Expose methods via ref
		useImperativeHandle(
			ref,
			() => ({
				open: () => {
					// Will be handled by parent component
				},
				close: () => {
					onClose?.()
				},
				search: (query: string) => {
					setInternalSearchQuery(query)
					actions.search(query)
				},
				reset: () => {
					actions.reset()
				},
				isVisible: () => visible,
				getCurrentState: () => state.currentState,
			}),
			[visible, state.currentState, actions, onClose],
		)

		// Handle item click
		const handleItemClick = useCallback(
			(index: number, event?: React.MouseEvent) => {
				const selectedItem = state.items[index]
				if (!selectedItem) return

				// Prevent event bubbling to avoid triggering mask click
				event?.stopPropagation()
				actions.selectItem(index)

				const eventTarget = event?.target
				const isRightArrow =
					eventTarget instanceof HTMLElement
						? Boolean(eventTarget.closest("[data-right-arrow]"))
						: false

				setTimeout(() => {
					actions.confirmSelection({ enterFolder: isRightArrow })
				}, 100)
			},
			[actions, state.items],
		)

		// Handle back navigation
		const handleBackClick = useCallback(() => {
			if (computed.canNavigateBack) {
				actions.navigateBack()
			}
		}, [actions, computed.canNavigateBack])

		// Handle close
		const handleClose = useMemoizedFn(() => {
			onClose?.()
		})

		// Handle container click to prevent event bubbling
		const handleContainerClick = useMemoizedFn((e: React.MouseEvent) => {
			e.stopPropagation()
		})

		// Handle internal search query changes (same as PC version)
		const handleSearchInputChange = useMemoizedFn(
			(event: React.ChangeEvent<HTMLInputElement>) => {
				const newQuery = event.target.value
				setInternalSearchQuery(newQuery)
				actions.search(newQuery)
			},
		)

		// Handle clear search
		const handleClearSearch = useCallback(() => {
			setInternalSearchQuery("")
			actions.search("")
		}, [actions])

		// Handle search input key down
		const handleSearchKeyDown = useCallback(
			(e: React.KeyboardEvent<HTMLInputElement>) => {
				if (e.key === "Enter") {
					e.preventDefault()
					// Trigger immediate search on Enter
					actions.search(internalSearchQuery)
				}
			},
			[actions, internalSearchQuery],
		)

		// Get current state title
		const getStateTitle = useCallback(() => {
			if (state.currentState === PanelState.SEARCH) {
				return t.searchResults
			}
			if (state.navigationStack.length > 0) {
				const current = state.navigationStack[state.navigationStack.length - 1]

				// Check if we're in a folder entered from search results
				if (state.navigationStack.length >= 2) {
					const firstItem = state.navigationStack[0]
					if (firstItem.id === "search-results") {
						// Show breadcrumb format: "Search Results / Folder Name"
						return `${firstItem.name} / ${current.name}`
					}
				}

				return current.name
			}
			return getMobileStateTitle(state.currentState, t)
		}, [state.currentState, state.navigationStack, t])

		// Handle delete history item
		const handleDeleteHistoryItem = useCallback(
			async (item: MentionItem) => {
				await actions.deleteHistoryItem(item)
			},
			[actions],
		)

		// Virtual list item renderer
		const renderItem = useCallback(
			(index: number) => {
				const item = state.items[index]
				if (!item) return null

				const isSelected = index === state.selectedIndex

				// Check if this is a history item
				const isHistoryItem = item.tags?.includes("history")

				return (
					<MobileMenuItem
						key={`${isHistoryItem ? "history-" : ""}${item.id}`}
						item={item}
						selected={isSelected}
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
				state.items,
				state.selectedIndex,
				state.currentState,
				state.searchQuery,
				t,
				handleDeleteHistoryItem,
				handleItemClick,
			],
		)

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

		return (
			<MagicPopup
				visible={visible}
				onClose={handleClose}
				bodyClassName={styles.popupBody}
				overlayClassName={styles.mask}
				position="bottom"
				{...restProps}
			>
				<div className={styles.container} onClick={handleContainerClick} data-mention-panel>
					{/* Header */}
					<div className={styles.header}>
						{/* Left side - Back button + Title */}
						<div className={styles.headerLeft}>
							{computed.canNavigateBack && (
								<button
									className={styles.backButton}
									onClick={handleBackClick}
									aria-label={t.ariaLabels.goBackButton}
								>
									<MagicIcon component={IconChevronLeft} size={20} />
								</button>
							)}
							<h2 className={styles.headerTitle}>{getStateTitle()}</h2>
						</div>

						{/* Right side - Close button */}
						<button
							className={styles.closeButton}
							onClick={handleClose}
							aria-label={t.ariaLabels.closeButton}
						>
							<MagicIcon component={IconX} size={20} />
						</button>
					</div>

					{/* Search Input Section */}
					<div className={styles.searchSection}>
						<div className={styles.searchInputWrapper}>
							<MagicIcon
								component={IconSearch}
								size={16}
								className={styles.searchIcon}
							/>
							<input
								ref={searchInputRef}
								type="text"
								value={internalSearchQuery}
								onChange={handleSearchInputChange}
								onKeyDown={handleSearchKeyDown}
								placeholder={searchPlaceholder || t.searchPlaceholder}
								className={styles.searchInput}
								autoComplete="off"
								autoCorrect="off"
								autoCapitalize="off"
								spellCheck="false"
							/>
							{internalSearchQuery && (
								<button
									className={styles.clearButton}
									onClick={handleClearSearch}
									aria-label={t.clearSearch}
								>
									<MagicIcon component={IconX} size={12} color="#fff" />
								</button>
							)}
						</div>
					</div>

					{/* Content */}
					<div className={styles.content}>
						{/* Menu List */}
						<div className={styles.menuList}>
							{dataSource.loading ? (
								<div className={styles.loading}>{t.loading}</div>
							) : dataSource.error ? (
								<div className={styles.error}>
									<div>{dataSource.error}</div>
									<button
										className={styles.retryButton}
										onClick={dataSource.refreshData}
										aria-label={t.ariaLabels.retryButton}
									>
										{t.retry}
									</button>
								</div>
							) : state.items.length === 0 ? (
								<div className={styles.empty}>{t.empty}</div>
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
					</div>

					{/* Bottom safe area */}
					<SafeArea position="bottom" />
				</div>
			</MagicPopup>
		)
	}),
)

MentionPanelMobile.displayName = "MentionPanelMobile"

export default MentionPanelMobile

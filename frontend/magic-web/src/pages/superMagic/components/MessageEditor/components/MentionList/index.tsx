import React, { useState, useRef, useMemo, memo } from "react"
import { Popover } from "antd"
import { IconX } from "@tabler/icons-react"
import AtItem from "../AtItem"
import MagicPopup from "@/components/base-mobile/MagicPopup"
import { getMentionUniqueId } from "@/components/business/MentionPanel/tiptap-plugin/types"
import type {
	MentionListItem,
	TiptapMentionAttributes,
} from "@/components/business/MentionPanel/tiptap-plugin/types"
import type { MarkerClickScene } from "../../hooks/useMarkerClickHandler"
import { useMemoizedFn, useDebounceFn, useMount, useUnmount, useUpdateEffect } from "ahooks"
import { useIsMobile } from "@/hooks/useIsMobile"
import { cn } from "@/utils/cn"
import type { JSONContent } from "@/infrastructure/editors/tiptap/core"
import { useTranslation } from "react-i18next"
import type { ProjectFilesStore } from "@/stores/projectFiles"
import { ScrollArea } from "@/components/shadcn-ui/scroll-area"

// Space between mention chips.
const GAP = 4
const MOBILE_POPUP_ICON_SIZE = 24

// Maximum number of visible rows.
const MAX_ROWS = 2

interface MentionListProps {
	/** Selected mention items. */
	mentionItems: MentionListItem[]
	/** Icon size. */
	iconSize?: number
	/** Called when a mention is removed. */
	onRemoveItems?: (mentionAttrs: TiptapMentionAttributes) => void
	/** Optional leading element. */
	prevEl?: React.ReactElement | null
	onFileClick?: (fileItem: TiptapMentionAttributes["data"]) => void
	/** Retries a failed file upload. */
	onRetry?: (id: string) => Promise<void>
	/** Marker click context used to choose its action. */
	markerClickScene?: MarkerClickScene
	/** Message content used to resolve complete marker data. */
	messageContent?: JSONContent | string | Record<string, unknown>
	/** Message-scoped file store; defaults to the global store. */
	projectFilesStore?: ProjectFilesStore
}

/**
 * MentionList renders selected mentions.
 * Show the leading control and selected mention chips.
 * Measure wrapped chips to show at most two rows, with overflow in a popover.
 */
const MentionList = ({
	mentionItems,
	iconSize,
	onRemoveItems,
	prevEl,
	onFileClick,
	onRetry,
	markerClickScene = "messageEditorMentionList",
	messageContent,
	projectFilesStore,
}: MentionListProps) => {
	// Default marker clicks to the message editor context.
	const scene = markerClickScene
	const { t } = useTranslation("super")
	const isMobile = useIsMobile()
	const containerRef = useRef<HTMLDivElement>(null)
	const [maxVisible, setMaxVisible] = useState(Infinity)
	const isCalculatingRef = useRef(false)
	const [popoverOpen, setPopoverOpen] = useState(false)
	const mobilePopupCloseLabel = t("messageEditor.mentionList.close")

	const hiddenItems = useMemo(() => mentionItems.slice(maxVisible), [mentionItems, maxVisible])
	const mobilePopupTitle = t("messageEditor.mentionList.remainingTitle", {
		count: hiddenItems.length,
	})

	const shouldShowMore = hiddenItems.length > 0

	const calculateMaxVisible = useMemoizedFn(() => {
		// Avoid reentrant measurements.
		if (isCalculatingRef.current) {
			return
		}

		if (!containerRef.current || mentionItems.length === 0) {
			setMaxVisible(Infinity)
			return
		}

		isCalculatingRef.current = true

		const { mutationObserver } = observersRef.current
		let itemWrappers: HTMLElement[] = []

		try {
			const container = containerRef.current
			const containerWidth = container.clientWidth

			// Disconnect while changing display to avoid an observer feedback loop.
			if (mutationObserver) {
				mutationObserver.disconnect()
			}

			// Inspect mention wrappers, excluding the leading element and more button.
			const allChildren = Array.from(container.children) as HTMLElement[]
			// Only measure wrappers carrying data-mention-item.
			itemWrappers = allChildren.filter(
				(el) => el.getAttribute("data-mention-item") !== null,
			) as HTMLElement[]
			if (itemWrappers.length === 0) {
				setMaxVisible(Infinity)
				return
			}

			// Temporarily reveal items for measurement, preserving their display values.
			const originalDisplays: string[] = []
			itemWrappers.forEach((wrapper) => {
				originalDisplays.push(wrapper.style.display || "")
				wrapper.style.display = ""
			})

			// Measure the AtItem inside each wrapper.
			const itemElements = itemWrappers
				.map((wrapper) => wrapper.firstElementChild as HTMLElement)
				.filter(Boolean)

			if (itemElements.length === 0) {
				// Restore the original display values.
				itemWrappers.forEach((wrapper, index) => {
					wrapper.style.display = originalDisplays[index] || ""
				})
				setMaxVisible(Infinity)
				return
			}

			// Collect chip widths and row positions.
			const itemInfo: Array<{ width: number; top: number }> = []
			itemElements.forEach((el) => {
				const rect = el.getBoundingClientRect()
				itemInfo.push({
					width: rect.width, // Width excludes the gap between chips.
					top: rect.top,
				})
			})

			// Reserve the estimated 28px more button width plus its gap.
			const moreButtonWidth = 28 + GAP

			// Identify rows from measured top positions.
			let visibleCount = 0
			const rows: number[] = [] // First item index in each row.

			for (let i = 0; i < itemInfo.length; i++) {
				const currentItem = itemInfo[i]
				const isLastItem = i === itemInfo.length - 1

				// Find the row containing this chip.
				let currentRowIndex = -1
				for (let j = 0; j < rows.length; j++) {
					const rowStartIndex = rows[j]
					const rowStartTop = itemInfo[rowStartIndex].top
					// Treat nearby top positions as the same row, allowing rounding differences.
					if (Math.abs(currentItem.top - rowStartTop) < 2) {
						currentRowIndex = j
						break
					}
				}

				// Start a new row if necessary.
				if (currentRowIndex === -1) {
					// Stop once the visible row limit is reached.
					if (rows.length >= MAX_ROWS) {
						break
					}
					currentRowIndex = rows.length
					rows.push(i)
				}

				// Include chip widths and gaps in the current row width.
				let currentRowWidth = 0
				const itemsInCurrentRow = i - rows[currentRowIndex]
				if (itemsInCurrentRow > 0) {
					// Include a gap when the row already contains chips.
					for (let j = rows[currentRowIndex]; j < i; j++) {
						currentRowWidth += itemInfo[j].width
					}
					// Include the gaps between existing chips.
					currentRowWidth += itemsInCurrentRow * GAP
				}

				// Check whether this chip fits in the current row.
				// The first chip does not need a preceding gap.
				const gapBeforeCurrentItem = currentRowWidth > 0 ? GAP : 0
				const canFitInCurrentRow =
					currentRowWidth + gapBeforeCurrentItem + currentItem.width <= containerWidth

				if (!canFitInCurrentRow) {
					// Wrap when the current row already contains chips.
					if (currentRowWidth > 0) {
						// Stop once the visible row limit is reached.
						if (rows.length >= MAX_ROWS) {
							break
						}
						// Start the next row.
						rows.push(i)
						currentRowWidth = 0
					}

					// Hide a chip that cannot fit even on its own row.
					if (currentItem.width > containerWidth) {
						break
					}
				}

				// Reserve room for the more button unless this is the last chip.
				if (!isLastItem && rows.length === MAX_ROWS) {
					// Check the chip and more button together against the row width.
					// Include the row, chip and more button with their gaps.
					const totalWidthWithMoreButton =
						currentRowWidth +
						gapBeforeCurrentItem +
						currentItem.width +
						GAP +
						moreButtonWidth
					if (totalWidthWithMoreButton > containerWidth) {
						// Wrap when the current row already contains chips.
						if (currentRowWidth > 0) {
							if (rows.length >= MAX_ROWS) {
								break
							}
							rows.push(i)
							currentRowWidth = 0
						}
						// Hide a chip that cannot fit even on its own row.
						// A standalone chip must still leave room for the more button.
						if (currentItem.width + GAP + moreButtonWidth > containerWidth) {
							break
						}
					}
				}

				visibleCount++

				// Update the row width after adding this chip.
				if (currentRowWidth > 0) {
					currentRowWidth += GAP + currentItem.width
				} else {
					currentRowWidth = currentItem.width
				}
			}

			// Apply visibility based on the measured limit.
			itemWrappers.forEach((wrapper, index) => {
				const shouldBeVisible = index < visibleCount
				wrapper.style.display = shouldBeVisible ? "" : "none"
			})

			setMaxVisible(visibleCount)
		} finally {
			// Reconnect the observer even if measurement exits early.
			if (mutationObserver && containerRef.current) {
				mutationObserver.observe(containerRef.current, {
					childList: true,
					subtree: true,
					attributes: true,
					attributeFilter: ["style", "class", "data-mention-item"],
				})
			}
			// Always release the measurement guard.
			isCalculatingRef.current = false
		}
	})

	// Debounce layout measurements.
	const debouncedCalculateMaxVisible = useDebounceFn(calculateMaxVisible, {
		wait: 100,
	})

	// Retain observers for cleanup.
	const observersRef = useRef<{
		containerObserver: ResizeObserver | null
		mutationObserver: MutationObserver | null
	}>({
		containerObserver: null,
		mutationObserver: null,
	})

	// Observe layout and item changes.
	useMount(() => {
		const container = containerRef.current

		if (!container) {
			return
		}

		// Recalculate when the container resizes.
		const containerObserver = new ResizeObserver(() => {
			debouncedCalculateMaxVisible.run()
		})

		// Recalculate when chips or their styles change.
		const mutationObserver = new MutationObserver(() => {
			debouncedCalculateMaxVisible.run()
		})

		// Start observing.
		containerObserver.observe(container)
		mutationObserver.observe(container, {
			childList: true,
			subtree: true,
			attributes: true,
			attributeFilter: ["style", "class", "data-mention-item"],
		})

		// Retain the active observers.
		observersRef.current = {
			containerObserver,
			mutationObserver,
		}

		// Measure the initial layout.
		debouncedCalculateMaxVisible.run()
	})

	// Recalculate when the selected mentions change.
	useUpdateEffect(() => {
		debouncedCalculateMaxVisible.run()
	}, [mentionItems])

	// Disconnect observers on unmount.
	useUnmount(() => {
		const { containerObserver, mutationObserver } = observersRef.current
		containerObserver?.disconnect()
		mutationObserver?.disconnect()
		debouncedCalculateMaxVisible.cancel()
	})

	const _onFileClick = useMemoizedFn((item: TiptapMentionAttributes["data"]) => {
		onFileClick?.(item)
		if (isMobile) {
			setPopoverOpen(false)
		}
	})

	// Hidden items content - reuse across desktop and mobile
	const hiddenItemsContent = useMemo(() => {
		if (hiddenItems.length === 0) return null

		return (
			<ScrollArea
				className="w-[180px]"
				viewportClassName="max-h-[240px] [&>div]:!flex [&>div]:flex-col [&>div]:gap-1"
			>
				{hiddenItems.map((at, index) => (
					<AtItem
						key={`${getMentionUniqueId(at.attrs)}-${index}`}
						data={at.attrs}
						onRemove={onRemoveItems}
						className={cn("mb-0 w-full max-w-none", isMobile && "min-h-11 px-3 py-2")}
						labelClassName={isMobile ? "text-xs leading-4" : undefined}
						retryClassName={isMobile ? "text-xs leading-4" : undefined}
						placement="left"
						onFileClick={_onFileClick}
						iconSize={isMobile ? MOBILE_POPUP_ICON_SIZE : iconSize}
						markerClickScene={scene}
						tooltipProps={{
							zIndex: 1051,
						}}
						messageContent={messageContent}
						projectFilesStore={projectFilesStore}
						markerTooltipProps={{
							popoverClassName: "z-[1051]",
							parentPopoverOpen: popoverOpen,
							side: "left",
						}}
					/>
				))}
			</ScrollArea>
		)
	}, [
		hiddenItems,
		onRemoveItems,
		_onFileClick,
		iconSize,
		scene,
		popoverOpen,
		messageContent,
		isMobile,
		projectFilesStore,
	])

	const moreButton = (
		<button
			type="button"
			className={cn(
				"inline-flex h-full items-center justify-center rounded-md border border-border px-1 py-1",
				"font-medium text-foreground",
				"cursor-pointer select-none transition-all duration-200",
				"min-w-[28px] shrink-0 overflow-hidden text-ellipsis text-[10px] leading-[13px]",
				"hover:bg-muted hover:text-foreground active:scale-95",
				"moreButton",
			)}
			onClick={isMobile ? () => setPopoverOpen(true) : undefined}
			data-testid="mention-list"
		>
			+{hiddenItems.length}
		</button>
	)

	const moreContent = isMobile ? (
		<>
			{moreButton}
			<MagicPopup
				visible={popoverOpen}
				onClose={() => setPopoverOpen(false)}
				position="bottom"
				title={mobilePopupTitle}
				bodyClassName="rounded-t-xl bg-card p-0"
				zIndex={1050}
			>
				<div className="flex flex-col bg-card">
					<div className="flex items-center justify-between border-b border-border px-4 py-3">
						<p className="min-w-0 flex-1 truncate text-left text-base font-semibold leading-6 text-foreground">
							{mobilePopupTitle}
						</p>
						<button
							type="button"
							className="ml-3 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
							onClick={() => setPopoverOpen(false)}
							aria-label={mobilePopupCloseLabel}
							data-testid="set-popover-open"
						>
							<IconX size={18} />
						</button>
					</div>
					{hiddenItemsContent}
				</div>
			</MagicPopup>
		</>
	) : (
		<Popover
			content={hiddenItemsContent}
			trigger="hover"
			placement="topRight"
			arrow={false}
			open={popoverOpen}
			onOpenChange={setPopoverOpen}
			styles={{
				body: {
					padding: "6px",
				},
			}}
			zIndex={1050}
		>
			{moreButton}
		</Popover>
	)

	if (!prevEl && mentionItems.length === 0) {
		return null
	}

	return (
		<div
			ref={containerRef}
			className={cn(
				"relative flex max-h-[56px] min-h-6 w-full flex-wrap items-center overflow-hidden",
			)}
			style={{ gap: GAP }}
		>
			{prevEl ? React.cloneElement(prevEl, { id: "list-prev" }) : null}
			{mentionItems.map((at, index) => {
				const isVisible = index < maxVisible
				return (
					<div
						key={`${getMentionUniqueId(at.attrs)}-${index}`}
						style={{ display: isVisible ? undefined : "none" }}
						data-mention-item=""
					>
						<AtItem
							data={at.attrs}
							onRemove={onRemoveItems}
							placement="top"
							flag={isVisible ? "visible" : "hidden"}
							onFileClick={isVisible ? onFileClick : undefined}
							onRetry={isVisible ? onRetry : undefined}
							iconSize={iconSize}
							markerClickScene={scene}
							messageContent={messageContent}
							projectFilesStore={projectFilesStore}
						/>
					</div>
				)
			})}
			{shouldShowMore ? moreContent : null}
		</div>
	)
}

export default memo(MentionList)

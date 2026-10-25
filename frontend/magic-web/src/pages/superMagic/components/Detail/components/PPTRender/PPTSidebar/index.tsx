import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { Plus, PanelLeftClose } from "lucide-react"
import { defaultRangeExtractor, useVirtualizer } from "@tanstack/react-virtual"
import SortableSlideItem from "./SortableSlideItem"
import PPTDeckToolbar from "./PPTDeckToolbar"
import { moveSelectedToGap } from "../utils/slideSelection"
import DropIndicator from "./DropIndicator"
import type { PPTSidebarProps, SlideItem } from "./types"
import {
	getEdgeAutoScrollDelta,
	moveItemToGap,
	resolveSlideGapTarget,
	type SlideGapTarget,
} from "./utils/dragSort"
import {
	estimateDesktopSlideRowSize,
	PPT_SIDEBAR_THUMBNAIL_DIMENSIONS,
	prioritizeVirtualItems,
} from "./utils/virtualization"
import { getPPTPreviewOverscan } from "./utils/devicePerformance"
import { observer } from "mobx-react-lite"
import {
	TooltipProvider,
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/shadcn-ui/tooltip"
import { Button } from "@/components/shadcn-ui/button"
import { ScrollArea } from "@/components/shadcn-ui/scroll-area"
import { cn } from "@/utils/cn"
import { useMemoizedFn } from "ahooks"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import { usePPTStore } from "../hooks"
import { TAILWIND_Z_INDEX_CLASSES } from "../../../contents/HTML/constants/z-index"

const MOBILE_ROW_ESTIMATE = 140
const DRAG_AUTO_SCROLL_EDGE_SIZE = 56
const DRAG_AUTO_SCROLL_MAX_SPEED = 20

function PPTSidebar({
	onOpenTransitions,
	tools,
	hiddenPaths,
	onOpenFile,
	onSlideClick,
	onSortChange,
	onInsertSlide,
	onDuplicateSlide,
	onDeleteSlide,
	onRenameSlide,
	onRefreshSlide,
	onRegenerateScreenshot,
	onAddToCurrentChat,
	onAddToNewChat,
	onReplaceSlideTemplate,
	allowEdit = false,
	canReplaceTemplate = false,
	isMobile = false,
	sidebarWidth = 200,
	isCollapsed: externalIsCollapsed,
	isPreviewLoadingEnabled = true,
	onCollapsedChange,
}: PPTSidebarProps) {
	const { t } = useTranslation("super")
	const store = usePPTStore()
	// Resolve once per sidebar mount so network changes cannot resize the loading window mid-scroll.
	const [virtualOverscan] = useState(() => getPPTPreviewOverscan())

	const slides = store.slides
	const activeIndex = store.activeIndex

	// 侧边栏折叠状态（内部状态作为回退）
	const [internalIsCollapsed, setInternalIsCollapsed] = useState(false)

	// 没有幻灯片时强制展开，禁止折叠
	const hasNoSlides = slides.length === 0
	const isCollapsed = hasNoSlides
		? false
		: externalIsCollapsed !== undefined
			? externalIsCollapsed
			: internalIsCollapsed

	// Convert slides to sortable items
	const [items, setItems] = useState<SlideItem[]>(slides)
	const itemsRef = useRef(items)
	itemsRef.current = items
	const latestSlidesRef = useRef(slides)
	latestSlidesRef.current = slides
	const activeIndexRef = useRef(activeIndex)
	activeIndexRef.current = activeIndex

	const scrollContainerRef = useRef<HTMLDivElement>(null)
	const [draggedId, setDraggedId] = useState<string | null>(null)
	const draggedIdRef = useRef<string | null>(null)
	const [dropTarget, setDropTarget] = useState<SlideGapTarget | null>(null)
	const dropTargetRef = useRef<SlideGapTarget | null>(null)
	const lastPointerRef = useRef<{ clientX: number; clientY: number } | null>(null)
	const autoScrollFrameRef = useRef<number | null>(null)
	const dragStartItemIdsRef = useRef<string[]>([])
	const dragStartFileIdsRef = useRef<string[]>([])
	const dragStartSlidesRef = useRef<SlideItem[] | null>(null)
	const dragSelectionRef = useRef<ReadonlySet<string>>(new Set())

	// Store updates must not replace the local ordering while the native drag source is active.
	useEffect(() => {
		if (draggedId) return
		itemsRef.current = slides
		setItems(slides)
	}, [draggedId, slides])

	const desktopRowEstimate = useMemo(
		() => estimateDesktopSlideRowSize(sidebarWidth),
		[sidebarWidth],
	)

	const draggedIndex = useMemo(
		() => (draggedId ? items.findIndex((item) => item.id === draggedId) : -1),
		[draggedId, items],
	)

	const rangeExtractor = useCallback(
		(range: Parameters<typeof defaultRangeExtractor>[0]) => {
			const indexes = defaultRangeExtractor(range)
			if (draggedIndex < 0 || indexes.includes(draggedIndex)) return indexes

			// Native HTML drag relies on the source DOM node staying mounted while auto-scrolling.
			return [...indexes, draggedIndex].sort((a, b) => a - b)
		},
		[draggedIndex],
	)
	const getItemKey = useCallback((index: number) => items[index]?.id ?? index, [items])
	const estimateRowSize = useCallback(
		() => (isMobile ? MOBILE_ROW_ESTIMATE : desktopRowEstimate),
		[desktopRowEstimate, isMobile],
	)

	const rowVirtualizer = useVirtualizer({
		count: items.length,
		getScrollElement: () => scrollContainerRef.current,
		estimateSize: estimateRowSize,
		getItemKey,
		horizontal: isMobile,
		overscan: virtualOverscan,
		paddingStart: 8,
		paddingEnd: 8,
		gap: isMobile ? 8 : 0,
		rangeExtractor,
	})
	const virtualItems = rowVirtualizer.getVirtualItems()

	useEffect(() => {
		// Desktop rows have a deterministic size derived from sidebar width. Rebuild the fixed-size
		// layout after resizing settles so off-screen rows use the new estimate as well.
		const timer = window.setTimeout(() => {
			rowVirtualizer.measure()
			const currentActiveIndex = activeIndexRef.current
			if (isPreviewLoadingEnabled && !draggedIdRef.current && currentActiveIndex >= 0) {
				rowVirtualizer.scrollToIndex(currentActiveIndex, { align: "auto" })
			}
		}, 80)

		return () => window.clearTimeout(timer)
	}, [desktopRowEstimate, isMobile, isPreviewLoadingEnabled, rowVirtualizer])

	const visibleScreenshotKey = virtualItems
		.map(({ index }) => {
			const item = items[index]
			return item
				? `${item.id}:${item.loadingState ?? "idle"}:${item.thumbnailUrl ? "ready" : "empty"}`
				: `missing:${index}`
		})
		.join("|")

	// The virtual range is the single source of truth for thumbnail preloading.
	useEffect(() => {
		if (!isPreviewLoadingEnabled) {
			store.updateVisibleSlidePreviews([])
			return
		}

		const visibleIndices = prioritizeVirtualItems(
			rowVirtualizer.getVirtualItems(),
			rowVirtualizer.range,
		)
			.map(({ index }) => itemsRef.current[index]?.index)
			.filter((index): index is number => index !== undefined)
		store.updateVisibleSlidePreviews(visibleIndices)

		return () => store.updateVisibleSlidePreviews([])
	}, [isPreviewLoadingEnabled, rowVirtualizer, store, visibleScreenshotKey])

	useEffect(() => {
		if (!isPreviewLoadingEnabled || draggedId || hasNoSlides || activeIndex < 0) return
		rowVirtualizer.scrollToIndex(activeIndex, { align: "auto" })
	}, [activeIndex, draggedId, hasNoSlides, isMobile, isPreviewLoadingEnabled, rowVirtualizer])

	const updateDropTarget = useCallback((target: SlideGapTarget | null) => {
		const currentTarget = dropTargetRef.current
		if (
			currentTarget?.gapIndex === target?.gapIndex &&
			currentTarget?.offset === target?.offset
		) {
			return
		}

		dropTargetRef.current = target
		setDropTarget(target)
	}, [])

	const stopAutoScroll = useCallback(() => {
		if (autoScrollFrameRef.current !== null) {
			cancelAnimationFrame(autoScrollFrameRef.current)
			autoScrollFrameRef.current = null
		}
	}, [])

	const clearDragState = useCallback(() => {
		stopAutoScroll()
		draggedIdRef.current = null
		dragStartItemIdsRef.current = []
		dragStartFileIdsRef.current = []
		dragStartSlidesRef.current = null
		lastPointerRef.current = null
		setDraggedId(null)
		updateDropTarget(null)
	}, [stopAutoScroll, updateDropTarget])

	const resolvePointerDropTarget = useMemoizedFn((clientX: number, clientY: number) => {
		const viewport = scrollContainerRef.current
		if (!viewport || !draggedIdRef.current) return

		const rect = viewport.getBoundingClientRect()
		const localPointerOffset = isMobile ? clientX - rect.left : clientY - rect.top
		const viewportSize = isMobile ? rect.width : rect.height
		const clampedPointerOffset = Math.max(0, Math.min(localPointerOffset, viewportSize))
		const scrollOffset = isMobile ? viewport.scrollLeft : viewport.scrollTop
		const target = resolveSlideGapTarget(
			rowVirtualizer.getVirtualItems(),
			scrollOffset + clampedPointerOffset,
			itemsRef.current.length,
		)

		updateDropTarget(target)
	})

	const runAutoScroll = useMemoizedFn(() => {
		autoScrollFrameRef.current = null
		const viewport = scrollContainerRef.current
		const pointer = lastPointerRef.current
		if (!viewport || !pointer || !draggedIdRef.current) return

		const rect = viewport.getBoundingClientRect()
		const delta = getEdgeAutoScrollDelta({
			pointerPosition: isMobile ? pointer.clientX : pointer.clientY,
			containerStart: isMobile ? rect.left : rect.top,
			containerEnd: isMobile ? rect.right : rect.bottom,
			edgeSize: DRAG_AUTO_SCROLL_EDGE_SIZE,
			maxSpeed: DRAG_AUTO_SCROLL_MAX_SPEED,
		})

		if (delta === 0) return

		const previousOffset = isMobile ? viewport.scrollLeft : viewport.scrollTop
		if (isMobile) viewport.scrollLeft += delta
		else viewport.scrollTop += delta

		const nextOffset = isMobile ? viewport.scrollLeft : viewport.scrollTop
		if (nextOffset === previousOffset) return

		resolvePointerDropTarget(pointer.clientX, pointer.clientY)
		autoScrollFrameRef.current = requestAnimationFrame(runAutoScroll)
	})

	const handleSlideDragStart = useMemoizedFn((e: React.DragEvent, slideId: string) => {
		if (!allowEdit || tools?.busy) {
			e.preventDefault()
			return
		}
		const draggedSlide = itemsRef.current.find((slide) => slide.id === slideId)
		const fileId = draggedSlide ? store.getFileIdByPath(draggedSlide.path) : undefined
		if (tools && !fileId) {
			e.preventDefault()
			return
		}
		// Freeze file identities at drag start; later selection edits cannot change this move.
		dragSelectionRef.current = new Set(
			tools && fileId && tools.selected.has(fileId) ? tools.selected : fileId ? [fileId] : [],
		)
		draggedIdRef.current = slideId
		dragStartItemIdsRef.current = itemsRef.current.map((item) => item.id)
		dragStartFileIdsRef.current = itemsRef.current.map(
			(item) => store.getFileIdByPath(item.path) || "",
		)
		dragStartSlidesRef.current = latestSlidesRef.current
		setDraggedId(slideId)
		updateDropTarget(null)
		e.dataTransfer.effectAllowed = "copyMove"
	})

	const handleSlidesListDragOver = useMemoizedFn((e: React.DragEvent) => {
		if (!draggedIdRef.current) return

		e.preventDefault()
		e.dataTransfer.dropEffect = "move"
		lastPointerRef.current = { clientX: e.clientX, clientY: e.clientY }
		resolvePointerDropTarget(e.clientX, e.clientY)

		if (autoScrollFrameRef.current === null) {
			autoScrollFrameRef.current = requestAnimationFrame(runAutoScroll)
		}
	})

	const handleSlidesListDragLeave = useMemoizedFn((e: React.DragEvent) => {
		const nextTarget = e.relatedTarget
		if (nextTarget instanceof Node && e.currentTarget.contains(nextTarget)) return

		stopAutoScroll()
		lastPointerRef.current = null
		updateDropTarget(null)
	})

	const handleSlidesListDrop = useMemoizedFn((e: React.DragEvent) => {
		const currentDraggedId = draggedIdRef.current
		const currentDropTarget = dropTargetRef.current
		if (!currentDraggedId) return

		e.preventDefault()
		e.stopPropagation()
		if (tools?.busy) {
			clearDragState()
			return
		}
		if (!currentDropTarget) {
			clearDragState()
			return
		}

		const currentStoreSlides = latestSlidesRef.current
		const dragStartItemIds = dragStartItemIdsRef.current
		const storeStructureIsUnchanged =
			currentStoreSlides === dragStartSlidesRef.current &&
			currentStoreSlides.length === dragStartItemIds.length &&
			currentStoreSlides.every(
				(slide, index) =>
					slide.id === dragStartItemIds[index] &&
					(!tools ||
						(store.getFileIdByPath(slide.path) || "") ===
							dragStartFileIdsRef.current[index]),
			)
		if (!storeStructureIsUnchanged) {
			// Avoid overwriting a concurrent insert/delete/reorder with the frozen drag snapshot.
			itemsRef.current = currentStoreSlides
			setItems(currentStoreSlides)
			clearDragState()
			return
		}

		const currentItems = itemsRef.current
		if (tools) {
			const nextItems = moveSelectedToGap(
				currentItems,
				dragSelectionRef.current,
				(slide) => store.getFileIdByPath(slide.path) || "",
				currentDropTarget.gapIndex,
			)
			// The ordinary-deck write owner updates the list only after confirmed save.
			// Keeping the old list here also preserves it after a failed manifest write.
			if (nextItems.some((slide, index) => slide.id !== currentItems[index]?.id)) {
				void tools.reorder(nextItems.map((slide) => slide.path))
			}
			clearDragState()
			return
		}
		const nextItems = moveItemToGap(currentItems, currentDraggedId, currentDropTarget.gapIndex)
		if (nextItems !== currentItems) {
			itemsRef.current = nextItems
			setItems(nextItems)
			onSortChange?.(nextItems)
		}
		clearDragState()
	})

	// Native drops outside the sidebar still need to clear the pinned source and auto-scroll loop.
	useEffect(() => {
		const handleGlobalDragEnd = () => clearDragState()
		const handleGlobalDrop = () => window.setTimeout(clearDragState, 0)

		window.addEventListener("dragend", handleGlobalDragEnd)
		window.addEventListener("drop", handleGlobalDrop)

		return () => {
			window.removeEventListener("dragend", handleGlobalDragEnd)
			window.removeEventListener("drop", handleGlobalDrop)
			stopAutoScroll()
		}
	}, [clearDragState, stopAutoScroll])

	// Handle insert slide
	function handleInsertSlide(position: number, direction: "before" | "after") {
		if (!onInsertSlide) return
		return onInsertSlide(position, direction)
	}

	function handleDuplicateSlide(index: number) {
		if (!onDuplicateSlide) return
		return onDuplicateSlide(index)
	}

	// Handle delete slide
	function handleDeleteSlide(index: number) {
		if (!onDeleteSlide) return
		if (items.length <= 1) {
			toast.error(t("fileViewer.cannotDeleteLastSlide"))
			return
		}
		onDeleteSlide(index)
	}

	// Handle rename slide
	function handleRenameSlide(index: number, newFileName: string) {
		if (!onRenameSlide) return
		return onRenameSlide(index, newFileName)
	}

	// Handle refresh slide
	function handleRefreshSlide(index: number) {
		if (!onRefreshSlide) return
		return onRefreshSlide(index)
	}

	// Handle regenerate screenshot only
	function handleRegenerateScreenshot(index: number) {
		if (!onRegenerateScreenshot) return
		onRegenerateScreenshot(index)
	}

	// Handle add new slide after current active slide
	function handleAddNewSlide() {
		if (!onInsertSlide) return
		onInsertSlide(activeIndex, "after")
	}

	// Toggle sidebar collapsed state
	function toggleSidebar() {
		const newCollapsed = !isCollapsed
		if (onCollapsedChange) {
			onCollapsedChange(newCollapsed)
		} else {
			setInternalIsCollapsed(newCollapsed)
		}
	}

	const handleLocateFile = useMemoizedFn((index: number) => {
		const currentFileId = store.getFileIdByPath(items[index].path)
		if (currentFileId) {
			pubsub.publish(PubSubEvents.Locate_File_In_Tree, currentFileId)
		}
	})

	return (
		<TooltipProvider>
			<div
				data-testid="ppt-sidebar"
				onKeyDown={(event) => {
					if (
						!tools ||
						tools.busy ||
						!(event.target instanceof HTMLElement) ||
						!event.currentTarget.contains(event.target) ||
						event.target.closest("input,textarea,select,[contenteditable=true]")
					)
						return
					if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "a") {
						event.preventDefault()
						event.stopPropagation()
						tools.selectAll()
					} else if (event.key === "Escape" && tools.selecting) {
						event.preventDefault()
						event.stopPropagation()
						tools.clearSelection()
					}
				}}
				className={cn(
					"relative flex border-border bg-background",
					TAILWIND_Z_INDEX_CLASSES.BASE.SIDEBAR,
					isMobile
						? "h-full w-full flex-row border-t"
						: "h-full w-full flex-col border-r",
				)}
			>
				{/* Toolbar */}
				{!isMobile && (
					<div
						className={cn(
							"flex items-center gap-1 border-border px-2",
							"h-12 justify-between border-b",
						)}
					>
						{/* 折叠按钮 - 仅桌面端显示，无幻灯片时禁用 */}
						<Tooltip>
							<TooltipTrigger asChild>
								<span>
									<Button
										variant="ghost"
										size="icon"
										data-testid="ppt-sidebar-collapse-button"
										onClick={toggleSidebar}
										disabled={hasNoSlides}
										className="h-8 w-8 shrink-0 text-foreground"
									>
										<PanelLeftClose className="h-4 w-4" />
									</Button>
								</span>
							</TooltipTrigger>
							<TooltipContent>{t("fileViewer.collapseSidebar")}</TooltipContent>
						</Tooltip>
						{allowEdit && (
							<Tooltip>
								<TooltipTrigger asChild className={"w-full"}>
									<span>
										<Button
											variant="ghost"
											size={"sm"}
											data-testid="ppt-sidebar-add-slide-button"
											onClick={handleAddNewSlide}
											disabled={!onInsertSlide || tools?.busy}
											className={cn(
												"border border-border text-foreground",
												"w-full flex-1",
												"flex items-center",
											)}
										>
											<Plus className={"mr-1 h-4 w-4 flex-shrink-0"} />
											<span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-xs">
												{t("fileViewer.addNewSlide")}
											</span>
										</Button>
									</span>
								</TooltipTrigger>
								<TooltipContent>
									{t("fileViewer.addNewSlideTooltip")}
								</TooltipContent>
							</Tooltip>
						)}
					</div>
				)}

				{/* Mobile keeps the thumbnail strip without the selection toolbar's column. */}
				{tools && !isMobile ? (
					<PPTDeckToolbar
						onOpenTransitions={
							onOpenTransitions ? () => onOpenTransitions() : undefined
						}
						tools={tools}
						allowEdit={allowEdit}
						slideCount={slides.length}
						isMobile={isMobile}
					/>
				) : null}
				{/* Slides list */}
				<ScrollArea
					data-testid="ppt-sidebar-slides-list"
					viewportRef={scrollContainerRef}
					scrollbarOrientation={isMobile ? "horizontal" : "vertical"}
					onDragOver={handleSlidesListDragOver}
					onDragLeave={handleSlidesListDragLeave}
					onDrop={handleSlidesListDrop}
					className={cn(
						"min-h-0 flex-1 [&_[data-slot='scroll-area-viewport']>div]:!block",
						isMobile && "w-full",
					)}
					viewportClassName={cn(
						isMobile
							? "overflow-x-auto overflow-y-hidden"
							: "overflow-y-auto overflow-x-hidden pr-3",
					)}
				>
					{hasNoSlides ? (
						<div
							data-testid="ppt-sidebar-empty"
							className={cn(
								"flex size-full min-h-32 flex-col items-center justify-center gap-2 text-center",
								isMobile ? "px-4" : "",
							)}
						>
							<p className="text-sm font-medium text-muted-foreground">
								{t("fileViewer.noSlidesTitle")}
							</p>
						</div>
					) : (
						<div
							data-testid="ppt-sidebar-virtual-content"
							className={cn("relative", isMobile ? "h-full" : "w-full")}
							style={
								isMobile
									? { width: rowVirtualizer.getTotalSize(), height: "100%" }
									: { height: rowVirtualizer.getTotalSize(), width: "100%" }
							}
						>
							{virtualItems.map((virtualItem) => {
								const item = items[virtualItem.index]
								if (!item) return null

								return (
									<div
										key={virtualItem.key}
										data-index={virtualItem.index}
										className={cn(
											"absolute top-0",
											isMobile
												? "left-0 h-full w-[140px]"
												: "left-2 right-2 py-1",
										)}
										style={{
											transform: isMobile
												? `translate3d(${virtualItem.start}px, 0, 0)`
												: `translate3d(0, ${virtualItem.start}px, 0)`,
										}}
									>
										<SortableSlideItem
											item={item}
											isActive={item.index === activeIndex}
											onClick={(event) => {
												const fileId = store.getFileIdByPath(item.path)
												if (
													tools &&
													!tools.busy &&
													(tools.selecting ||
														event?.metaKey ||
														event?.ctrlKey ||
														event?.shiftKey)
												) {
													if (fileId)
														tools.select(
															fileId,
															Boolean(event?.shiftKey),
														)
													return
												}
												onSlideClick(item.index)
											}}
											selectionMode={tools?.selecting}
											removeOnly={Boolean(tools)}
											isSelected={tools?.selected.has(
												store.getFileIdByPath(item.path) || "",
											)}
											onSelect={
												tools && !tools.busy
													? (range) =>
															tools.select(
																store.getFileIdByPath(item.path) ||
																	"",
																range,
															)
													: undefined
											}
											isHidden={hiddenPaths?.has(item.path)}
											onToggleHidden={
												tools && allowEdit && !tools.busy
													? () => {
															const fileId = store.getFileIdByPath(
																item.path,
															)
															if (fileId)
																return tools.setHidden(
																	!hiddenPaths?.has(item.path),
																	new Set([fileId]),
																)
														}
													: undefined
											}

											totalSlides={items.length}
											slideFileId={store.getFileIdByPath(item.path)}
											slideFullRelativePath={store.getFullRelativePath(
												item.path,
											)}
											slideDimensions={PPT_SIDEBAR_THUMBNAIL_DIMENSIONS}
											onInsertAbove={() =>
												handleInsertSlide(item.index, "before")
											}
											onInsertBelow={() =>
												handleInsertSlide(item.index, "after")
											}
											onDuplicate={() => handleDuplicateSlide(item.index)}
											onDelete={() => handleDeleteSlide(item.index)}
											onRename={(newFileName) =>
												handleRenameSlide(item.index, newFileName)
											}
											onRefresh={() => handleRefreshSlide(item.index)}
											onRegenerateScreenshot={() =>
												handleRegenerateScreenshot(item.index)
											}
											onAddToCurrentChat={
												onAddToCurrentChat
													? () => onAddToCurrentChat(item.index)
													: undefined
											}
											onAddToNewChat={
												onAddToNewChat
													? () => onAddToNewChat(item.index)
													: undefined
											}
											onReplaceTemplate={
												canReplaceTemplate && onReplaceSlideTemplate
													? () => onReplaceSlideTemplate(item.index)
													: undefined
											}
											onOpenFile={onOpenFile}
											onOpenTransitions={
												onOpenTransitions
													? () => onOpenTransitions(item.index)
													: undefined
											}
											onLocateFile={() => handleLocateFile(item.index)}
											isMobile={isMobile}
											className={cn(
												isMobile ? "h-full" : "min-h-[120px]",
												draggedId === item.id && "opacity-50",
											)}
											allowEdit={allowEdit && !tools?.busy}
											onSlideDragStart={handleSlideDragStart}
										/>
									</div>
								)
							})}

							{dropTarget && (
								<div
									data-testid="ppt-sidebar-drop-indicator"
									data-drop-target={dropTarget.gapIndex}
									data-gap-index={dropTarget.gapIndex}
									className={cn(
										"pointer-events-none absolute top-0 z-20",
										isMobile ? "left-0 h-full w-3" : "left-2 right-2",
									)}
									style={{
										transform: isMobile
											? `translate3d(${dropTarget.offset}px, 0, 0)`
											: `translate3d(0, ${dropTarget.offset}px, 0)`,
									}}
								>
									<DropIndicator position={isMobile ? "left" : "top"} />
								</div>
							)}
						</div>
					)}
				</ScrollArea>
			</div>
		</TooltipProvider>
	)
}

export default observer(PPTSidebar)

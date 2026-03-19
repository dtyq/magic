import React, { useEffect, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { Plus, PanelLeftClose } from "lucide-react"
import SortableSlideItem from "./SortableSlideItem"
import DropIndicator from "./DropIndicator"
import type { PPTSidebarProps, SlideItem } from "./types"
import { observer } from "mobx-react-lite"
import {
	TooltipProvider,
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/shadcn-ui/tooltip"
import { Button } from "@/components/shadcn-ui/button"
import { ScrollArea } from "@/components/shadcn-ui/scroll-area"
import { cn } from "@/lib/utils"
import { useMemoizedFn } from "ahooks"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import { usePPTStore } from "../hooks"
import { TAILWIND_Z_INDEX_CLASSES } from "../../../contents/HTML/constants/z-index"

function PPTSidebar({
	onSlideClick,
	onSortChange,
	onInsertSlide,
	onDeleteSlide,
	onRenameSlide,
	onRefreshSlide,
	onRegenerateScreenshot,
	onAddToCurrentChat,
	onAddToNewChat,
	mainFileId,
	allowEdit = false,
	isMobile = false,
	isCollapsed: externalIsCollapsed,
	onCollapsedChange,
}: PPTSidebarProps) {
	const { t } = useTranslation("super")
	const store = usePPTStore()

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

	// Ref to track if sort change should be notified
	const shouldNotifySortChange = useRef(false)

	// Update items when slides change (but not during drag)
	useEffect(() => {
		setItems(slides)
	}, [slides])

	// Notify parent of sort change when items change from drag operation
	useEffect(() => {
		if (shouldNotifySortChange.current && onSortChange) {
			shouldNotifySortChange.current = false
			onSortChange(items)
		}
	}, [items, onSortChange])

	// Convert slides to screenshot format for backward compatibility
	const getScreenshot = useMemo(() => {
		return (index: number) => {
			const slide = slides[index]
			if (!slide) return undefined

			return {
				index,
				thumbnailUrl: slide.thumbnailUrl || "",
				isLoading: slide.thumbnailLoading || false,
				error: slide.thumbnailError,
			}
		}
	}, [slides])

	// Manual Drag & Drop State
	const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
	const [dropTarget, setDropTarget] = useState<{
		index: number
		position: "before" | "after"
	} | null>(null)

	const handleSlideDragStart = (e: React.DragEvent, index: number) => {
		setDraggedIndex(index)
		// Set drag effect
		e.dataTransfer.effectAllowed = "copyMove"
	}

	const handleSlideDragOver = (e: React.DragEvent, index: number) => {
		// Prevent default to allow drop
		e.preventDefault()

		if (draggedIndex === null || draggedIndex === index) {
			setDropTarget(null)
			return
		}

		// Calculate drop position based on mouse position
		const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
		const midY = rect.top + rect.height / 2
		const midX = rect.left + rect.width / 2

		// For mobile (horizontal) vs desktop (vertical)
		let position: "before" | "after"
		if (isMobile) {
			position = e.clientX < midX ? "before" : "after"
		} else {
			position = e.clientY < midY ? "before" : "after"
		}

		setDropTarget({ index, position })
	}

	const handleSlideDragLeave = () => {
		// keeping this simple, might need debounce if flickering
	}

	const handleSlideDrop = (e: React.DragEvent, index: number) => {
		e.preventDefault()

		if (draggedIndex === null || draggedIndex === index) {
			setDraggedIndex(null)
			setDropTarget(null)
			return
		}

		setItems((currentItems) => {
			const itemToMove = currentItems[draggedIndex]
			const newItemsWithout = currentItems.filter((_, i) => i !== draggedIndex)

			// Calculate insertion index in the *new* array
			let insertAt = index

			// Correction because indices shifted if dragged was before target
			if (draggedIndex < index) {
				insertAt = index - 1 // removed one before, so target shifted left
			}

			if (dropTarget?.position === "after") {
				insertAt = insertAt + 1
			}

			// Clamp
			insertAt = Math.max(0, Math.min(insertAt, newItemsWithout.length))

			newItemsWithout.splice(insertAt, 0, itemToMove)

			// Update indices
			const updatedItems = newItemsWithout.map((item, idx) => ({
				...item,
				index: idx,
			}))

			shouldNotifySortChange.current = true
			return updatedItems
		})

		setDraggedIndex(null)
		setDropTarget(null)
	}

	// Reset drag state on global drag end or drop
	useEffect(() => {
		const handleGlobalDragEnd = () => {
			// small delay to allow drop handler to fire first
			setTimeout(() => {
				setDraggedIndex(null)
				setDropTarget(null)
			}, 50)
		}

		window.addEventListener("dragend", handleGlobalDragEnd)
		// Also listen for drop on window to clear state if dropped outside valid targets
		window.addEventListener("drop", handleGlobalDragEnd)

		return () => {
			window.removeEventListener("dragend", handleGlobalDragEnd)
			window.removeEventListener("drop", handleGlobalDragEnd)
		}
	}, [])

	// Handle insert slide
	function handleInsertSlide(position: number, direction: "before" | "after") {
		if (!onInsertSlide) return
		onInsertSlide(position, direction)
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
		onRenameSlide(index, newFileName)
	}

	// Handle refresh slide
	function handleRefreshSlide(index: number) {
		if (!onRefreshSlide) return
		onRefreshSlide(index)
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

	// Ref for scroll container (used by Intersection Observer)
	const scrollContainerRef = useRef<HTMLDivElement>(null)

	// Track if initial visibility check has been performed
	const hasPerformedInitialCheck = useRef(false)

	// Trigger initial visibility check for all slides when scroll container is ready
	useEffect(() => {
		if (!scrollContainerRef.current || hasPerformedInitialCheck.current) return
		if (items.length === 0) return

		const container = scrollContainerRef.current

		// Check which slides are initially visible
		const checkInitialVisibleSlides = () => {
			if (!container || hasPerformedInitialCheck.current) return

			hasPerformedInitialCheck.current = true

			const containerRect = container.getBoundingClientRect()
			const slideElements = container.querySelectorAll('[data-dnd-sortable="true"]')

			slideElements.forEach((element, idx) => {
				const elementRect = element.getBoundingClientRect()

				// Check if element is visible (with 200px preload margin)
				const isVisible =
					elementRect.top < containerRect.bottom + 200 &&
					elementRect.bottom > containerRect.top - 200

				if (isVisible && items[idx]) {
					// Trigger visibility callback for this slide
					store.ensureSlideScreenshot(items[idx].index)
				}
			})
		}

		// Check after a short delay to ensure DOM is fully rendered
		const timeoutId = setTimeout(checkInitialVisibleSlides, 150)

		return () => {
			clearTimeout(timeoutId)
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [items.length])

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
											disabled={!onInsertSlide}
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

				{/* Slides list */}
				<ScrollArea
					data-testid="ppt-sidebar-slides-list"
					className={cn(
						"flex-1 p-2 [&_[data-slot='scroll-area-viewport']>div]:!flex [&_[data-slot='scroll-area-viewport']>div]:min-h-full",
						isMobile
							? // Mobile: horizontal scroll with gap spacing
							"w-full [&_[data-slot='scroll-area-viewport']>div]:flex-row [&_[data-slot='scroll-area-viewport']>div]:gap-2 [&_[data-slot='scroll-area-viewport']>div]:overflow-x-auto"
							: // Desktop: vertical scroll with column direction
							"overflow-y-auto pr-3 [&_[data-slot='scroll-area-viewport']>div]:flex-col",
					)}
				>
					{hasNoSlides && (
						<div
							data-testid="ppt-sidebar-empty"
							className={cn(
								"flex flex-1 flex-col items-center justify-center gap-2 text-center",
								isMobile ? "px-4" : "",
							)}
						>
							<p className="text-sm font-medium text-muted-foreground">
								{t("fileViewer.noSlidesTitle")}
							</p>
						</div>
					)}
					{items.map((item, idx) => {
						// Determine if we should show drop indicator
						const isDropTarget = dropTarget?.index === idx
						const showTopIndicator = isDropTarget && dropTarget?.position === "before"
						const showBottomIndicator = isDropTarget && dropTarget?.position === "after"

						// If dragging this item, maybe fade it out
						const isDragging = draggedIndex === idx

						return (
							<div key={item.id} className="relative">
								{/* Show drop indicator */}
								{showTopIndicator && (
									<DropIndicator position={isMobile ? "left" : "top"} />
								)}

								<SortableSlideItem
									item={item}
									isActive={item.index === activeIndex}
									onClick={() => onSlideClick(item.index)}
									screenshot={getScreenshot(item.index)}
									totalSlides={items.length}
									mainFileId={mainFileId}
									slideFileId={store.getFileIdByPath(item.path)}
									scrollContainerRef={scrollContainerRef}
									onInsertAbove={() => handleInsertSlide(item.index, "before")}
									onInsertBelow={() => handleInsertSlide(item.index, "after")}
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
									onVisible={() => store.ensureSlideScreenshot(item.index)}
									onLocateFile={() => handleLocateFile(item.index)}
									isMobile={isMobile}
									className={cn(
										isMobile
											? // Mobile: horizontal spacing (gap handled by parent)
											"h-full"
											: // Desktop: vertical spacing
											"my-1 min-h-[120px]",
										idx === items.length - 1 && !isMobile && "mb-0",
										isDragging && "opacity-50",
									)}
									allowEdit={allowEdit}
									// Pass drag handlers
									onSlideDragStart={handleSlideDragStart}
									onSlideDragOver={handleSlideDragOver}
									onSlideDrop={handleSlideDrop}
									onSlideDragLeave={handleSlideDragLeave}
								/>

								{/* Show drop indicator */}
								{showBottomIndicator && (
									<DropIndicator position={isMobile ? "right" : "bottom"} />
								)}
							</div>
						)
					})}
				</ScrollArea>
			</div>
		</TooltipProvider>
	)
}

export default observer(PPTSidebar)

import { useState, useMemo, useEffect, useRef } from "react"
import {
	Image,
	Loader2,
	ArrowUp,
	ArrowDown,
	Trash2,
	Pencil,
	Sparkles,
	MessageSquarePlus,
	MessageSquare,
	FileSearch,
	RefreshCw,
} from "lucide-react"
import { useTranslation } from "react-i18next"
import { cn } from "@/lib/utils"
import {
	ContextMenu,
	ContextMenuTrigger,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuSeparator,
	ContextMenuSub,
	ContextMenuSubTrigger,
	ContextMenuSubContent,
} from "@/components/shadcn-ui/context-menu"
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/shadcn-ui/dialog"
import { Input } from "@/components/shadcn-ui/input"
import { Button } from "@/components/shadcn-ui/button"
import type { SortableSlideItemProps } from "./types"
import { useAIEdit } from "../hooks/useAIEdit"
import { observer } from "mobx-react-lite"
import SmartTooltip from "@/components/other/SmartTooltip"
import { useScreenshotRetry } from "./hooks/useScreenshotRetry"
import { handlePPTSlideDragStart } from "../../../../MessageEditor/utils/drag"

function SortableSlideItem({
	item,
	isActive,
	onClick,
	screenshot,
	totalSlides,
	onInsertAbove,
	onInsertBelow,
	onDelete,
	onRename,
	onAddToCurrentChat,
	onAddToNewChat,
	onLocateFile,
	onRefresh,
	onRegenerateScreenshot,
	onVisible,
	scrollContainerRef,
	mainFileId,
	className,
	isMobile = false,
	allowEdit = false,
	slideFileId,
	...props
}: SortableSlideItemProps) {
	const { t } = useTranslation("super")
	const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false)
	const [renameValue, setRenameValue] = useState("")
	const [imageLoadError, setImageLoadError] = useState(false)
	const visibilityRef = useRef<HTMLDivElement>(null)
	const hasTriggeredVisibility = useRef(false)
	// Track previous loading state to detect when content becomes loaded
	const prevLoadingStateRef = useRef<string | undefined>(item.loadingState)

	// Reset image load error when thumbnail URL changes
	useEffect(() => {
		setImageLoadError(false)
	}, [screenshot?.thumbnailUrl])

	// Auto-retry mechanism for image loading failure
	const imageLoadRetry = useScreenshotRetry({
		hasError: imageLoadError,
		isLoading: !!screenshot?.isLoading,
		hasThumbnail: !!screenshot?.thumbnailUrl && !imageLoadError,
		onRetry: () => {
			// For image load error, need to clear cache and regenerate with new URL
			setImageLoadError(false)
			onRegenerateScreenshot?.()
		},
		maxRetries: 3,
		baseRetryDelay: 2000,
	})

	// Combine retry states
	const canRetry = imageLoadRetry.canRetry
	const manualRetry = () => {
		imageLoadRetry.manualRetry()
	}

	const { onSlideDragStart, onSlideDragOver, onSlideDrop, onSlideDragLeave } = props

	// Combine refs and visibility ref
	// We no longer use sortable setNodeRef, just ref for visibility
	const setRefs = (node: HTMLDivElement | null) => {
		// @ts-expect-error - Setting ref.current directly
		visibilityRef.current = node
	}

	// Intersection Observer to detect visibility and trigger screenshot generation
	useEffect(() => {
		if (!visibilityRef.current || !onVisible) return

		const currentElement = visibilityRef.current
		let observer: IntersectionObserver | null = null

		// Setup observer with retry logic for scroll container
		const setupObserver = () => {
			const scrollContainer = scrollContainerRef?.current

			observer = new IntersectionObserver(
				(entries) => {
					entries.forEach((entry) => {
						if (entry.isIntersecting && !hasTriggeredVisibility.current) {
							hasTriggeredVisibility.current = true
							onVisible()
						}
					})
				},
				{
					root: scrollContainer,
					rootMargin: "200px",
					threshold: 0.01,
				},
			)

			observer.observe(currentElement)
		}

		// Delay to allow scroll container to be ready
		const timeoutId = setTimeout(setupObserver, 50)

		return () => {
			clearTimeout(timeoutId)
			observer?.disconnect()
		}
	}, [onVisible, scrollContainerRef])

	// Reset visibility flag when screenshot is generated
	useEffect(() => {
		if (screenshot?.thumbnailUrl && hasTriggeredVisibility.current) {
			// Screenshot loaded, allow re-triggering if needed
			hasTriggeredVisibility.current = false
		}
	}, [screenshot?.thumbnailUrl])

	// Re-trigger visibility when slide content becomes loaded after initial visibility check
	// This handles cases where slide was visible but content wasn't loaded yet
	useEffect(() => {
		const prevLoadingState = prevLoadingStateRef.current
		const currentLoadingState = item.loadingState

		// Update previous loading state ref
		prevLoadingStateRef.current = currentLoadingState

		// If visibility was triggered before, content just became loaded, and no thumbnail yet
		if (
			hasTriggeredVisibility.current &&
			prevLoadingState !== "loaded" &&
			currentLoadingState === "loaded" &&
			!screenshot?.thumbnailUrl &&
			onVisible
		) {
			// Reset flag to allow re-triggering
			hasTriggeredVisibility.current = false
			onVisible()
		}
	}, [item.loadingState, screenshot?.thumbnailUrl, onVisible, item.index, item.id])

	// Build current file info for this slide (each slide is an HTML file)
	const currentFile = useMemo(() => {
		if (!mainFileId || !item.path) return undefined

		// Extract file name from path (e.g., "slides/page1.html" -> "page1.html")
		const fileName = item.path.split("/").pop() || item.path
		// Get file extension (should be "html")
		const fileExtension = fileName.split(".").pop() || "html"

		return {
			file_id: mainFileId, // Use main file ID as parent
			file_name: fileName,
			relative_file_path: item.path,
			file_extension: fileExtension,
		}
	}, [mainFileId, item.path])

	// Use AI edit hook
	const { aiEditItems } = useAIEdit({ currentFile })

	// Render thumbnail based on screenshot state
	const renderThumbnail = () => {
		const hasError = screenshot?.error || imageLoadError

		// Show loading state when: 1) actively loading, or 2) has error but still retrying
		if (screenshot?.isLoading || (hasError && canRetry)) {
			return (
				<div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
					<Loader2 className="size-4 animate-spin" />
				</div>
			)
		}

		// Show error state only when retry attempts exhausted
		if (hasError && !canRetry) {
			return (
				<div
					className="flex h-full w-full flex-col items-center justify-center gap-1.5 p-2 text-xs"
					onClick={(e) => {
						e.stopPropagation()
						manualRetry()
					}}
				>
					<Image className="size-4" />
				</div>
			)
		}

		if (screenshot?.thumbnailUrl) {
			return (
				<div className="rounded-sm border-[1px] border-border">
					<img
						src={screenshot.thumbnailUrl}
						alt={`Slide ${item.index + 1}`}
						className="h-full w-full rounded-sm object-cover"
						draggable={false}
						onError={(e) => {
							// Image load failed, trigger retry
							setImageLoadError(true)
						}}
						onLoad={(e) => {
							// Image loaded successfully, clear any error state
							setImageLoadError(false)
						}}
					/>
				</div>
			)
		}

		// Fallback for no screenshot
		return (
			<div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
				<Image className="size-4" />
			</div>
		)
	}

	// Get display title for tooltip
	const getDisplayTitle = () => {
		return item.title || item.path.split("/").pop() || "Untitled"
	}

	const isLastSlide = totalSlides === 1

	// Extract current file name from path (without extension)
	const getCurrentFileName = () => {
		const fileName = item.path.split("/").pop() || ""
		return fileName.replace(/\.html$/, "")
	}

	// Handle rename dialog open
	const handleOpenRenameDialog = () => {
		setRenameValue(getCurrentFileName())
		setIsRenameDialogOpen(true)
	}

	// Handle rename confirm
	const handleRenameConfirm = () => {
		if (renameValue.trim() && onRename) {
			onRename(renameValue.trim())
		}
		setIsRenameDialogOpen(false)
		setRenameValue("")
	}

	// Handle rename cancel
	const handleRenameCancel = () => {
		setIsRenameDialogOpen(false)
		setRenameValue("")
	}

	const main = (
		<div
			ref={setRefs}
			data-testid={`ppt-sidebar-slide-item-${item.id}`}
			className={cn(
				"group relative rounded transition-all",
				isMobile
					? // Mobile: vertical layout with thumbnail first, no drag cursor
					"flex h-full w-[140px] shrink-0 cursor-pointer !flex-col gap-1.5"
					: // Desktop: vertical layout with thumbnail first, drag cursor
					"flex h-full cursor-grab flex-col active:cursor-grabbing",
				className,
			)}
			onClick={onClick}
			draggable={allowEdit && !isMobile}
			onDragStart={(e) => {
				// 1. Set data for MessageEditor drag-to-insert
				if (slideFileId) {
					const fileName = item.path.split("/").pop() || item.path
					handlePPTSlideDragStart(e, {
						file_id: slideFileId,
						file_name: fileName,
						relative_file_path: item.path,
						file_extension: "html",
						slide_index: item.index,
						slide_title: item.title,
					})
				}
				// 2. Trigger internal sort start
				onSlideDragStart?.(e, item.index)
			}}
			onDragOver={(e) => {
				e.preventDefault() // Allow drop
				onSlideDragOver?.(e, item.index)
			}}
			onDrop={(e) => {
				e.preventDefault()
				onSlideDrop?.(e, item.index)
			}}
			onDragLeave={(e) => {
				onSlideDragLeave?.(e)
			}}
		>
			{/* Slide info: number and title below thumbnail */}
			<div
				className={cn(
					"flex w-full items-center gap-1 px-1",
					isMobile ? "justify-center" : "justify-start",
				)}
			>
				<span className="shrink-0 text-sm font-medium">{item.index + 1}</span>
				<div className="min-w-0 flex-1">
					<SmartTooltip
						className="w-full text-xs text-muted-foreground"
						content={getDisplayTitle()}
					>
						{getDisplayTitle()}
					</SmartTooltip>
				</div>
			</div>
			{/* Slide thumbnail with image preview */}
			<div
				className={cn(
					"relative flex shrink-0 items-center justify-center overflow-hidden rounded-md border-2 bg-muted p-0.5 shadow-sm transition-shadow group-hover:shadow",
					isMobile
						? // Mobile: square aspect ratio with fixed width
						"aspect-16/9 min-h-[90px] w-full"
						: // Desktop: fixed height with flexible width
						"h-full min-h-[90px] w-[100%]",
					isActive
						? "border-primary"
						: "border-transparent bg-background hover:border-accent",
				)}
			>
				{renderThumbnail()}
			</div>
		</div>
	)

	if (!allowEdit) {
		return main
	}

	return (
		<>
			<ContextMenu>
				<ContextMenuTrigger asChild>
					<span>{main}</span>
				</ContextMenuTrigger>

				{/* Context menu */}
				<ContextMenuContent className="w-48">
					<ContextMenuItem
						onClick={(e) => {
							e.stopPropagation()
							onAddToCurrentChat?.()
						}}
					>
						<MessageSquare className="mr-2 size-4" />
						{t("fileViewer.addToCurrentChat")}
					</ContextMenuItem>
					<ContextMenuItem
						onClick={(e) => {
							e.stopPropagation()
							onAddToNewChat?.()
						}}
					>
						<MessageSquarePlus className="mr-2 size-4" />
						{t("fileViewer.addToNewChat")}
					</ContextMenuItem>
					<ContextMenuSeparator />
					<ContextMenuItem
						onClick={(e) => {
							e.stopPropagation()
							onLocateFile?.()
						}}
					>
						<FileSearch className="mr-2 size-4" />
						{t("fileViewer.locateFile")}
					</ContextMenuItem>
					<ContextMenuSeparator />
					<ContextMenuItem
						onClick={(e) => {
							e.stopPropagation()
							onRefresh?.()
						}}
					>
						<RefreshCw className="mr-2 size-4" />
						{t("fileViewer.refreshSlide")}
					</ContextMenuItem>
					<ContextMenuSeparator />
					<ContextMenuItem
						onClick={(e) => {
							e.stopPropagation()
							onInsertAbove?.()
						}}
					>
						<ArrowUp className="mr-2 size-4" />
						{t("fileViewer.insertAbove")}
					</ContextMenuItem>
					<ContextMenuItem
						onClick={(e) => {
							e.stopPropagation()
							onInsertBelow?.()
						}}
					>
						<ArrowDown className="mr-2 size-4" />
						{t("fileViewer.insertBelow")}
					</ContextMenuItem>
					<ContextMenuSeparator />
					<ContextMenuItem
						onClick={(e) => {
							e.stopPropagation()
							handleOpenRenameDialog()
						}}
					>
						<Pencil className="mr-2 size-4" />
						{t("fileViewer.renameSlide")}
					</ContextMenuItem>
					<ContextMenuSeparator />
					{/* AI Edit submenu */}
					{currentFile && aiEditItems.length > 0 && (
						<>
							<ContextMenuSub>
								<ContextMenuSubTrigger>
									<Sparkles className="mr-4 size-4" />
									{t("fileViewer.aiEdit")}
								</ContextMenuSubTrigger>
								<ContextMenuSubContent className="w-56">
									{aiEditItems.map((aiItem) => (
										<ContextMenuItem
											key={aiItem.key}
											onClick={(e) => {
												e.stopPropagation()
												aiItem.onClick()
											}}
										>
											<span className="mr-2">{aiItem.icon}</span>
											<div className="flex flex-col">
												<span className="text-sm font-medium">
													{aiItem.label}
												</span>
												<span className="text-xs text-muted-foreground">
													{aiItem.description}
												</span>
											</div>
										</ContextMenuItem>
									))}
								</ContextMenuSubContent>
							</ContextMenuSub>
							<ContextMenuSeparator />
						</>
					)}
					<ContextMenuItem
						variant="destructive"
						disabled={isLastSlide}
						onClick={(e) => {
							e.stopPropagation()
							if (!isLastSlide) {
								onDelete?.()
							}
						}}
					>
						<Trash2 className="mr-2 size-4 text-destructive" />
						{t("fileViewer.deleteSlide")}
					</ContextMenuItem>
				</ContextMenuContent>
			</ContextMenu>

			{/* Rename Dialog */}
			<Dialog open={isRenameDialogOpen} onOpenChange={setIsRenameDialogOpen}>
				<DialogContent className="sm:max-w-[425px]" data-testid="ppt-sidebar-rename-dialog">
					<DialogHeader>
						<DialogTitle>{t("fileViewer.renameSlideDialogTitle")}</DialogTitle>
						<DialogDescription>
							{t("fileViewer.renameSlideDialogPlaceholder")}
						</DialogDescription>
					</DialogHeader>
					<div className="grid gap-4 py-4">
						<Input
							data-testid="ppt-sidebar-rename-dialog-input"
							value={renameValue}
							onChange={(e) => setRenameValue(e.target.value)}
							placeholder={t("fileViewer.renameSlideDialogPlaceholder")}
							onKeyDown={(e) => {
								if (e.key === "Enter") {
									handleRenameConfirm()
								} else if (e.key === "Escape") {
									handleRenameCancel()
								}
							}}
							autoFocus
						/>
					</div>
					<DialogFooter>
						<Button
							variant="outline"
							data-testid="ppt-sidebar-rename-dialog-cancel"
							onClick={handleRenameCancel}
						>
							{t("fileViewer.renameSlideDialogCancel")}
						</Button>
						<Button
							data-testid="ppt-sidebar-rename-dialog-confirm"
							onClick={handleRenameConfirm}
							disabled={!renameValue.trim()}
						>
							{t("fileViewer.renameSlideDialogConfirm")}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	)
}

export default observer(SortableSlideItem)

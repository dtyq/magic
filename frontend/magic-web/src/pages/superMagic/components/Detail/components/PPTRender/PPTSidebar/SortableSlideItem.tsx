import { useState, useMemo, useEffect, useRef } from "react"
import {
	Image,
	Loader2,
	ArrowUp,
	ArrowDown,
	Trash2,
	Pencil,
	MessageSquarePlus,
	MessageSquare,
	FileSearch,
	FileSymlink,
	RefreshCw,
	Copy,
	LayoutTemplate,
	EyeOff,
	Eye,
	GalleryHorizontalEnd,
} from "lucide-react"
import { useTranslation } from "react-i18next"
import { cn } from "@/utils/cn"
import {
	ContextMenu,
	ContextMenuTrigger,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuSeparator,
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
import { Checkbox } from "@/components/shadcn-ui/checkbox"
import type { SortableSlideItemProps } from "./types"
import { observer } from "mobx-react-lite"
import SmartTooltip from "@/components/other/SmartTooltip"
import { useScreenshotRetry } from "./hooks/useScreenshotRetry"
import { handlePPTSlideDragStart } from "../../../../MessageEditor/utils/drag"
import { resolvePptScaleContentDimensions } from "../../../contents/HTML/utils/slide-dimensions"
import { FILE_SAVE_STATUS } from "../../../services/fileSaveQueue"
import { useFileSaveStatus } from "../../../hooks/useFileSaveStatus"

function SortableSlideItem({
	onOpenTransitions,
	item,
	isActive,
	onClick,
	isSelected = false,
	selectionMode = false,
	onSelect,
	isHidden = false,
	onToggleHidden,
	removeOnly = false,
	screenshot,
	totalSlides,
	onInsertAbove,
	onInsertBelow,
	onDuplicate,
	onDelete,
	onRename,
	onAddToCurrentChat,
	onAddToNewChat,
	onReplaceTemplate,
	onLocateFile,
	onOpenFile,
	onRefresh,
	onRegenerateScreenshot,
	className,
	isMobile = false,
	allowEdit = false,
	slideFileId,
	slideFullRelativePath,
	slideDimensions: providedSlideDimensions,
	...props
}: SortableSlideItemProps) {
	const { t } = useTranslation("super")
	const saveStatus = useFileSaveStatus(slideFileId)
	const isUnsynced = saveStatus !== FILE_SAVE_STATUS.Idle
	const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false)
	const [renameValue, setRenameValue] = useState("")
	const [pendingAction, setPendingAction] = useState<string | null>(null)
	const actionPendingRef = useRef(false)
	// Keep feedback on the thumbnail when the menu closes, and lock before the first await.
	const runAction = async (label: string, action?: () => void | Promise<void | boolean>) => {
		if (!action || actionPendingRef.current) return false
		actionPendingRef.current = true
		setPendingAction(label)
		try {
			return (await action()) !== false
		} catch (error) {
			console.error("PPT slide action failed", error)
			return false
		} finally {
			actionPendingRef.current = false
			setPendingAction(null)
		}
	}
	const [imageLoadError, setImageLoadError] = useState(false)
	const addToCurrentChatShortcut = useMemo(() => {
		const isMac =
			typeof navigator !== "undefined" && navigator.platform.toUpperCase().includes("MAC")

		return {
			modifiers: [isMac ? "⌘" : "Ctrl"],
			key: "L",
		}
	}, [])
	const resolvedScreenshot = useMemo(
		() =>
			screenshot ?? {
				index: item.index,
				thumbnailUrl: item.thumbnailUrl || "",
				isLoading: item.thumbnailLoading || false,
				error: item.thumbnailError,
			},
		[item.index, item.thumbnailError, item.thumbnailLoading, item.thumbnailUrl, screenshot],
	)
	const slideDimensions = useMemo(
		() =>
			providedSlideDimensions ??
			resolvePptScaleContentDimensions(item.content, item.rawContent),
		[item.content, item.rawContent, providedSlideDimensions],
	)

	// Reset image load error when thumbnail URL changes
	useEffect(() => {
		setImageLoadError(false)
	}, [resolvedScreenshot.thumbnailUrl])

	// Auto-retry mechanism for image loading failure
	const imageLoadRetry = useScreenshotRetry({
		hasError: imageLoadError,
		isLoading: resolvedScreenshot.isLoading,
		hasThumbnail: !!resolvedScreenshot.thumbnailUrl && !imageLoadError,
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

	const { onSlideDragStart } = props

	// Render thumbnail based on screenshot state
	const renderThumbnail = () => {
		const hasError = resolvedScreenshot.error || imageLoadError

		// Keep the previous thumbnail visible while a new one regenerates.
		const isRefreshingExistingThumbnail =
			resolvedScreenshot.isLoading && !!resolvedScreenshot.thumbnailUrl && !hasError

		// Show loading state when: 1) actively loading, or 2) has error but still retrying
		if (
			!isRefreshingExistingThumbnail &&
			(resolvedScreenshot.isLoading || (hasError && canRetry))
		) {
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
					data-testid="manual-retry"
				>
					<Image className="size-4" />
				</div>
			)
		}

		if (resolvedScreenshot.thumbnailUrl) {
			return (
				<div className="h-full w-full rounded-sm border-[1px] border-border">
					<img
						src={resolvedScreenshot.thumbnailUrl}
						alt={`Slide ${item.index + 1}`}
						className="h-full w-full rounded-sm object-contain"
						draggable={false}
						onError={() => {
							// Image load failed, trigger retry
							setImageLoadError(true)
						}}
						onLoad={() => {
							// Image loaded successfully, clear any error state
							setImageLoadError(false)
						}}
						data-testid="set-image-load-error"
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

	// Keep the dialog mounted until the rename finishes, including its unsaved-edit guard.
	const handleRenameConfirm = async () => {
		if (!renameValue.trim() || !onRename) return
		if (await runAction(t("fileViewer.renameSlide"), () => onRename(renameValue.trim()))) {
			setIsRenameDialogOpen(false)
			setRenameValue("")
		}
	}

	// Handle rename cancel
	const handleRenameCancel = () => {
		if (actionPendingRef.current) return
		setIsRenameDialogOpen(false)
		setRenameValue("")
	}

	const main = (
		<div
			data-testid={`ppt-sidebar-slide-item-${item.id}`}
			data-selected={isSelected}
			aria-busy={Boolean(pendingAction)}
			role="group"
			tabIndex={0}
			aria-label={t("ppt.batch.page", { page: item.index + 1 })}
			data-slide-id={item.id}
			data-slide-index={item.index}
			className={cn(
				"group relative rounded transition-[background-color,box-shadow] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
				isSelected && "bg-accent ring-1 ring-primary/40",
				isMobile
					? // Mobile: vertical layout with thumbnail first, no drag cursor
						"flex h-full w-[140px] shrink-0 cursor-pointer !flex-col gap-1.5"
					: // Desktop: vertical layout with thumbnail first, drag cursor
						"flex cursor-grab flex-col active:cursor-grabbing",
				className,
			)}
			onClick={onClick}
			onKeyDown={(event) => {
				if (
					event.target !== event.currentTarget ||
					(event.key !== "Enter" && event.key !== " ")
				)
					return
				event.preventDefault()
				onClick(event)
			}}
			draggable={allowEdit && !isMobile}
			onDragStart={(e) => {
				// 1. Set data for MessageEditor drag-to-insert
				if (slideFileId) {
					const fileName = item.path.split("/").pop() || item.path
					handlePPTSlideDragStart(e, {
						file_id: slideFileId,
						file_name: fileName,
						relative_file_path: slideFullRelativePath || item.path,
						file_extension: "html",
						slide_index: item.index,
						slide_title: item.title,
					})
				}
				// 2. Trigger internal sort start without replacing the native DataTransfer flow.
				onSlideDragStart?.(e, item.id)
			}}
		>
			{/* Slide info: number and title below thumbnail */}
			<div
				className={cn(
					"flex w-full items-center gap-1 px-1",
					isMobile ? "justify-center" : "justify-start",
				)}
			>
				{selectionMode ? (
					<Checkbox
						checked={isSelected}
						disabled={!slideFileId || !onSelect}
						aria-label={t("ppt.batch.selectPage", { page: item.index + 1 })}
						onClick={(event) => {
							event.stopPropagation()
							onSelect?.(event.shiftKey)
						}}
						onDragStart={(event) => {
							event.preventDefault()
							event.stopPropagation()
						}}
					/>
				) : null}
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
				data-testid={`ppt-sidebar-slide-thumbnail-${item.id}`}
				className={cn(
					"relative flex shrink-0 items-center justify-center overflow-hidden rounded-md border-2 bg-muted p-0.5 shadow-sm transition-shadow group-hover:shadow",
					"min-h-[90px] w-full",
					isActive
						? "border-primary"
						: "border-transparent bg-background hover:border-accent",
				)}
				style={{ aspectRatio: `${slideDimensions.width} / ${slideDimensions.height}` }}
			>
				{renderThumbnail()}
				{isUnsynced ? (
					<span
						data-testid={`ppt-sidebar-slide-unsynced-${item.id}`}
						className={cn(
							"absolute right-1 top-1 h-2 w-2 rounded-full",
							saveStatus === FILE_SAVE_STATUS.Failed
								? "bg-destructive"
								: "bg-amber-500",
						)}
						aria-label={t("detail.fileSave.unsynced")}
					/>
				) : null}
				{pendingAction && (
					<div
						role="status"
						className="absolute inset-0 z-10 flex items-center justify-center gap-1 rounded-md bg-background/80 p-2 text-xs"
					>
						<Loader2 className="size-4 shrink-0 animate-spin" aria-hidden="true" />
						<span>{pendingAction}</span>
					</div>
				)}
				{isHidden ? (
					<span className="absolute right-1 top-1 flex items-center gap-1 rounded bg-background/90 px-1.5 py-0.5 text-xs text-muted-foreground">
						<EyeOff className="size-4" />
						{t("ppt.batch.hidden")}
					</span>
				) : null}
			</div>
		</div>
	)

	if ((!allowEdit && !pendingAction) || selectionMode) {
		return main
	}

	return (
		<>
			<ContextMenu>
				<ContextMenuTrigger asChild>
					<span>{main}</span>
				</ContextMenuTrigger>

				{/* Context menu */}
				<ContextMenuContent className="w-56">
					<ContextMenuItem
						disabled={Boolean(pendingAction)}
						onClick={(e) => {
							e.stopPropagation()
							onAddToCurrentChat?.()
						}}
					>
						<MessageSquare className="mr-2 size-4" />
						<span>{t("fileViewer.addToCurrentChat")}</span>
						{!isMobile && (
							<span className="ml-auto inline-flex items-center gap-1 pl-2">
								{addToCurrentChatShortcut.modifiers.map((modifier) => (
									<span
										key={modifier}
										className="inline-flex h-5 min-w-5 items-center justify-center rounded bg-[#f5f5f5] px-1 text-xs text-[#6b7280]"
									>
										{modifier}
									</span>
								))}
								<span className="inline-flex h-5 min-w-5 items-center justify-center rounded bg-[#f5f5f5] px-1 text-xs text-[#6b7280]">
									{addToCurrentChatShortcut.key}
								</span>
							</span>
						)}
					</ContextMenuItem>
					<ContextMenuItem
						disabled={Boolean(pendingAction)}
						onClick={(e) => {
							e.stopPropagation()
							void runAction(t("fileViewer.addToNewChat"), onAddToNewChat)
						}}
					>
						<MessageSquarePlus className="mr-2 size-4" />
						{t("fileViewer.addToNewChat")}
					</ContextMenuItem>
					<ContextMenuSeparator />
					<ContextMenuItem
						disabled={Boolean(pendingAction)}
						onClick={(e) => {
							e.stopPropagation()
							onLocateFile?.()
						}}
					>
						<FileSearch className="mr-2 size-4" />
						{t("fileViewer.locateFile")}
					</ContextMenuItem>
					{onOpenTransitions && (
						<ContextMenuItem
							disabled={Boolean(pendingAction)}
							onSelect={onOpenTransitions}
						>
							<GalleryHorizontalEnd className="mr-2 size-4" />
							{t("ppt.transitions.title")}
						</ContextMenuItem>
					)}
					{onOpenFile && (
						<ContextMenuItem
							disabled={
								Boolean(pendingAction) || !slideFileId || !slideFullRelativePath
							}
							onClick={(event) => {
								event.stopPropagation()
								if (slideFileId && slideFullRelativePath) {
									// Open the source file instead of navigating within the deck.
									onOpenFile(slideFileId, slideFullRelativePath)
								}
							}}
						>
							<FileSymlink className="mr-2 size-4" />
							{t("fileViewer.openCorrespondingFile")}
						</ContextMenuItem>
					)}
					<ContextMenuSeparator />
					<ContextMenuItem
						disabled={Boolean(pendingAction)}
						onClick={(e) => {
							e.stopPropagation()
							void runAction(t("fileViewer.refreshSlide"), onRefresh)
						}}
					>
						<RefreshCw className="mr-2 size-4" />
						{t("fileViewer.refreshSlide")}
					</ContextMenuItem>
					<ContextMenuSeparator />
					<ContextMenuItem
						disabled={Boolean(pendingAction)}
						onClick={(e) => {
							e.stopPropagation()
							void runAction(t("fileViewer.insertAbove"), onInsertAbove)
						}}
					>
						<ArrowUp className="mr-2 size-4" />
						{t("fileViewer.insertAbove")}
					</ContextMenuItem>
					<ContextMenuItem
						disabled={Boolean(pendingAction)}
						onClick={(e) => {
							e.stopPropagation()
							void runAction(t("fileViewer.insertBelow"), onInsertBelow)
						}}
					>
						<ArrowDown className="mr-2 size-4" />
						{t("fileViewer.insertBelow")}
					</ContextMenuItem>
					<ContextMenuItem
						disabled={Boolean(pendingAction)}
						onClick={(e) => {
							e.stopPropagation()
							void runAction(t("fileViewer.duplicateSlide"), onDuplicate)
						}}
					>
						<Copy className="mr-2 size-4" />
						{t("fileViewer.duplicateSlide")}
					</ContextMenuItem>
					<ContextMenuSeparator />
					{onToggleHidden && (
						<ContextMenuItem
							disabled={Boolean(pendingAction)}
							onSelect={() =>
								void runAction(
									isHidden ? t("ppt.batch.show") : t("ppt.batch.hide"),
									onToggleHidden,
								)
							}
						>
							{isHidden ? (
								<Eye className="mr-2 size-4" />
							) : (
								<EyeOff className="mr-2 size-4" />
							)}
							{isHidden ? t("ppt.batch.show") : t("ppt.batch.hide")}
						</ContextMenuItem>
					)}
					{onReplaceTemplate && (
						<>
							<ContextMenuItem
								disabled={Boolean(pendingAction)}
								data-testid="ppt-template-replacement-slide-menu-item"
								onClick={(e) => {
									e.stopPropagation()
									onReplaceTemplate()
								}}
							>
								<LayoutTemplate className="mr-2 size-4" />
								{t("ppt.templateReplacement.replaceSlide")}
							</ContextMenuItem>
							<ContextMenuSeparator />
						</>
					)}
					<ContextMenuItem
						disabled={Boolean(pendingAction)}
						onClick={(e) => {
							e.stopPropagation()
							handleOpenRenameDialog()
						}}
					>
						<Pencil className="mr-2 size-4" />
						{t("fileViewer.renameSlide")}
					</ContextMenuItem>
					<ContextMenuSeparator />
					<ContextMenuItem
						variant="destructive"
						disabled={Boolean(pendingAction) || isLastSlide}
						onClick={(e) => {
							e.stopPropagation()
							if (!isLastSlide) {
								onDelete?.()
							}
						}}
					>
						<Trash2 className="mr-2 size-4 text-destructive" />
						{removeOnly ? t("ppt.batch.remove") : t("fileViewer.deleteSlide")}
					</ContextMenuItem>
				</ContextMenuContent>
			</ContextMenu>

			{/* Rename Dialog */}
			<Dialog
				open={isRenameDialogOpen}
				onOpenChange={(open) => {
					if (!actionPendingRef.current) setIsRenameDialogOpen(open)
				}}
			>
				<DialogContent
					showCloseButton={!pendingAction}
					className="sm:max-w-[425px]"
					data-testid="ppt-sidebar-rename-dialog"
				>
					<DialogHeader>
						<DialogTitle>{t("fileViewer.renameSlideDialogTitle")}</DialogTitle>
						<DialogDescription>
							{t("fileViewer.renameSlideDialogPlaceholder")}
						</DialogDescription>
					</DialogHeader>
					<div className="grid gap-4 py-4">
						<Input
							data-testid="ppt-sidebar-rename-dialog-input"
							disabled={Boolean(pendingAction)}
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
							disabled={Boolean(pendingAction)}
							onClick={handleRenameCancel}
						>
							{t("fileViewer.renameSlideDialogCancel")}
						</Button>
						<Button
							data-testid="ppt-sidebar-rename-dialog-confirm"
							onClick={handleRenameConfirm}
							disabled={Boolean(pendingAction) || !renameValue.trim()}
							aria-busy={Boolean(pendingAction)}
						>
							{pendingAction && (
								<Loader2 className="size-4 animate-spin" aria-hidden="true" />
							)}
							{t("fileViewer.renameSlideDialogConfirm")}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	)
}

export default observer(SortableSlideItem)

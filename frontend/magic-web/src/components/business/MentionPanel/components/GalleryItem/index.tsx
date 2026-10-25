import { memo, useEffect, useState } from "react"
import SmartTooltip from "@/components/other/SmartTooltip"
import { Button } from "@/components/shadcn-ui/button"
import { cn } from "@/utils/cn"
import { Check, ChevronRight, FileText, Maximize2 } from "lucide-react"
import type { I18nTexts } from "../../i18n/types"
import {
	MentionCoreItemType,
	MentionItemType,
	type MentionItem,
	type ProjectFileMentionData,
} from "../../types"
import { useMentionItemRenderContextValue, useMentionItemRenderer } from "../../renderers/context"
import {
	getMentionProjectFileImageExtension,
	isMentionPanelImageFileExtension,
	isMentionPanelVideoFileExtension,
} from "../../runtime/builtin/domains/file-preview/preview-utils"
import MentionVideoPreview from "../MentionVideoPreview"

interface GalleryItemProps {
	item: MentionItem
	selected?: boolean
	onClick?: (event?: React.MouseEvent) => void
	onPreview?: (item: MentionItem) => void
	isSearch?: boolean
	t: I18nTexts
	showCheckbox?: boolean
	checkboxChecked?: boolean
	enablePreview?: boolean
}

function isFolderLikeItem(item: MentionItem) {
	return item.type === MentionCoreItemType.FOLDER || item.isFolder || item.hasChildren
}

function getProjectMediaPreview(
	item: MentionItem,
	filePreviewById: Readonly<Record<string, string>>,
) {
	if (item.type !== MentionItemType.PROJECT_FILE) {
		return { isImage: false, isVideo: false, previewUrl: undefined }
	}

	const data = item.data as ProjectFileMentionData | undefined
	const extension = getMentionProjectFileImageExtension(item)
	const isImage = isMentionPanelImageFileExtension(extension)
	const isVideo = isMentionPanelVideoFileExtension(extension)
	const previewUrl = data?.file_id ? filePreviewById[data.file_id] : undefined

	return { isImage, isVideo, previewUrl }
}

function getFileExtensionLabel(item: MentionItem) {
	if (item.type !== MentionItemType.PROJECT_FILE) return ""
	const extension = getMentionProjectFileImageExtension(item) || item.extension || ""
	return extension.replace(/^\./, "").slice(0, 5).toUpperCase()
}

const GalleryItem = memo(function GalleryItem(props: GalleryItemProps) {
	const {
		item,
		selected = false,
		onClick,
		onPreview,
		isSearch,
		t,
		showCheckbox,
		checkboxChecked,
		enablePreview,
	} = props
	const renderer = useMentionItemRenderer(item.type)
	const { filePreviewById = {}, filePresentationOptions } = useMentionItemRenderContextValue()
	const rendererContext = {
		item,
		t,
		isSearch,
		platform: "desktop" as const,
		filePreviewById,
		filePresentationOptions,
	}
	const { isImage, isVideo, previewUrl } = getProjectMediaPreview(item, filePreviewById)
	const isFolderLike = isFolderLikeItem(item)
	const isPreviewableMedia = isImage || isVideo
	const isDisabled = Boolean(item.unSelectable && !isFolderLike)
	const [imagePreviewFailed, setImagePreviewFailed] = useState(false)
	const [previewWaitExpired, setPreviewWaitExpired] = useState(false)

	const hasImagePreview = Boolean(previewUrl && !imagePreviewFailed)
	const showImageLoading = isImage && !previewUrl && !previewWaitExpired
	const canPreview = Boolean(enablePreview && hasImagePreview)
	const extensionLabel = getFileExtensionLabel(item)

	useEffect(() => {
		setImagePreviewFailed(false)
		setPreviewWaitExpired(false)

		if (!isImage || previewUrl) return

		const timeoutId = setTimeout(() => {
			setPreviewWaitExpired(true)
		}, 1500)

		return () => {
			clearTimeout(timeoutId)
		}
	}, [isImage, item.id, previewUrl])

	function handleClick(event?: React.MouseEvent) {
		if (isDisabled) {
			event?.preventDefault()
			event?.stopPropagation()
			return
		}

		event?.preventDefault()
		onClick?.(event)
	}

	function handlePreview(event: React.MouseEvent) {
		event.preventDefault()
		event.stopPropagation()
		if (!canPreview) return
		onPreview?.(item)
	}

	if (item.type === MentionItemType.TITLE) {
		return (
			<div className="col-span-full px-1 pt-1 font-['Geist'] text-[10px] leading-[13px] text-muted-foreground">
				{item.name}
			</div>
		)
	}

	if (item.type === MentionItemType.DIVIDER) {
		return <div className="col-span-full my-0.5 h-px bg-border" />
	}

	const fileFallback = (
		<div className="relative flex size-14 items-center justify-center rounded-md border bg-background text-muted-foreground shadow-sm">
			{renderer.renderIcon?.(rendererContext) ?? <FileText className="size-7" />}
			{extensionLabel && (
				<span className="absolute bottom-1 rounded-sm bg-muted px-1 text-[8px] font-medium leading-3 text-muted-foreground">
					{extensionLabel}
				</span>
			)}
		</div>
	)

	return (
		<div
			className={cn(
				"group/gallery-card relative flex h-[132px] min-w-0 cursor-pointer flex-col overflow-hidden rounded-md border bg-background transition-all duration-150",
				"hover:border-primary/40 hover:bg-accent/40 hover:shadow-sm",
				isFolderLike && "border-border/80 bg-muted/20 hover:bg-accent/50",
				!isPreviewableMedia && !isFolderLike && "bg-muted/10",
				selected && "border-primary/60 bg-accent shadow-sm ring-1 ring-primary/20",
				isDisabled &&
					"cursor-not-allowed opacity-55 hover:border-border hover:bg-background hover:shadow-none",
			)}
			onClick={handleClick}
			role="option"
			aria-selected={selected}
			aria-disabled={isDisabled}
			aria-label={`${t.ariaLabels.menuItem}: ${item.name}`}
			tabIndex={selected && !isDisabled ? 0 : -1}
			data-testid="mention-panel-gallery-item"
		>
			<div
				className={cn(
					"relative flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-muted/60",
					isFolderLike && "bg-muted/30",
					!isPreviewableMedia && !isFolderLike && "bg-muted/20",
				)}
			>
				{isVideo ? (
					<MentionVideoPreview item={item} fallback={fileFallback} />
				) : hasImagePreview ? (
					<img
						src={previewUrl}
						alt=""
						className="block h-full w-full object-contain"
						loading="eager"
						decoding="async"
						draggable={false}
						referrerPolicy="no-referrer"
						onError={() => setImagePreviewFailed(true)}
						data-testid="mention-panel-gallery-preview-image"
					/>
				) : showImageLoading ? (
					<div className="h-full w-full animate-pulse bg-muted motion-reduce:animate-none" />
				) : isFolderLike ? (
					<div className="flex size-14 items-center justify-center rounded-md border bg-background text-foreground shadow-sm transition-transform duration-150 group-hover/gallery-card:scale-[1.03]">
						{renderer.renderIcon?.(rendererContext)}
					</div>
				) : (
					fileFallback
				)}

				{showCheckbox && (
					<span
						className={cn(
							"absolute left-1.5 top-1.5 flex size-4 items-center justify-center rounded border transition-colors",
							checkboxChecked
								? "border-primary bg-primary text-primary-foreground"
								: "border-border bg-background/90 text-transparent",
						)}
						aria-hidden
						data-testid="mention-panel-gallery-item-checkbox"
						data-checked={checkboxChecked ? "true" : "false"}
					>
						<Check className="size-3" strokeWidth={2.5} />
					</span>
				)}

				{canPreview && (
					<Button
						type="button"
						variant="secondary"
						size="icon"
						className="absolute right-1.5 top-1.5 size-6 rounded bg-background/90 text-foreground opacity-0 shadow-sm transition-opacity hover:bg-background group-hover/gallery-card:opacity-100"
						onClick={handlePreview}
						tabIndex={-1}
						aria-label={`${t.ariaLabels.previewImage}: ${item.name}`}
						data-testid="mention-panel-gallery-preview-button"
					>
						<Maximize2 className="size-3.5" />
					</Button>
				)}
			</div>

			<div
				className={cn(
					"flex h-9 min-w-0 items-center gap-1.5 border-t px-2",
					isFolderLike && "bg-background/80",
				)}
			>
				<span className="min-w-0 flex-1">
					<SmartTooltip
						className={cn(
							"block w-full min-w-0 overflow-hidden text-ellipsis whitespace-nowrap font-['Geist'] text-xs leading-4",
							isDisabled ? "text-muted-foreground" : "text-foreground",
						)}
						content={
							<span className="block max-w-[220px] whitespace-normal break-all">
								{item.name}
							</span>
						}
						elementType="span"
						placement="bottom"
						sideOffset={6}
					>
						{item.name}
					</SmartTooltip>
				</span>
				{isFolderLike && (
					<Button
						type="button"
						variant="ghost"
						size="icon"
						className="flex size-5 shrink-0 rounded-full p-0 text-muted-foreground transition-colors group-hover/gallery-card:bg-background group-hover/gallery-card:text-foreground"
						tabIndex={-1}
						aria-label={`${t.navigationActions.enter}: ${item.name}`}
						data-right-arrow
						data-testid="mention-panel-gallery-enter-folder-trigger"
					>
						<ChevronRight className="size-3.5" />
					</Button>
				)}
			</div>
		</div>
	)
})

GalleryItem.displayName = "GalleryItem"

export default GalleryItem

import { lazy, Suspense, useMemo } from "react"
import { Dialog, DialogContent, DialogTitle } from "@/components/shadcn-ui/dialog"
import { cn } from "@/utils/cn"
import { MentionItemType, type MentionItem, type ProjectFileMentionData } from "../../types"
import { useMentionItemRenderContextValue } from "../../renderers/context"
import {
	getMentionProjectFileImageExtension,
	isMentionPanelImageFileExtension,
} from "../../runtime/builtin/domains/file-preview/preview-utils"

const MagicImagePreview = lazy(() => import("@/components/base/MagicImagePreview"))

export const MENTION_PANEL_GALLERY_PREVIEW_LAYER_CLASS = "mention-panel-gallery-preview-layer"

/**
 * 判断是否为 MentionPanel Gallery Preview 的 target
 * @param target - 事件目标
 * @returns 是否为 MentionPanel Gallery Preview 的 target
 */
export function isMentionPanelGalleryPreviewTarget(target: EventTarget | null) {
	if (!(target instanceof Element)) return false
	return Boolean(target.closest(`.${MENTION_PANEL_GALLERY_PREVIEW_LAYER_CLASS}`))
}

interface GalleryPreviewDialogProps {
	item: MentionItem | null
	items: MentionItem[]
	onItemChange: (item: MentionItem | null) => void
}

function getProjectImagePreviewUrl(
	item: MentionItem,
	filePreviewById: Readonly<Record<string, string>>,
) {
	if (item.type !== MentionItemType.PROJECT_FILE) return undefined

	const data = item.data as ProjectFileMentionData | undefined
	if (!data?.file_id) return undefined

	if (!isMentionPanelImageFileExtension(getMentionProjectFileImageExtension(item))) {
		return undefined
	}

	return filePreviewById[data.file_id]
}

export default function GalleryPreviewDialog(props: GalleryPreviewDialogProps) {
	const { item, items, onItemChange } = props
	const { filePreviewById = {} } = useMentionItemRenderContextValue()
	const previewableItems = useMemo(
		() => items.filter((candidate) => getProjectImagePreviewUrl(candidate, filePreviewById)),
		[items, filePreviewById],
	)
	const currentIndex = item
		? previewableItems.findIndex((candidate) => candidate.id === item.id)
		: -1
	const previewUrl = item ? getProjectImagePreviewUrl(item, filePreviewById) : undefined
	const open = Boolean(item && previewUrl)

	function handleOpenChange(nextOpen: boolean) {
		if (!nextOpen) onItemChange(null)
	}

	function handlePrev() {
		if (currentIndex <= 0) return
		onItemChange(previewableItems[currentIndex - 1] ?? null)
	}

	function handleNext() {
		if (currentIndex < 0 || currentIndex >= previewableItems.length - 1) return
		onItemChange(previewableItems[currentIndex + 1] ?? null)
	}

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			{open && item && previewUrl && (
				<DialogContent
					className={cn(
						MENTION_PANEL_GALLERY_PREVIEW_LAYER_CLASS,
						"h-[min(720px,calc(100vh-48px))] w-[min(960px,calc(100vw-48px))] max-w-none overflow-hidden border-0 bg-background p-0",
					)}
					overlayClassName={MENTION_PANEL_GALLERY_PREVIEW_LAYER_CLASS}
					showCloseButton
					aria-describedby={undefined}
				>
					<DialogTitle className="sr-only">{item.name}</DialogTitle>
					<Suspense fallback={<div className="h-full w-full animate-pulse bg-muted" />}>
						<MagicImagePreview
							rootClassName="h-full w-full"
							onPrev={previewableItems.length > 1 ? handlePrev : undefined}
							onNext={previewableItems.length > 1 ? handleNext : undefined}
							prevDisabled={currentIndex <= 0}
							nextDisabled={currentIndex >= previewableItems.length - 1}
						>
							<img
								src={previewUrl}
								alt={item.name}
								draggable={false}
								className="block h-full w-full object-contain"
								referrerPolicy="no-referrer"
							/>
						</MagicImagePreview>
					</Suspense>
				</DialogContent>
			)}
		</Dialog>
	)
}

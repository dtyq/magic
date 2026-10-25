import { cn } from "@/utils/cn"
import { X } from "lucide-react"
import type { I18nTexts } from "../../i18n/types"
import { useMentionItemRenderContextValue } from "../../renderers/context"
import { MentionPanelFileImageIcon } from "../../runtime/builtin/domains/file-preview/MentionPanelFileImageIcon"
import {
	getMentionProjectFileImageExtension,
	isMentionPanelVideoFileExtension,
} from "../../runtime/builtin/domains/file-preview/preview-utils"
import { MentionItemType } from "../../types"
import { getMentionItemSelectionKey, type PendingMentionEntry } from "../../utils/multiSelect"
import { SELECTED_ITEM_CARD_SIZE } from "../../utils/panelSize"
import MentionVideoPreview from "../MentionVideoPreview"

interface SelectedItemsStripProps {
	entries: PendingMentionEntry[]
	isGalleryMode: boolean
	t: I18nTexts
	onRemove: (selectionKey: string) => void
}

function SelectedItemCard(props: {
	entry: PendingMentionEntry
	selectionKey: string
	isGalleryMode: boolean
	t: I18nTexts
	onRemove: (selectionKey: string) => void
}) {
	const { entry, selectionKey, isGalleryMode, t, onRemove } = props
	const { item } = entry
	const { filePreviewById, filePresentationOptions } = useMentionItemRenderContextValue()
	const cardSize = isGalleryMode ? SELECTED_ITEM_CARD_SIZE.gallery : SELECTED_ITEM_CARD_SIZE.list
	const rendererContext = {
		item,
		t,
		platform: "desktop" as const,
		filePreviewById,
		filePresentationOptions,
	}
	const isVideo =
		item.type === MentionItemType.PROJECT_FILE &&
		isMentionPanelVideoFileExtension(getMentionProjectFileImageExtension(item))
	const thumbnailFallback = (
		<MentionPanelFileImageIcon
			context={rendererContext}
			iconSize={cardSize}
			imageFit="contain"
		/>
	)

	return (
		<div
			className="group/selected-item relative shrink-0 overflow-hidden rounded-md bg-muted/40 ring-1 ring-border"
			style={{ width: cardSize, height: cardSize }}
			title={item.name}
			data-testid="mention-panel-selected-item"
			data-size={isGalleryMode ? "gallery" : "list"}
		>
			<div className="flex h-full w-full items-center justify-center">
				{isVideo ? (
					<MentionVideoPreview item={item} fallback={thumbnailFallback} />
				) : (
					thumbnailFallback
				)}
			</div>
			<button
				type="button"
				className={cn(
					"absolute right-0.5 top-0.5 z-[1] flex size-4 items-center justify-center rounded-full bg-foreground/80 text-background opacity-0 shadow-sm transition-opacity",
					"group-focus-within/selected-item:opacity-100 group-hover/selected-item:opacity-100",
				)}
				onClick={(event) => {
					event.preventDefault()
					event.stopPropagation()
					onRemove(selectionKey)
				}}
				tabIndex={-1}
				aria-label={`${t.ariaLabels.removeSelectedItem}: ${item.name}`}
				data-testid="mention-panel-selected-item-remove"
			>
				<X className="size-2.5" strokeWidth={2.5} />
			</button>
		</div>
	)
}

export default function SelectedItemsStrip(props: SelectedItemsStripProps) {
	const { entries, isGalleryMode, t, onRemove } = props

	return (
		<div
			className="no-scrollbar mx-1 mb-1 flex min-w-0 items-center gap-1.5 overflow-x-auto px-1 py-1"
			role="list"
			aria-label={t.ariaLabels.viewSelectedItems}
			data-testid="mention-panel-selected-items"
		>
			{entries.map((entry) => {
				const selectionKey = getMentionItemSelectionKey(entry.item)
				return (
					<div key={selectionKey} role="listitem">
						<SelectedItemCard
							entry={entry}
							selectionKey={selectionKey}
							isGalleryMode={isGalleryMode}
							t={t}
							onRemove={onRemove}
						/>
					</div>
				)
			})}
		</div>
	)
}

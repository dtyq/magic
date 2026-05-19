import { useCallback, useEffect, useRef } from "react"
import { cn } from "@/lib/utils"
import CardFrame from "../../components/CardFrame"
import { CardActionStrip } from "../../components/CardActionStrip"
import { CARD_THUMBNAIL_IMAGE_PROCESS } from "../../constants/imageProcess"
import type { SelfMediaAttachmentNode, SelfMediaCard, SelfMediaPost } from "../../types"
import { handleSelfMediaCardDragStart } from "@/pages/superMagic/components/MessageEditor/utils/drag"

interface RednoteEditThumbnailSidebarProps {
	post: SelfMediaPost
	activeCardIndex: number
	attachmentList?: SelfMediaAttachmentNode[]
	postRefreshVersion: number
	cardRefreshVersions: Record<number, number>
	onSelectCard: (index: number) => void
	onRefreshCard: (index: number) => void
	onAddCardToCurrentChat?: (index: number) => void
	onBeforeOpenVersionHistory?: () => Promise<boolean>
}

export function RednoteEditThumbnailSidebar({
	post,
	activeCardIndex,
	attachmentList,
	postRefreshVersion,
	cardRefreshVersions,
	onSelectCard,
	onRefreshCard,
	onAddCardToCurrentChat,
	onBeforeOpenVersionHistory,
}: RednoteEditThumbnailSidebarProps) {
	const cardButtonRefs = useRef<(HTMLButtonElement | null)[]>([])

	useEffect(() => {
		cardButtonRefs.current[activeCardIndex]?.scrollIntoView?.({
			behavior: "smooth",
			block: "nearest",
		})
	}, [activeCardIndex])

	const handleCardDragStart = useCallback(
		(e: React.DragEvent, card: SelfMediaCard) => {
			if (!card.fileId) return
			const findAttachment = (
				nodes?: SelfMediaAttachmentNode[],
			): SelfMediaAttachmentNode | undefined => {
				if (!nodes) return undefined
				for (const node of nodes) {
					if (node.file_id === card.fileId) return node
					const found = findAttachment(node.children)
					if (found) return found
				}
				return undefined
			}
			const attachment = findAttachment(attachmentList)
			const fileName = attachment?.file_name || card.path.split("/").pop() || ""
			const filePath = attachment?.relative_file_path || card.path
			const fileExtension = fileName.includes(".") ? (fileName.split(".").pop() ?? "") : ""
			handleSelfMediaCardDragStart(e, {
				file_id: card.fileId,
				file_name: fileName,
				relative_file_path: filePath,
				file_extension: fileExtension,
			})
		},
		[attachmentList],
	)

	return (
		<div
			className="flex w-[200px] flex-shrink-0 flex-col border-r border-border bg-background"
			data-testid="red-edit-thumbnail-sidebar"
		>
			<div className="scrollbar-hide flex-1 overflow-y-auto p-2">
				{post.cards.map((card, idx) => (
					<div key={card.fileId || idx} className="mb-2 flex items-start gap-1">
						{/* Thumbnail button */}
						<button
							type="button"
							ref={(node) => {
								cardButtonRefs.current[idx] = node
							}}
							draggable={!!card.fileId}
							onDragStart={(e) => handleCardDragStart(e, card)}
							onClick={() => onSelectCard(idx)}
							data-testid={`red-edit-card-thumb-${idx}`}
							className={cn(
								"min-w-0 flex-1 cursor-pointer rounded-md border-2 p-0.5 text-left transition",
								idx === activeCardIndex
									? "border-[#ff2442]"
									: "border-transparent hover:border-border",
							)}
						>
							<div className="relative aspect-[3/4] w-full overflow-hidden rounded">
								<CardFrame
									cardId={`edit-thumb-${post.meta.id}-${idx}-${postRefreshVersion}-${cardRefreshVersions[idx] ?? 0}`}
									fileId={card.fileId}
									version={card.version}
									attachmentList={attachmentList}
									imageProcessOptions={CARD_THUMBNAIL_IMAGE_PROCESS}
									className="pointer-events-none h-full w-full"
									style={{ height: "100%" }}
								/>
							</div>
							<div className="mt-1 truncate text-center text-[11px] text-muted-foreground">
								{idx + 1}
							</div>
						</button>

						{/* Action buttons strip */}
						<CardActionStrip
							className="pt-1"
							onAddToCurrentChat={
								onAddCardToCurrentChat
									? () => onAddCardToCurrentChat(idx)
									: undefined
							}
							onRefresh={() => onRefreshCard(idx)}
							fileId={card.fileId}
							attachmentList={attachmentList}
							onBeforeOpenVersionHistory={onBeforeOpenVersionHistory}
							testIdPrefix={`red-edit-card-${idx}`}
						/>
					</div>
				))}
			</div>
		</div>
	)
}

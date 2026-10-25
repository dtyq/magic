import { memo, useCallback, useState } from "react"
import { motion } from "framer-motion"
import { cn } from "@/utils/cn"
import { useTranslation } from "react-i18next"
import AICardIframe from "./AICardIframe"
import type { AICardEntry } from "../types"

interface AICardTileProps {
	card: AICardEntry
	attachmentList?: any[]
	onOpen: (cardId: string) => void
	onOpenHistory: (cardId: string) => void
}

const statusColors = {
	active: "bg-green-500",
	paused: "bg-yellow-500",
	error: "bg-red-500",
	loading: "bg-blue-500",
}

function AICardTile({ card, attachmentList, onOpen, onOpenHistory }: AICardTileProps) {
	const { t } = useTranslation("super")
	const [hovered, setHovered] = useState(false)

	const handleClick = useCallback(() => {
		onOpen(card.id)
	}, [onOpen, card.id])

	const handleHistoryClick = useCallback(
		(e: React.MouseEvent) => {
			e.stopPropagation()
			onOpenHistory(card.id)
		},
		[onOpenHistory, card.id],
	)

	return (
		<motion.div
			layout
			layoutId={`ai-card-tile-${card.id}`}
			initial={{ opacity: 0, y: 20 }}
			animate={{ opacity: 1, y: 0 }}
			exit={{ opacity: 0, y: -10 }}
			whileHover={{ scale: 1.02, boxShadow: "0 8px 30px rgba(0,0,0,0.08)" }}
			whileTap={{ scale: 0.98 }}
			className={cn(
				"group relative cursor-pointer overflow-hidden rounded-xl border border-border bg-card transition-colors",
				"hover:border-primary/30",
			)}
			onMouseEnter={() => setHovered(true)}
			onMouseLeave={() => setHovered(false)}
			onClick={handleClick}
		>
			{/* Card preview area */}
			<div className="relative h-[200px] overflow-hidden rounded-t-xl bg-muted/30">
				{card.latestHtmlFileId ? (
					<AICardIframe
						fileId={card.latestHtmlFileId}
						attachmentList={attachmentList}
						className="h-full w-full"
						hideVerticalScroll
						showSkeleton
					/>
				) : (
					<div className="flex h-full w-full items-center justify-center text-4xl opacity-30">
						🃏
					</div>
				)}

				{/* Hover overlay with actions */}
				<motion.div
					initial={{ opacity: 0 }}
					animate={{ opacity: hovered ? 1 : 0 }}
					transition={{ duration: 0.15 }}
					className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-[2px]"
				>
					<span className="rounded-full bg-white/90 px-4 py-2 text-sm font-medium text-gray-800 shadow-sm">
						{t("detail.aiCard.tile.viewDetail")}
					</span>
				</motion.div>
			</div>

			{/* Card info */}
			<div className="p-4">
				<div className="flex items-center gap-2">
					<span
						className={cn(
							"h-2 w-2 rounded-full",
							statusColors[card.status] || statusColors.active,
						)}
					/>
					<h3 className="truncate text-sm font-semibold text-foreground">{card.name}</h3>
				</div>
				{card.description && (
					<p className="mt-1 truncate text-xs text-muted-foreground">
						{card.description}
					</p>
				)}
				<div className="mt-3 flex items-center justify-between">
					<span className="text-xs text-muted-foreground">
						{card.lastUpdated
							? new Date(card.lastUpdated).toLocaleString(undefined, {
									month: "short",
									day: "numeric",
									hour: "2-digit",
									minute: "2-digit",
								})
							: "—"}
					</span>
					<button
						type="button"
						onClick={handleHistoryClick}
						className="rounded px-2 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
						data-testid="handle-history-click"
					>
						{t("detail.aiCard.tile.history")}
					</button>
				</div>
			</div>
		</motion.div>
	)
}

export default memo(AICardTile)

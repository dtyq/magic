import { memo } from "react"
import { motion } from "framer-motion"
import { useTranslation } from "react-i18next"
import { Clock3 } from "lucide-react"
import { cn } from "@/utils/cn"
import AICardIframe from "./AICardIframe"
import type { AICardHistoryEntry } from "../types"
import type { AICardAttachmentNode, AICardDashboardItem } from "../utils/aiCardDashboardItems"

interface DashboardCardProps {
	item: AICardDashboardItem
	index: number
	variant: "featured" | "timeline"
	isActive?: boolean
	attachmentList?: AICardAttachmentNode[]
	selectedProject?: { id?: string; name?: string } | null
	onOpenCard: (cardId: string) => void
	onOpenHistoryEntry?: (entry: AICardHistoryEntry) => void
}

function AICardDashboardCard({
	item,
	index,
	variant,
	isActive = false,
	attachmentList,
	selectedProject,
	onOpenCard,
	onOpenHistoryEntry,
}: DashboardCardProps) {
	const { t } = useTranslation("super")

	function handleClick() {
		if (item.kind === "latest" && item.cardId) {
			onOpenCard(item.cardId)
			return
		}

		if (item.historyEntry) onOpenHistoryEntry?.(item.historyEntry)
	}

	return (
		<motion.button
			type="button"
			initial={{ opacity: 0, y: 12 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ delay: Math.min(index * 0.03, 0.3) }}
			onClick={handleClick}
			className={cn(
				"group relative flex aspect-[9/16] w-full overflow-hidden bg-card text-left transition-all duration-500 ease-out",
				"hover:-translate-y-1.5 focus:outline-none focus:ring-2 focus:ring-primary/30",
				variant === "featured" &&
					"max-w-[360px] rounded-[24px] border border-primary/25 shadow-[0_24px_70px_rgb(0,0,0,0.18)] hover:border-primary/45 hover:shadow-[0_30px_80px_rgb(0,0,0,0.22)]",
				variant === "timeline" &&
					cn(
						"max-w-[320px] rounded-[22px] border shadow-[0_12px_32px_rgb(0,0,0,0.08)] hover:border-primary/35 hover:shadow-[0_20px_52px_rgb(0,0,0,0.14)]",
						isActive ? "border-primary/45" : "border-border/70",
					),
			)}
			data-testid="ai-card-dashboard-card"
			data-variant={variant}
			data-active={isActive ? "true" : "false"}
			data-card-id={item.fileId}
		>
			<LatestCardPreview
				item={item}
				attachmentList={attachmentList}
				selectedProject={selectedProject}
			/>

			<div className="absolute inset-x-3 top-3 z-20 flex justify-end">
				<div className="rounded-full border border-white/20 bg-white/15 px-2 py-0.5 text-[10px] font-medium text-white/90 shadow-sm backdrop-blur-md">
					#{String(index + 1).padStart(2, "0")}
				</div>
			</div>

			<div
				className={cn(
					"absolute inset-x-0 bottom-0 z-20 flex translate-y-1.5 flex-col gap-2 transition-transform duration-500 ease-out group-hover:translate-y-0",
					variant === "featured" ? "p-5 sm:p-6" : "p-4",
				)}
			>
				<div className="flex items-start justify-between gap-2">
					<div className="min-w-0">
						<h3
							className={cn(
								"truncate font-semibold tracking-tight text-white drop-shadow-sm",
								variant === "featured" ? "text-lg sm:text-xl" : "text-sm",
							)}
						>
							{item.title}
						</h3>
						{item.description && (
							<p
								className={cn(
									"mt-1 line-clamp-2 leading-relaxed text-white/90 drop-shadow-sm",
									variant === "featured" ? "text-sm" : "text-xs",
								)}
							>
								{item.description}
							</p>
						)}
					</div>
				</div>
				<div className="mt-0.5 flex items-center justify-between gap-2 text-[10px] text-white/80">
					<span className="flex min-w-0 items-center gap-1 font-medium drop-shadow-sm">
						<Clock3 size={variant === "featured" ? 13 : 11} className="shrink-0" />
						<span className="truncate">{formatDateTime(item.createdAt)}</span>
					</span>
					{item.kind === "latest" ? (
						<span className="flex-shrink-0 rounded-full bg-primary px-2 py-0.5 font-medium text-primary-foreground shadow-sm">
							{t("detail.aiCard.dashboard.current")}
						</span>
					) : (
						<span className="flex-shrink-0 rounded-full border border-white/30 bg-white/20 px-2 py-0.5 font-medium text-white shadow-sm backdrop-blur-md">
							{t("detail.aiCard.dashboard.archived")}
						</span>
					)}
				</div>
			</div>
		</motion.button>
	)
}

function LatestCardPreview({
	item,
	attachmentList,
	selectedProject,
}: {
	item: AICardDashboardItem
	attachmentList?: AICardAttachmentNode[]
	selectedProject?: { id?: string; name?: string } | null
}) {
	return (
		<>
			<div className="absolute inset-0 z-0 bg-muted/20 transition-transform duration-700 ease-out group-hover:scale-105">
				<AICardIframe
					fileId={item.fileId}
					attachmentList={attachmentList}
					selectedProject={selectedProject}
					className="pointer-events-none h-full w-full [&_iframe]:h-full [&_iframe]:w-full"
					hideVerticalScroll
					showSkeleton
				/>
			</div>
			<div className="absolute inset-x-5 top-0 z-10 h-px bg-gradient-to-r from-transparent via-white/70 to-transparent" />
			<div className="absolute inset-0 z-10 bg-gradient-to-t from-black/90 via-black/25 to-transparent opacity-75 transition-opacity duration-500 group-hover:opacity-90" />
			<div className="absolute inset-0 z-10 bg-gradient-to-br from-white/20 via-transparent to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
		</>
	)
}

export function formatDateTime(value?: string) {
	if (!value) return "-"

	const date = new Date(value)
	if (Number.isNaN(date.getTime())) return "-"

	return date.toLocaleString(undefined, {
		month: "short",
		day: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	})
}

export default memo(AICardDashboardCard)

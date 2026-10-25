import { memo } from "react"
import { motion } from "framer-motion"
import { useTranslation } from "react-i18next"
import { Archive, ArrowUpRight, Clock3, Layers3 } from "lucide-react"
import { cn } from "@/utils/cn"
import type { AICardHistoryEntry } from "../types"
import type { AICardDashboardItem } from "../utils/aiCardDashboardItems"
import { formatDateTime } from "./AICardDashboardCard"

interface AICardHistorySummaryCardProps {
	item: AICardDashboardItem
	index: number
	isActive?: boolean
	onOpenHistoryEntry?: (entry: AICardHistoryEntry) => void
}

const HISTORY_CARD_TONES = [
	{
		name: "slate",
		surface: "from-slate-50 via-white to-slate-100",
		accent: "bg-slate-900",
		soft: "bg-slate-100",
		chip: "bg-slate-900/75",
	},
	{
		name: "emerald",
		surface: "from-emerald-50 via-white to-slate-100",
		accent: "bg-emerald-600",
		soft: "bg-emerald-100/80",
		chip: "bg-emerald-900/70",
	},
	{
		name: "amber",
		surface: "from-amber-50 via-white to-stone-100",
		accent: "bg-amber-500",
		soft: "bg-amber-100/85",
		chip: "bg-stone-900/70",
	},
	{
		name: "sky",
		surface: "from-sky-50 via-white to-slate-100",
		accent: "bg-sky-500",
		soft: "bg-sky-100/80",
		chip: "bg-slate-900/70",
	},
]

function AICardHistorySummaryCard({
	item,
	index,
	isActive = false,
	onOpenHistoryEntry,
}: AICardHistorySummaryCardProps) {
	const { t } = useTranslation("super")
	const tone = HISTORY_CARD_TONES[index % HISTORY_CARD_TONES.length]

	function handleClick() {
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
				"group relative flex aspect-[5/6] w-full overflow-hidden rounded-[22px] border bg-gradient-to-br text-left transition-all duration-500 ease-out",
				tone.surface,
				"hover:-translate-y-1 focus:outline-none focus:ring-2 focus:ring-primary/25",
				isActive
					? "border-primary/40 shadow-[0_16px_38px_rgb(15,23,42,0.14)]"
					: "border-border/80 shadow-[0_10px_26px_rgb(15,23,42,0.08)] hover:border-primary/30 hover:shadow-[0_16px_38px_rgb(15,23,42,0.12)]",
			)}
			data-active={isActive ? "true" : "false"}
			data-card-id={item.fileId}
			data-testid="ai-card-dashboard-history-card"
			data-tone={tone.name}
		>
			<div
				aria-hidden="true"
				className="absolute inset-0 bg-[linear-gradient(rgba(15,23,42,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,0.035)_1px,transparent_1px)] bg-[size:22px_22px]"
			/>
			<div
				aria-hidden="true"
				className="from-neutral-950/82 via-neutral-950/36 absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t to-transparent"
			/>
			<div className="absolute inset-x-4 top-4 flex items-center justify-between">
				<span
					className={cn(
						"flex size-8 items-center justify-center rounded-full text-white",
						tone.accent,
					)}
				>
					<Archive size={15} />
				</span>
				<span className="rounded-full border border-white/70 bg-white/70 px-2 py-0.5 text-[10px] font-semibold text-neutral-600 shadow-sm backdrop-blur">
					#{String(index + 1).padStart(2, "0")}
				</span>
			</div>

			<div className="absolute left-4 right-4 top-16 rounded-2xl border border-white/75 bg-white/80 p-3 shadow-sm backdrop-blur">
				<div className="flex items-center justify-between gap-3">
					<span className="text-xs font-semibold text-neutral-600">
						{t("detail.aiCard.dashboard.historyPreviewTitle")}
					</span>
					<Layers3 size={14} className="text-neutral-400" />
				</div>
				<div className="mt-3 text-2xl font-semibold leading-none tracking-normal text-neutral-950">
					{formatShortDisplayDate(item.createdAt)}
				</div>
				<div className="mt-4 grid grid-cols-3 gap-1.5">
					<span className={cn("h-10 rounded-lg", tone.soft)} />
					<span className="h-10 rounded-lg bg-neutral-100" />
					<span
						className={cn(
							"h-10 rounded-lg",
							index % 2 === 0 ? "bg-slate-100" : tone.soft,
						)}
					/>
				</div>
				<div className="mt-3 space-y-1.5">
					<span className="block h-1.5 w-4/5 rounded-full bg-neutral-200/90" />
					<span className="block h-1.5 w-3/5 rounded-full bg-neutral-100" />
				</div>
			</div>

			<div className="text-white/86 absolute inset-x-4 bottom-14 flex min-w-0 items-center gap-2">
				<Clock3 size={13} className="shrink-0" />
				<span className="truncate text-xs font-medium">
					{formatDateTime(item.createdAt)}
				</span>
			</div>
			<div className="absolute inset-x-4 bottom-4 flex items-center justify-between gap-3">
				<span
					className={cn(
						"rounded-full px-2.5 py-1 text-xs font-medium text-white shadow-sm backdrop-blur",
						tone.chip,
					)}
				>
					{t("detail.aiCard.dashboard.archived")}
				</span>
				<span className="bg-white/16 flex items-center gap-1 rounded-full border border-white/20 px-2.5 py-1 text-xs font-medium text-white shadow-sm backdrop-blur">
					{t("detail.aiCard.dashboard.openHistoryVersion")}
					<ArrowUpRight size={13} />
				</span>
			</div>
		</motion.button>
	)
}

function formatShortDisplayDate(value?: string) {
	if (!value) return "-"

	const date = new Date(value)
	if (Number.isNaN(date.getTime())) return "-"

	return date.toLocaleDateString(undefined, {
		month: "short",
		day: "numeric",
	})
}

export default memo(AICardHistorySummaryCard)

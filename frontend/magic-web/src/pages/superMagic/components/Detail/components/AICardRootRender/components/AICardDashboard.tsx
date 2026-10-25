import { memo, useMemo, useRef } from "react"
import { motion } from "framer-motion"
import { useTranslation } from "react-i18next"
import {
	Bot,
	CalendarClock,
	Clock3,
	Loader2,
	Play,
	Settings,
	Sparkles,
	type LucideIcon,
} from "lucide-react"
import { cn } from "@/utils/cn"
import AICardDashboardCard, { formatDateTime } from "./AICardDashboardCard"
import AICardDashboardHistoryTimeline from "./AICardDashboardHistoryTimeline"
import type { AICardEntry, AICardHistoryEntry, AICardProjectConfig } from "../types"
import {
	buildAICardDashboardItems,
	type AICardAttachmentNode,
	type AICardDashboardItem,
} from "../utils/aiCardDashboardItems"

/**
 * Compute a fingerprint for only the relevant file nodes (by checking existence).
 * Only reacts when the set of relevant files in the tree actually changes.
 */
function computeRelevantFingerprint(
	list: AICardAttachmentNode[] | undefined,
	fileIds: Set<string>,
): string {
	if (!list?.length || fileIds.size === 0) return ""
	const found: string[] = []
	const stack = [...list]
	while (stack.length > 0) {
		const node = stack.pop()
		if (!node) continue
		if (node.file_id && fileIds.has(node.file_id)) {
			found.push(node.file_id)
		}
		if (node.children?.length) stack.push(...node.children)
	}
	found.sort()
	return found.join(",")
}

/**
 * Returns a stable reference to attachmentList that only updates
 * when the set of relevant file_ids (those the dashboard cares about) changes.
 */
function useStableAttachmentList(
	attachmentList: AICardAttachmentNode[] | undefined,
	relevantFileIds: Set<string>,
) {
	const stableRef = useRef(attachmentList)
	const fingerprintRef = useRef("")

	const fingerprint = computeRelevantFingerprint(attachmentList, relevantFileIds)
	if (fingerprint !== fingerprintRef.current) {
		fingerprintRef.current = fingerprint
		stableRef.current = attachmentList
	}

	return stableRef.current
}

type DashboardTranslate = (key: string, values?: Record<string, unknown>) => string

function buildHeaderMetaItems(
	projectConfig: AICardProjectConfig | null | undefined,
	t: DashboardTranslate,
) {
	const scheduleText = formatScheduleSummary(projectConfig?.time_config, t)
	const modelText = formatModelSummary(projectConfig, t)
	const items: Array<{ key: string; text: string; icon: LucideIcon }> = []

	if (scheduleText) {
		items.push({
			key: "schedule",
			text: scheduleText,
			icon: CalendarClock,
		})
	}
	if (modelText) {
		items.push({
			key: "model",
			text: modelText,
			icon: Bot,
		})
	}

	return items
}

interface AICardDashboardProps {
	cards: AICardEntry[]
	historyEntries: AICardHistoryEntry[]
	projectConfig?: AICardProjectConfig | null
	attachmentList?: AICardAttachmentNode[]
	selectedProject?: { id?: string; name?: string } | null
	onOpenCard: (cardId: string) => void
	onOpenConfig?: () => void
	onRunNow?: () => void
	isRunNowLoading?: boolean
	onOpenHistoryEntry?: (entry: AICardHistoryEntry) => void
}

function AICardDashboard({
	cards,
	historyEntries,
	projectConfig,
	attachmentList,
	selectedProject,
	onOpenCard,
	onOpenConfig,
	onRunNow,
	isRunNowLoading = false,
	onOpenHistoryEntry,
}: AICardDashboardProps) {
	const { t } = useTranslation("super")
	const headerMetaItems = useMemo(
		() => buildHeaderMetaItems(projectConfig, t),
		[projectConfig, t],
	)
	// Collect file IDs that the dashboard actually uses
	const relevantFileIds = useMemo(() => {
		const ids = new Set<string>()
		for (const card of cards) {
			if (card.latestHtmlFileId) ids.add(card.latestHtmlFileId)
		}
		for (const entry of historyEntries) {
			if (entry.fileId) ids.add(entry.fileId)
		}
		return ids
	}, [cards, historyEntries])

	// Stabilize attachmentList: only treat as changed when relevant file_ids change
	const stableAttachmentList = useStableAttachmentList(attachmentList, relevantFileIds)

	const dashboardItems = useMemo(
		() =>
			buildAICardDashboardItems({
				cards,
				historyEntries,
				attachmentList: stableAttachmentList,
			}),
		[cards, historyEntries, stableAttachmentList],
	)
	const { latestItems, historyItems } = useMemo(() => {
		const latest: AICardDashboardItem[] = []
		const history: AICardDashboardItem[] = []
		for (const item of dashboardItems) {
			if (item.kind === "latest") latest.push(item)
			else history.push(item)
		}
		return { latestItems: latest, historyItems: history }
	}, [dashboardItems])

	if (cards.length === 0) {
		return (
			<motion.div
				initial={{ opacity: 0, scale: 0.95 }}
				animate={{ opacity: 1, scale: 1 }}
				transition={{ duration: 0.3 }}
				className="flex h-full flex-col items-center justify-center gap-4 p-8"
				data-testid="ai-card-dashboard-loading"
			>
				<div className="text-6xl opacity-40">🃏</div>
				<div className="text-center">
					<h3 className="text-lg font-semibold text-foreground">
						{t("detail.aiCard.dashboard.loading")}
					</h3>
					<p className="mt-1 text-sm text-muted-foreground">
						{t("detail.aiCard.dashboard.loadingDescription")}
					</p>
				</div>
			</motion.div>
		)
	}

	const card = cards[0]

	return (
		<motion.div
			initial={{ opacity: 0, y: 10 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ duration: 0.3 }}
			className="relative flex h-full flex-col overflow-hidden bg-muted/20"
			data-testid="ai-card-dashboard"
		>
			<div className="pointer-events-none absolute inset-x-0 top-0 h-36 bg-gradient-to-b from-primary/10 to-transparent" />
			{/* Header */}
			<div className="relative z-10 flex flex-wrap items-center justify-between gap-3 border-b border-border/70 bg-background/80 px-4 py-3 backdrop-blur-xl">
				<div className="min-w-0">
					<h2 className="truncate text-lg font-bold text-foreground">{card.name}</h2>
					{card.description && (
						<p className="line-clamp-2 text-sm text-muted-foreground">
							{card.description}
						</p>
					)}
				</div>
			</div>

			<div className="relative z-10 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
				{dashboardItems.length > 0 ? (
					<div className="space-y-7" data-testid="ai-card-dashboard-card-grid">
						<LatestSection
							items={latestItems}
							card={card}
							headerMetaItems={headerMetaItems}
							attachmentList={stableAttachmentList}
							selectedProject={selectedProject}
							onOpenCard={onOpenCard}
							onOpenConfig={onOpenConfig}
							onRunNow={onRunNow}
							isRunNowLoading={isRunNowLoading}
							onOpenHistoryEntry={onOpenHistoryEntry}
						/>
						<AICardDashboardHistoryTimeline
							items={historyItems}
							onOpenHistoryEntry={onOpenHistoryEntry}
						/>
					</div>
				) : (
					<div
						className="flex h-full min-h-[280px] items-center justify-center rounded-xl border border-dashed border-border text-sm text-muted-foreground"
						data-testid="ai-card-dashboard-empty"
					>
						{t("detail.aiCard.dashboard.empty")}
					</div>
				)}
			</div>
		</motion.div>
	)
}

interface DashboardSectionProps {
	items: AICardDashboardItem[]
	attachmentList?: AICardAttachmentNode[]
	selectedProject?: { id?: string; name?: string } | null
	onOpenCard: (cardId: string) => void
	onOpenHistoryEntry?: (entry: AICardHistoryEntry) => void
}

interface DashboardMetaItem {
	key: string
	text: string
	icon: LucideIcon
}

interface LatestSectionProps extends DashboardSectionProps {
	card: AICardEntry
	headerMetaItems: DashboardMetaItem[]
	onOpenConfig?: () => void
	onRunNow?: () => void
	isRunNowLoading: boolean
}

function LatestSection({
	items,
	card,
	headerMetaItems,
	attachmentList,
	selectedProject,
	onOpenCard,
	onOpenConfig,
	onRunNow,
	isRunNowLoading,
	onOpenHistoryEntry,
}: LatestSectionProps) {
	const { t } = useTranslation("super")
	if (items.length === 0) return null

	const primaryItem = items[0]
	const statusItems: DashboardMetaItem[] = [
		...headerMetaItems,
		...(card.lastUpdated
			? [
					{
						key: "updated",
						text: t("detail.aiCard.dashboard.updatedAt", {
							time: formatDateTime(card.lastUpdated),
						}),
						icon: Clock3,
					},
				]
			: []),
	]

	return (
		<section
			className="relative overflow-hidden rounded-2xl border border-neutral-200/90 bg-white shadow-[0_22px_70px_rgb(24,24,27,0.08)]"
			data-testid="ai-card-dashboard-latest-section"
		>
			<div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,#ffffff_0%,#f7f7f6_52%,#eeeeec_100%)]" />
			<motion.div
				aria-hidden="true"
				className="via-neutral-900/12 pointer-events-none absolute -left-1/3 top-10 h-px w-2/3 bg-gradient-to-r from-transparent to-transparent"
				animate={{ x: ["0%", "210%"], opacity: [0, 0.7, 0] }}
				transition={{ duration: 13, repeat: Infinity, ease: "easeInOut" }}
			/>
			<motion.div
				aria-hidden="true"
				className="via-primary/18 pointer-events-none absolute -right-1/4 bottom-14 h-px w-1/2 bg-gradient-to-r from-transparent to-transparent"
				animate={{ x: ["0%", "-220%"], opacity: [0, 0.55, 0] }}
				transition={{ duration: 16, repeat: Infinity, ease: "easeInOut", delay: 2.5 }}
			/>
			<motion.div
				aria-hidden="true"
				className="pointer-events-none absolute inset-y-0 left-1/2 w-28 -rotate-12 bg-gradient-to-r from-transparent via-white/35 to-transparent"
				animate={{ x: ["-220%", "220%"], opacity: [0, 0.45, 0] }}
				transition={{ duration: 18, repeat: Infinity, ease: "easeInOut", delay: 1 }}
			/>
			<div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-neutral-900/15 to-transparent" />
			<div className="relative grid gap-6 p-4 sm:p-5 lg:grid-cols-[minmax(280px,400px)_minmax(280px,1fr)] lg:items-center">
				<div className="relative flex min-h-[520px] items-center justify-center py-3 sm:min-h-[600px] lg:min-h-[610px]">
					<div className="absolute h-[86%] w-[72%] max-w-[340px] translate-x-8 -rotate-3 rounded-[28px] border border-neutral-200 bg-neutral-100/80 shadow-[0_18px_48px_rgb(24,24,27,0.08)]" />
					<div className="absolute h-[90%] w-[76%] max-w-[350px] translate-x-4 rotate-2 rounded-[28px] border border-neutral-200 bg-white/90 shadow-[0_18px_52px_rgb(24,24,27,0.10)]" />
					<div className="relative z-10 w-full max-w-[360px]">
						<AICardDashboardCard
							item={primaryItem}
							index={0}
							variant="featured"
							attachmentList={attachmentList}
							selectedProject={selectedProject}
							onOpenCard={onOpenCard}
							onOpenHistoryEntry={onOpenHistoryEntry}
						/>
					</div>
				</div>

				<div className="flex min-h-[360px] flex-col justify-between py-2 lg:py-8">
					<div>
						<div className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white/85 px-3 py-1 text-xs font-medium text-neutral-700 shadow-sm">
							<Sparkles size={14} />
							<span>{t("detail.aiCard.dashboard.latestSectionTitle")}</span>
						</div>
						<h3 className="mt-4 text-2xl font-bold tracking-tight text-neutral-950">
							{primaryItem.title}
						</h3>
						{primaryItem.description && (
							<p className="mt-2 max-w-xl text-sm leading-6 text-neutral-600">
								{primaryItem.description}
							</p>
						)}
						<p className="mt-4 max-w-xl text-sm leading-6 text-neutral-500">
							{t("detail.aiCard.dashboard.latestSectionDescription")}
						</p>

						{statusItems.length > 0 && (
							<div
								className="mt-6 divide-y divide-neutral-200 rounded-xl border border-neutral-200 bg-white/75 px-3 shadow-sm"
								data-testid="ai-card-dashboard-header-meta"
							>
								{statusItems.map((item) => (
									<div
										key={item.key}
										className="flex min-w-0 items-center gap-3 py-3 text-sm"
									>
										<span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-neutral-700">
											<item.icon size={15} />
										</span>
										<span className="min-w-0 truncate font-medium text-neutral-800">
											{item.text}
										</span>
									</div>
								))}
							</div>
						)}
					</div>

					{(onRunNow || onOpenConfig) && (
						<div className="mt-6 flex flex-wrap gap-2">
							{onRunNow && (
								<button
									type="button"
									onClick={onRunNow}
									disabled={isRunNowLoading}
									className={cn(
										"flex items-center gap-2 rounded-lg border border-primary/30 bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-all hover:bg-primary/90",
										isRunNowLoading && "cursor-not-allowed opacity-70",
									)}
									data-testid="ai-card-dashboard-run-button"
								>
									{isRunNowLoading ? (
										<Loader2 size={14} className="animate-spin" />
									) : (
										<Play size={14} />
									)}
									{isRunNowLoading
										? t("detail.aiCard.dashboard.running")
										: t("detail.aiCard.dashboard.runNow")}
								</button>
							)}
							{onOpenConfig && (
								<button
									type="button"
									onClick={onOpenConfig}
									className="flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-600 shadow-sm transition-all hover:border-neutral-300 hover:bg-neutral-50 hover:text-neutral-950"
									data-testid="ai-card-dashboard-config-button"
								>
									<Settings size={14} />
									{t("detail.aiCard.dashboard.configure")}
								</button>
							)}
						</div>
					)}
				</div>
			</div>
		</section>
	)
}

function formatScheduleSummary(
	timeConfig: AICardProjectConfig["time_config"],
	t: DashboardTranslate,
) {
	if (!timeConfig?.time) return ""

	const time = normalizeScheduleTime(timeConfig.time)
	const day = typeof timeConfig.day === "string" ? timeConfig.day : ""

	switch (timeConfig.type) {
		case "daily_repeat":
			return t("detail.aiCard.dashboard.scheduleDaily", { time })
		case "weekly_repeat":
			return t("detail.aiCard.dashboard.scheduleWeekly", {
				day: formatWeekdayLabel(day, t),
				time,
			})
		case "monthly_repeat":
			return t("detail.aiCard.dashboard.scheduleMonthly", {
				day: day || "1",
				time,
			})
		case "no_repeat":
			return day
				? t("detail.aiCard.dashboard.scheduleOnce", { date: day, time })
				: t("detail.aiCard.dashboard.scheduleOnceTime", { time })
		default:
			return t("detail.aiCard.dashboard.scheduleCustom", { time })
	}
}

function formatModelSummary(
	projectConfig: AICardProjectConfig | null | undefined,
	t: DashboardTranslate,
) {
	const modelName =
		getConfiguredModelName(projectConfig?.model) ||
		getConfiguredModelName(projectConfig?.image_model) ||
		getConfiguredModelName(projectConfig?.video_model)

	if (!modelName) return ""

	return t("detail.aiCard.dashboard.modelSummary", { model: modelName })
}

function getConfiguredModelName(model?: { model_id: string; model_name?: string }) {
	return model?.model_name || model?.model_id || ""
}

function normalizeScheduleTime(time: string) {
	const match = time.match(/^(\d{1,2}):(\d{1,2})/)
	if (!match) return time

	const hour = match[1].padStart(2, "0")
	const minute = match[2].padStart(2, "0")
	return `${hour}:${minute}`
}

function formatWeekdayLabel(day: string, t: DashboardTranslate) {
	const weekdayKeyByValue: Record<string, string> = {
		"1": "monday",
		"2": "tuesday",
		"3": "wednesday",
		"4": "thursday",
		"5": "friday",
		"6": "saturday",
		"7": "sunday",
	}
	const key = weekdayKeyByValue[day]

	return key ? t(`detail.aiCard.dashboard.weekdays.${key}`) : day || "—"
}

export default memo(AICardDashboard)

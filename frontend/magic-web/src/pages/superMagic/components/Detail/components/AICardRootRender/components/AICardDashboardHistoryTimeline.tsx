import { type UIEvent, useCallback, useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { History } from "lucide-react"
import { cn } from "@/utils/cn"
import HeadlessHorizontalScroll from "@/components/base/HeadlessHorizontalScroll"
import AICardHistorySummaryCard from "./AICardHistorySummaryCard"
import type { AICardHistoryEntry } from "../types"
import type { AICardDashboardItem } from "../utils/aiCardDashboardItems"

type HistoryScrollSyncSource = "card" | "timeline"

const renderNoScrollControl = () => null

interface AICardDashboardHistoryTimelineProps {
	items: AICardDashboardItem[]
	onOpenHistoryEntry?: (entry: AICardHistoryEntry) => void
}

function getClosestHorizontalItemIndex(container: HTMLElement, items: Array<HTMLElement | null>) {
	const containerRect = container.getBoundingClientRect()
	const containerCenter = containerRect.left + containerRect.width / 2
	let nextIndex = 0
	let closestDistance = Number.POSITIVE_INFINITY

	for (let index = 0; index < items.length; index += 1) {
		const item = items[index]
		if (!item) continue

		const rect = item.getBoundingClientRect()
		const itemCenter = rect.left + rect.width / 2
		const distance = Math.abs(itemCenter - containerCenter)
		if (distance < closestDistance) {
			closestDistance = distance
			nextIndex = index
		}
	}

	return nextIndex
}

function AICardDashboardHistoryTimeline({
	items,
	onOpenHistoryEntry,
}: AICardDashboardHistoryTimelineProps) {
	const { t } = useTranslation("super")
	const [activeIndex, setActiveIndex] = useState(0)
	const activeIndexRef = useRef(0)
	const cardRefs = useRef<Array<HTMLDivElement | null>>([])
	const markerRefs = useRef<Array<HTMLButtonElement | null>>([])
	const cardScrollRafRef = useRef<number | null>(null)
	const timelineScrollRafRef = useRef<number | null>(null)
	const syncSourceRef = useRef<HistoryScrollSyncSource | null>(null)
	const syncResetTimerRef = useRef<ReturnType<typeof window.setTimeout> | null>(null)

	useEffect(() => {
		activeIndexRef.current = activeIndex
		if (activeIndex >= items.length) {
			activeIndexRef.current = 0
			setActiveIndex(0)
		}
		cardRefs.current = cardRefs.current.slice(0, items.length)
		markerRefs.current = markerRefs.current.slice(0, items.length)
	}, [activeIndex, items.length])

	useEffect(
		() => () => {
			if (cardScrollRafRef.current !== null) {
				cancelAnimationFrame(cardScrollRafRef.current)
			}
			if (timelineScrollRafRef.current !== null) {
				cancelAnimationFrame(timelineScrollRafRef.current)
			}
			if (syncResetTimerRef.current !== null) {
				window.clearTimeout(syncResetTimerRef.current)
			}
		},
		[],
	)

	const markProgrammaticSync = useCallback(
		(source: HistoryScrollSyncSource, resetDelay = 180) => {
			syncSourceRef.current = source
			if (syncResetTimerRef.current !== null) {
				window.clearTimeout(syncResetTimerRef.current)
			}
			syncResetTimerRef.current = window.setTimeout(() => {
				syncSourceRef.current = null
				syncResetTimerRef.current = null
			}, resetDelay)
		},
		[],
	)

	const updateActiveIndex = useCallback((index: number) => {
		activeIndexRef.current = index
		setActiveIndex((current) => (current === index ? current : index))
	}, [])

	const scrollCardIntoView = useCallback((index: number, behavior: ScrollBehavior = "auto") => {
		cardRefs.current[index]?.scrollIntoView({
			behavior,
			block: "nearest",
			inline: "center",
		})
	}, [])

	const scrollMarkerIntoView = useCallback((index: number, behavior: ScrollBehavior = "auto") => {
		markerRefs.current[index]?.scrollIntoView({
			behavior,
			block: "nearest",
			inline: "center",
		})
	}, [])

	const handleTimelineSelect = useCallback(
		(index: number) => {
			updateActiveIndex(index)
			markProgrammaticSync("timeline", 450)
			scrollCardIntoView(index, "smooth")
		},
		[markProgrammaticSync, scrollCardIntoView, updateActiveIndex],
	)

	const handleTimelineScroll = useCallback(
		(event: UIEvent<HTMLDivElement>) => {
			if (syncSourceRef.current === "card") return
			if (timelineScrollRafRef.current !== null || items.length === 0) return

			const timelineRail = event.currentTarget
			timelineScrollRafRef.current = requestAnimationFrame(() => {
				const nextIndex = getClosestHorizontalItemIndex(timelineRail, markerRefs.current)

				if (activeIndexRef.current !== nextIndex) {
					updateActiveIndex(nextIndex)
					markProgrammaticSync("timeline")
					scrollCardIntoView(nextIndex)
				}

				timelineScrollRafRef.current = null
			})
		},
		[items.length, markProgrammaticSync, scrollCardIntoView, updateActiveIndex],
	)

	const handleCardRailScroll = useCallback(
		(event: UIEvent<HTMLDivElement>) => {
			if (syncSourceRef.current === "timeline") return
			if (cardScrollRafRef.current !== null || items.length === 0) return

			const cardRail = event.currentTarget
			cardScrollRafRef.current = requestAnimationFrame(() => {
				const nextIndex = getClosestHorizontalItemIndex(cardRail, cardRefs.current)

				if (activeIndexRef.current !== nextIndex) {
					updateActiveIndex(nextIndex)
					markProgrammaticSync("card")
					scrollMarkerIntoView(nextIndex)
				}

				cardScrollRafRef.current = null
			})
		},
		[items.length, markProgrammaticSync, scrollMarkerIntoView, updateActiveIndex],
	)

	return (
		<section
			className="overflow-hidden rounded-2xl border border-border/70 bg-background/75 shadow-[0_16px_52px_rgb(15,23,42,0.08)] backdrop-blur"
			data-testid="ai-card-dashboard-history-timeline"
		>
			<div className="border-b border-border/60 bg-gradient-to-r from-muted/60 via-background/80 to-muted/30 px-4 py-4 sm:px-5">
				<div className="flex flex-wrap items-end justify-between gap-3">
					<div>
						<div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
							<History size={14} />
							<span>{t("detail.aiCard.dashboard.historySectionTitle")}</span>
						</div>
						<p className="mt-1 text-sm text-muted-foreground">
							{t("detail.aiCard.dashboard.historySectionDescription")}
						</p>
					</div>
					{items.length > 0 && (
						<span className="rounded-full border border-border bg-background/80 px-2.5 py-1 text-xs font-medium text-muted-foreground shadow-sm">
							{t("detail.aiCard.dashboard.historyCount", { count: items.length })}
						</span>
					)}
				</div>

				{items.length > 0 && (
					<div className="relative mt-5">
						<div className="absolute left-3 right-3 top-[17px] h-px bg-gradient-to-r from-transparent via-border to-transparent" />
						<HeadlessHorizontalScroll
							className="relative rounded-none pb-1"
							renderLeftControl={renderNoScrollControl}
							renderRightControl={renderNoScrollControl}
							scrollContainerClassName="flex gap-2 overflow-x-auto overflow-y-hidden pb-1 scroll-smooth"
							scrollContainerProps={{
								onScroll: handleTimelineScroll,
								"data-testid": "ai-card-dashboard-timeline-rail",
							}}
						>
							{items.map((item, index) => {
								const isActive = index === activeIndex
								return (
									<button
										key={item.id}
										ref={(node) => {
											markerRefs.current[index] = node
										}}
										type="button"
										onClick={() => handleTimelineSelect(index)}
										aria-current={isActive ? "true" : "false"}
										className={cn(
											"relative flex min-w-[76px] flex-col items-center gap-1 rounded-xl px-2 py-1.5 text-xs transition-all duration-300",
											"focus:outline-none focus:ring-2 focus:ring-primary/25",
											isActive
												? "bg-background text-primary shadow-sm"
												: "text-muted-foreground hover:bg-background/70 hover:text-foreground",
										)}
										data-testid={`ai-card-dashboard-timeline-marker-${item.fileId}`}
									>
										<span
											className={cn(
												"size-3 rounded-full border transition-all duration-300",
												isActive
													? "border-primary bg-primary shadow-[0_0_0_5px_hsl(var(--primary)/0.12)]"
													: "border-border bg-background",
											)}
										/>
										<span className="max-w-[70px] truncate font-medium">
											{formatShortDate(item.createdAt)}
										</span>
									</button>
								)
							})}
						</HeadlessHorizontalScroll>
					</div>
				)}
			</div>

			{items.length > 0 ? (
				<div className="relative px-4 py-5 sm:px-5">
					<div className="pointer-events-none absolute inset-y-5 left-0 z-20 w-10 bg-gradient-to-r from-background to-transparent" />
					<div className="pointer-events-none absolute inset-y-5 right-0 z-20 w-10 bg-gradient-to-l from-background to-transparent" />
					<HeadlessHorizontalScroll
						className="-mx-4 rounded-none pb-2 sm:-mx-5"
						renderLeftControl={renderNoScrollControl}
						renderRightControl={renderNoScrollControl}
						scrollContainerClassName="flex snap-x snap-mandatory gap-4 overflow-x-auto overflow-y-hidden scroll-smooth px-4 pb-2 pt-1 sm:gap-5 sm:px-5"
						scrollContainerProps={{
							onScroll: handleCardRailScroll,
							"data-testid": "ai-card-dashboard-card-rail",
						}}
					>
						{items.map((item, index) => {
							const isActive = index === activeIndex
							return (
								<div
									key={item.id}
									ref={(node) => {
										cardRefs.current[index] = node
									}}
									className={cn(
										"group/history shrink-0 snap-center rounded-[26px] bg-gradient-to-b p-1 transition-all duration-500",
										"w-[min(68vw,248px)] sm:w-[240px] lg:w-[256px]",
										isActive
											? "from-primary/30 to-primary/5 opacity-100 shadow-[0_18px_48px_rgb(15,23,42,0.14)]"
											: "from-background to-muted/40 opacity-75 hover:opacity-95",
										!isActive && "scale-[0.96]",
									)}
									data-active={isActive ? "true" : "false"}
									data-testid="ai-card-dashboard-timeline-item"
								>
									<AICardHistorySummaryCard
										item={item}
										index={index}
										isActive={isActive}
										onOpenHistoryEntry={onOpenHistoryEntry}
									/>
								</div>
							)
						})}
					</HeadlessHorizontalScroll>
				</div>
			) : (
				<div
					className="m-4 flex min-h-[120px] items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 px-4 py-6 text-sm text-muted-foreground"
					data-testid="ai-card-dashboard-history-empty"
				>
					{t("detail.aiCard.dashboard.historyEmpty")}
				</div>
			)}
		</section>
	)
}

function formatShortDate(value?: string) {
	if (!value) return "-"

	const date = new Date(value)
	if (Number.isNaN(date.getTime())) return "-"

	return date.toLocaleDateString(undefined, {
		month: "numeric",
		day: "numeric",
	})
}

export default AICardDashboardHistoryTimeline

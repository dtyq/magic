import {
	BarChart3,
	CheckCircle2,
	Link2,
	MessageCircle,
	PenLine,
	RefreshCw,
	Sparkles,
	TrendingUp,
	X,
} from "lucide-react"
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import type { CSSProperties, MouseEvent } from "react"
import { cn } from "@/utils/cn"
import type {
	SelfMediaOpsOverview,
	SelfMediaOpsOverviewAction,
	SelfMediaOpsOverviewActionKey,
} from "../services/selfMediaOpsOverview"
import {
	formatSelfMediaCompactNumber,
	formatSelfMediaPercent,
} from "../services/selfMediaOpsOverview"
import {
	buildSelfMediaOpsHealth,
	buildSelfMediaOpsMetricDisplay,
	buildSelfMediaOpsMetricMotionStates,
	buildSelfMediaOpsMetricStatusLabels,
	buildSelfMediaOpsPrimarySignal,
	getSelfMediaOpsActionUnlockCopy,
} from "../services/selfMediaOpsOverviewPresentation"
import type {
	SelfMediaHomeDailyInsightPayload,
	SelfMediaHomeDailyInsightStatus,
} from "../services/selfMediaHomeInsight"
import { formatSelfMediaHomeInsightGreeting } from "../services/selfMediaHomeInsight"
import type {
	SelfMediaOpsHealthInsightPayload,
	SelfMediaOpsHealthInsightStatus,
} from "../services/selfMediaOpsHealthInsight"
import {
	buildDailyInsightDisplayActions,
	type DisplaySelfMediaOpsOverviewAction,
} from "../services/selfMediaOpsOverviewDailyInsight"
import { useMeasuredContainerWidth } from "../hooks/useMeasuredContainerWidth"
import SelfMediaOpsCompletionProgress from "./SelfMediaOpsCompletionProgress"
import SelfMediaOpsDataSummary from "./SelfMediaOpsDataSummary"
import "./SelfMediaOpsOverviewCard.css"

interface SelfMediaOpsOverviewCardProps {
	overview: SelfMediaOpsOverview
	allowEdit?: boolean
	onAction?: (action: SelfMediaOpsOverviewAction) => void
	dailyInsight?: SelfMediaHomeDailyInsightPayload | null
	dailyInsightStatus?: SelfMediaHomeDailyInsightStatus
	healthInsight?: SelfMediaOpsHealthInsightPayload | null
	healthInsightStatus?: SelfMediaOpsHealthInsightStatus
	metricsLoading?: boolean
	onRegenerateDailyInsight?: () => void
	onDismissDailyInsightAction?: (actionId: string) => void
	className?: string
}

const actionIconMap = {
	"bind-source": Link2,
	"sync-metrics": RefreshCw,
	"collect-comments": MessageCircle,
	"generate-review": CheckCircle2,
	"improve-weak-post": Sparkles,
	"repurpose-best-post": TrendingUp,
	"plan-next-post": PenLine,
} satisfies Record<SelfMediaOpsOverviewActionKey, typeof Link2>

function getOverviewActionIcon(key: SelfMediaOpsOverviewActionKey | string) {
	return actionIconMap[key as SelfMediaOpsOverviewActionKey] ?? Sparkles
}

const NUMBER_ANIMATION_MS = 720
const OPS_ACTION_ROW_HEIGHT = 144
const OPS_ACTION_GAP = 12
const OPS_ACTION_SHADOW_PADDING = 16
const OPS_VISIBLE_ACTION_COUNT = 1.5
const OPS_VISIBLE_ACTION_GAP_COUNT = 1
const OPS_DENSE_ACTION_ROW_HEIGHT = 108
const OPS_DENSE_ACTION_GAP = 8
const OPS_DENSE_ACTION_SHADOW_PADDING = 10
const OPS_DENSE_VISIBLE_ACTION_COUNT = 1.25
const OPS_WIDE_SIDE_COLUMN_GAP = 8
const OPS_WIDE_SIDE_PANEL_VERTICAL_PADDING = 28
const OPS_WIDE_ACTION_LIST_TOP_MARGIN = 12

interface OpsOverviewCardStyle extends CSSProperties {
	"--ops-card-pointer-x": string
	"--ops-card-pointer-y": string
	"--ops-card-tilt-x": string
	"--ops-card-tilt-y": string
	"--ops-card-lift": string
}

const defaultOpsOverviewCardStyle: OpsOverviewCardStyle = {
	"--ops-card-pointer-x": "50%",
	"--ops-card-pointer-y": "50%",
	"--ops-card-tilt-x": "0deg",
	"--ops-card-tilt-y": "0deg",
	"--ops-card-lift": "0px",
	background:
		"radial-gradient(circle at var(--ops-card-pointer-x) var(--ops-card-pointer-y), rgba(255, 214, 55, 0.28), rgba(255, 214, 55, 0) 30%), linear-gradient(135deg, #f1f0eb 0%, #e4e4e7 43%, #dfe8e2 100%)",
	transform:
		"perspective(1200px) rotateX(var(--ops-card-tilt-x)) rotateY(var(--ops-card-tilt-y)) translateY(var(--ops-card-lift))",
}

type OpsOverviewLayout = "compact" | "comfortable" | "spacious" | "wide"

interface OpsActionListStyle extends CSSProperties {
	"--ops-action-row-height": string
}

const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect

function getOpsOverviewLayout(width: number): OpsOverviewLayout {
	if (width >= 900) return "wide"
	if (width >= 760) return "spacious"
	if (width >= 640) return "comfortable"
	return "compact"
}

function handleOpsOverviewPointerMove(event: MouseEvent<HTMLElement>) {
	const element = event.currentTarget
	const rect = element.getBoundingClientRect()
	if (rect.width <= 0 || rect.height <= 0) return
	const x = clamp((event.clientX - rect.left) / rect.width, 0, 1)
	const y = clamp((event.clientY - rect.top) / rect.height, 0, 1)

	element.style.setProperty("--ops-card-pointer-x", `${Math.round(x * 100)}%`)
	element.style.setProperty("--ops-card-pointer-y", `${Math.round(y * 100)}%`)
	element.style.setProperty("--ops-card-tilt-x", `${trimStyleNumber((0.5 - y) * 4)}deg`)
	element.style.setProperty("--ops-card-tilt-y", `${trimStyleNumber((x - 0.5) * 6)}deg`)
}

function handleOpsOverviewPointerLeave(event: MouseEvent<HTMLElement>) {
	const element = event.currentTarget
	element.style.setProperty("--ops-card-pointer-x", "50%")
	element.style.setProperty("--ops-card-pointer-y", "50%")
	element.style.setProperty("--ops-card-tilt-x", "0deg")
	element.style.setProperty("--ops-card-tilt-y", "0deg")
}

function SelfMediaOpsOverviewCard({
	overview,
	allowEdit = true,
	onAction,
	dailyInsight,
	dailyInsightStatus = "idle",
	healthInsight,
	healthInsightStatus = "idle",
	metricsLoading = false,
	onRegenerateDailyInsight,
	onDismissDailyInsightAction,
	className,
}: SelfMediaOpsOverviewCardProps) {
	const { t, i18n } = useTranslation("super")
	const { containerRef: opsContainerRef, width: opsContainerWidth } =
		useMeasuredContainerWidth<HTMLElement>()
	const animatedReads = useAnimatedOverviewValue(overview.totalReads, NUMBER_ANIMATION_MS)
	const animatedEngagement = useAnimatedOverviewValue(
		overview.totalEngagement,
		NUMBER_ANIMATION_MS,
	)
	const animatedEngagementRate = useAnimatedOverviewValue(
		overview.engagementRate ?? 0,
		NUMBER_ANIMATION_MS,
	)
	const reads = formatSelfMediaCompactNumber(animatedReads, i18n?.language)
	const engagement = formatSelfMediaCompactNumber(animatedEngagement, i18n?.language)
	const engagementRate = formatSelfMediaPercent(animatedEngagementRate)
	const primarySignal = buildSelfMediaOpsPrimarySignal(overview)
	const workflowHealth = buildSelfMediaOpsHealth(overview)
	const opsHealthScore = healthInsight?.score ?? workflowHealth.score
	const opsHealthSource = healthInsight ? "ai" : "workflow"
	const isOpsHealthLoading =
		metricsLoading || (healthInsightStatus === "loading" && !healthInsight)
	const opsHealthTitle = [
		healthInsight?.summary,
		metricsLoading ? t("selfMedia.opsReadingMetrics") : "",
		t("selfMedia.opsPipelineCompletion", { score: workflowHealth.score }),
		healthInsightStatus === "loading" ? t("selfMedia.opsAiCalculating") : "",
	]
		.filter(Boolean)
		.join(" · ")
	const metricStatusLabels = buildSelfMediaOpsMetricStatusLabels(overview)
	const metricMotionStates = buildSelfMediaOpsMetricMotionStates(overview)
	const metricDisplay = buildSelfMediaOpsMetricDisplay(overview, {
		reads,
		engagement,
		rate: engagementRate,
	})
	const hasPublishedSource = overview.completion.source.done > 0
	const dailyInsightKey = dailyInsight
		? `${dailyInsight.date}-${dailyInsight.generatedAt}-${dailyInsight.stateSignature}`
		: ""
	const [dismissedDailyInsightActionIds, setDismissedDailyInsightActionIds] = useState<string[]>(
		[],
	)
	useEffect(() => {
		setDismissedDailyInsightActionIds([])
	}, [dailyInsightKey])
	const insightActions = buildDailyInsightDisplayActions({
		dailyInsight,
		overview,
		dismissedDailyInsightActionIds,
	})
	const shouldUseDailyInsightActions =
		Boolean(dailyInsight?.actions?.length) && overview.operationStage === "closed"
	const displayActions: DisplaySelfMediaOpsOverviewAction[] = shouldUseDailyInsightActions
		? insightActions
		: overview.nextActions
	const hasNextActions = displayActions.length > 0
	const opsLayout = getOpsOverviewLayout(opsContainerWidth)
	const isOpsWide = opsLayout === "wide"
	const isOpsDense = opsLayout !== "compact"
	const { elementRef: mainColumnRef, height: mainColumnHeight } =
		useMeasuredElementHeight<HTMLDivElement>(allowEdit && isOpsWide)
	// Wide layout stretches the side panel to match the left data/progress stack; let the list
	// consume the remaining panel height instead of leaving a fixed-height scroll strip at the top.
	const isActionListScrollable =
		displayActions.length > 2 || (isOpsWide && displayActions.length > 1)
	const shouldStretchActionList = isOpsWide && isActionListScrollable
	const { elementRef: sideToolbarRef, height: sideToolbarHeight } =
		useMeasuredElementHeight<HTMLDivElement>(allowEdit && shouldStretchActionList)
	const { elementRef: sidePanelIntroRef, height: sidePanelIntroHeight } =
		useMeasuredElementHeight<HTMLDivElement>(allowEdit && shouldStretchActionList)
	const actionRowHeight = isOpsDense ? OPS_DENSE_ACTION_ROW_HEIGHT : OPS_ACTION_ROW_HEIGHT
	const actionListMaxHeight = isOpsDense
		? OPS_DENSE_ACTION_ROW_HEIGHT * OPS_DENSE_VISIBLE_ACTION_COUNT +
			OPS_DENSE_ACTION_GAP * OPS_VISIBLE_ACTION_GAP_COUNT +
			OPS_DENSE_ACTION_SHADOW_PADDING * 2
		: OPS_ACTION_ROW_HEIGHT * OPS_VISIBLE_ACTION_COUNT +
			OPS_ACTION_GAP * OPS_VISIBLE_ACTION_GAP_COUNT +
			OPS_ACTION_SHADOW_PADDING * 2
	const sideColumnMinHeight =
		actionListMaxHeight +
		OPS_WIDE_SIDE_PANEL_VERTICAL_PADDING +
		OPS_WIDE_ACTION_LIST_TOP_MARGIN +
		sidePanelIntroHeight +
		sideToolbarHeight +
		(sideToolbarHeight > 0 ? OPS_WIDE_SIDE_COLUMN_GAP : 0)
	const actionListStyle: OpsActionListStyle = {
		"--ops-action-row-height": `${actionRowHeight}px`,
		maxHeight:
			isActionListScrollable && !shouldStretchActionList
				? `${actionListMaxHeight}px`
				: undefined,
		minHeight: shouldStretchActionList ? `${actionListMaxHeight}px` : undefined,
	}
	const sideColumnStyle: CSSProperties | undefined =
		isOpsWide && mainColumnHeight > 0
			? {
					height: `${mainColumnHeight}px`,
					minHeight: shouldStretchActionList ? `${sideColumnMinHeight}px` : undefined,
				}
			: undefined
	const isInsightLoading = dailyInsightStatus === "loading"
	const asideTitle = overview.operationStage === "closed" ? "今日建议" : "继续处理"
	const asideSubtitle =
		overview.operationStage === "closed"
			? dailyInsight?.summary || "根据当前运营状态给出下一步机会"
			: "按优先级处理这些事项"
	const insightGreeting = dailyInsight?.greeting
		? formatSelfMediaHomeInsightGreeting(dailyInsight.greeting, "")
		: ""
	const opsContentClass = !allowEdit
		? isOpsDense
			? "p-5"
			: "p-3.5"
		: isOpsWide
			? "grid-cols-[minmax(0,1.16fr)_minmax(280px,0.84fr)] items-start p-5"
			: isOpsDense
				? "p-5"
				: "p-3.5"
	const opsHeaderClass = isOpsDense ? "flex-row items-start justify-between" : "flex-col"
	const opsHealthClass = isOpsDense ? "w-[108px]" : "w-full"
	const opsAsideClass = "rounded-[20px] p-3.5"
	const regenerateInsightButton = onRegenerateDailyInsight ? (
		<button
			type="button"
			className={cn(
				"bg-white/82 inline-flex shrink-0 items-center gap-1.5 rounded-full font-[780] text-[#18181b] shadow-[inset_0_1px_rgba(255,255,255,0.85),0_12px_28px_rgba(47,43,36,0.08)] transition-[background,transform,box-shadow] hover:-translate-y-0.5 hover:bg-white hover:shadow-[inset_0_1px_rgba(255,255,255,0.92),0_16px_34px_rgba(47,43,36,0.12)] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#18181b]/15 disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:translate-y-0",
				isOpsDense ? "h-8 px-3 text-[11px]" : "h-9 px-3.5 text-[12px]",
			)}
			onClick={onRegenerateDailyInsight}
			disabled={isInsightLoading}
			aria-label={t("selfMedia.opsUpdateTodayAdvice")}
			data-testid="self-media-home-daily-insight-refresh"
		>
			<RefreshCw size={13} className={cn(isInsightLoading && "animate-spin")} />
			<span>
				{isInsightLoading ? t("selfMedia.opsUpdating") : t("selfMedia.opsUpdateAdvice")}
			</span>
		</button>
	) : null
	const handleDismissDailyInsightAction = (actionId: string) => {
		setDismissedDailyInsightActionIds((current) =>
			current.includes(actionId) ? current : [...current, actionId],
		)
		onDismissDailyInsightAction?.(actionId)
	}

	return (
		<article
			ref={opsContainerRef}
			className={cn(
				"self-media-ops-breathing-surface group relative overflow-hidden rounded-[24px] border border-white/70 shadow-[inset_0_1px_rgba(255,255,255,0.8),0_24px_72px_rgba(47,43,36,0.12)] transition-[box-shadow,transform] duration-300 ease-out hover:shadow-[inset_0_1px_rgba(255,255,255,0.9),0_30px_80px_rgba(47,43,36,0.16)] hover:[--ops-card-lift:-3px]",
				"min-w-0 max-w-full",
				className,
			)}
			style={defaultOpsOverviewCardStyle}
			onMouseMove={handleOpsOverviewPointerMove}
			onMouseLeave={handleOpsOverviewPointerLeave}
			data-testid="self-media-home-ops-overview"
			data-ops-layout={opsLayout}
		>
			<div
				className="self-media-ops-breathing-glow pointer-events-none absolute inset-0 opacity-60"
				data-testid="self-media-home-ops-overview-breath"
			/>
			<div
				className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
				style={{
					background:
						"radial-gradient(circle at var(--ops-card-pointer-x) var(--ops-card-pointer-y), rgba(255,255,255,0.55), transparent 22%)",
				}}
			/>
			<div className="pointer-events-none absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-white/95 to-transparent" />
			<div className="pointer-events-none absolute inset-0 bg-[linear-gradient(115deg,rgba(255,255,255,0.44),rgba(255,255,255,0)_34%,rgba(24,24,27,0.035)_100%)]" />
			<div
				className={cn("relative grid", isOpsDense ? "gap-5" : "gap-6", opsContentClass)}
				data-testid="self-media-home-ops-content"
			>
				<div
					ref={mainColumnRef}
					className={cn(
						"min-w-0",
						isOpsWide ? "flex flex-col gap-3" : isOpsDense ? "space-y-3" : "space-y-4",
					)}
					data-testid="self-media-home-ops-main-column"
				>
					<div className={cn("flex", isOpsDense ? "gap-2.5" : "gap-3", opsHeaderClass)}>
						<div>
							<div
								className={cn(
									"inline-flex items-center gap-2 rounded-full border border-white/75 bg-white/55 px-3 py-1 text-[11px] font-[780] text-[#52525b] shadow-[inset_0_1px_rgba(255,255,255,0.75)] backdrop-blur",
									isOpsDense ? "mb-1.5" : "mb-2.5",
								)}
							>
								<span className="h-1.5 w-1.5 rounded-full bg-[#59b981] shadow-[0_0_0_4px_rgba(89,185,129,0.14)]" />
								{t("selfMedia.opsTodaySignals")}
							</div>
							<h3
								className={cn(
									"m-0 max-w-[30rem] font-[820] leading-[1.18] text-[#18181b]",
									isOpsDense ? "text-[17px]" : "text-[19px]",
								)}
								data-testid="self-media-home-ops-headline"
							>
								{primarySignal.title}
							</h3>
							<p
								className={cn(
									"max-w-[29rem] text-[#52525b]",
									isOpsDense
										? "mt-1.5 text-[12px] leading-[1.5]"
										: "mt-3 text-[13px] leading-[1.75]",
								)}
								data-testid="self-media-home-ops-summary"
							>
								{primarySignal.description}
							</p>
						</div>
						<div
							className={cn(
								"flex shrink-0 flex-col justify-center bg-[#18181b] text-[#ffd637] shadow-[0_16px_34px_rgba(24,24,27,0.22),inset_0_1px_rgba(255,255,255,0.18)]",
								isOpsDense
									? "min-h-[52px] rounded-[16px] px-3 py-2"
									: "min-h-16 rounded-[20px] px-4 py-3",
								opsHealthClass,
								opsHealthScore < 100 && "self-media-ops-health-pulse",
							)}
							data-testid="self-media-home-ops-health"
							data-health-source={opsHealthSource}
							data-health-level={healthInsight?.level ?? "workflow"}
							data-loading={isOpsHealthLoading ? "true" : "false"}
							title={opsHealthTitle}
						>
							<div className="text-white/62 flex items-center gap-1.5 text-[11px] font-[760]">
								<BarChart3 size={13} />
								{t("selfMedia.opsHealth")}
							</div>
							<div
								className={cn(
									"mt-1 font-[840] leading-none text-[#ffd637]",
									isOpsDense ? "text-[21px]" : "text-[23px]",
								)}
							>
								{isOpsHealthLoading ? "..." : opsHealthScore}
							</div>
							<div
								className="mt-1 text-[10px] font-[760] leading-none text-white/55"
								data-testid="self-media-home-ops-health-link-completion"
							>
								链路 {workflowHealth.score}%
							</div>
						</div>
					</div>

					{hasPublishedSource ? (
						<SelfMediaOpsDataSummary
							overview={overview}
							values={{
								reads: metricDisplay.reads.value,
								engagement: metricDisplay.engagement.value,
								rate: metricDisplay.rate.value,
							}}
							statusLabels={metricStatusLabels}
							motionStates={metricMotionStates}
							loading={metricsLoading}
							comfortable={isOpsDense}
							dense={isOpsDense}
							className={cn(isOpsWide && "flex-1")}
						/>
					) : null}

					<SelfMediaOpsCompletionProgress
						completion={overview.completion}
						dense={isOpsDense}
					/>
				</div>

				{allowEdit ? (
					<div
						className={cn(
							"min-w-0",
							isOpsWide
								? "flex min-h-0 flex-col gap-2"
								: isOpsDense
									? "space-y-2"
									: "space-y-3",
						)}
						style={sideColumnStyle}
						data-testid="self-media-home-ops-side-column"
					>
						{regenerateInsightButton ? (
							<div
								ref={sideToolbarRef}
								className="flex justify-end"
								data-testid="self-media-home-ops-side-toolbar"
							>
								{regenerateInsightButton}
							</div>
						) : null}
						<aside
							className={cn(
								"min-w-0 border border-white/70 bg-white/50 shadow-[inset_0_1px_rgba(255,255,255,0.82),0_18px_46px_rgba(47,43,36,0.08)] backdrop-blur-xl",
								isOpsWide && "flex min-h-0 flex-1 flex-col",
								opsAsideClass,
							)}
							data-testid="self-media-home-ops-aside"
						>
							<div
								ref={sidePanelIntroRef}
								data-testid="self-media-home-ops-side-panel-intro"
							>
								<div className="flex items-center justify-between gap-2.5">
									<div className="min-w-0 flex-1">
										<h4
											className={cn(
												"font-[800] text-[#18181b]",
												isOpsDense ? "text-[14px]" : "text-[15px]",
											)}
										>
											{asideTitle}
										</h4>
										<p
											className={cn(
												"mt-1 text-[#71717a]",
												isOpsDense
													? "text-[11px] leading-[1.45]"
													: "text-[12px] leading-[1.55]",
											)}
										>
											{asideSubtitle}
										</p>
									</div>
									<span
										className={cn(
											"rounded-full bg-white/80 font-[700] text-[#18181b]",
											isOpsDense
												? "px-2.5 py-0.5 text-[11px]"
												: "px-3 py-1 text-[12px]",
										)}
									>
										{overview.totalPosts} 篇
									</span>
								</div>
								{insightGreeting ? (
									<div
										className={cn(
											"border border-white/65 bg-white/55 font-[760] text-[#18181b] shadow-[inset_0_1px_rgba(255,255,255,0.76)]",
											isOpsDense
												? "mt-3 rounded-[16px] p-2.5 text-[12px] leading-[1.45]"
												: "mt-4 rounded-[18px] p-3 text-[13px] leading-[1.55]",
										)}
										data-testid="self-media-home-ops-insight-greeting"
									>
										{insightGreeting}
									</div>
								) : null}
							</div>
							<div
								className={cn(
									isOpsDense ? "mt-3" : "mt-4",
									isActionListScrollable &&
										cn(
											"self-media-ops-action-scroll",
											isOpsDense ? "-mx-3 px-3" : "-mx-3.5 px-3.5",
										),
									shouldStretchActionList && "min-h-0 flex-1",
								)}
								style={actionListStyle}
								data-testid="self-media-home-ops-next-actions"
							>
								<div
									className={cn(
										isOpsDense ? "space-y-2" : "space-y-2.5",
										isActionListScrollable &&
											(isOpsDense ? "py-2.5" : "py-3.5"),
									)}
									data-testid="self-media-home-ops-next-actions-inner"
								>
									{hasNextActions ? (
										displayActions.map((action) => {
											const Icon = getOverviewActionIcon(action.key)
											const dailyInsightId = action.dailyInsightId
											return (
												<div
													key={`${action.key}-${action.postKey || action.title}`}
													className={cn(
														"self-media-ops-action-card group/card relative border border-white/70 bg-white/70 shadow-[inset_0_1px_rgba(255,255,255,0.82),0_10px_28px_rgba(47,43,36,0.055)] transition-[border-color,box-shadow,transform,background] duration-200 hover:-translate-y-0.5 hover:border-[#ffd637]/70 hover:bg-white/90 hover:shadow-[inset_0_1px_rgba(255,255,255,0.9),0_16px_38px_rgba(47,43,36,0.1)]",
														isOpsDense
															? "rounded-[16px]"
															: "rounded-[18px]",
													)}
												>
													<button
														type="button"
														className={cn(
															"group/action h-full w-full text-left focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#18181b]/15",
															isOpsDense
																? "rounded-[16px] p-2.5"
																: "rounded-[18px] p-3.5",
															dailyInsightId && "pr-11",
														)}
														onClick={() => onAction?.(action)}
														data-testid={`self-media-home-ops-action-${action.key}`}
													>
														<div
															className={cn(
																"flex items-start",
																isOpsDense ? "gap-2" : "gap-2.5",
															)}
														>
															<span
																className={cn(
																	"flex shrink-0 items-center justify-center bg-[#18181b] text-[#ffd637] shadow-[0_10px_22px_rgba(24,24,27,0.18)] transition-transform group-hover/action:scale-105",
																	isOpsDense
																		? "h-8 w-8 rounded-[12px]"
																		: "h-9 w-9 rounded-[15px]",
																)}
															>
																<Icon size={isOpsDense ? 14 : 16} />
															</span>
															<span className="min-w-0 flex-1">
																<span
																	className={cn(
																		"flex flex-col min-[420px]:flex-row min-[420px]:items-center min-[420px]:justify-between",
																		isOpsDense
																			? "gap-1.5 min-[420px]:gap-2"
																			: "gap-2 min-[420px]:gap-3",
																	)}
																>
																	<span
																		className={cn(
																			"truncate font-[800] text-[#18181b]",
																			isOpsDense
																				? "text-[12px]"
																				: "text-[13px]",
																		)}
																	>
																		{action.title}
																	</span>
																	<span
																		className={cn(
																			"w-fit shrink-0 rounded-full bg-[#ffd637]/55 font-[780] text-[#18181b] opacity-90 transition-colors group-hover/action:bg-[#ffd637]",
																			isOpsDense
																				? "px-2 py-0.5 text-[10px]"
																				: "px-2.5 py-1 text-[11px]",
																		)}
																	>
																		{action.cta}
																	</span>
																</span>
																<span
																	className={cn(
																		"block text-[#71717a]",
																		isOpsDense
																			? "mt-0.5 text-[11px] leading-[1.4]"
																			: "mt-1 text-[12px] leading-[1.45]",
																	)}
																>
																	{action.description}
																</span>
																<span
																	className={cn(
																		"flex flex-wrap gap-1.5",
																		isOpsDense
																			? "mt-1"
																			: "mt-1.5",
																	)}
																>
																	{action.targetTitle ? (
																		<span
																			className={cn(
																				"inline-flex max-w-full rounded-full bg-white/80 font-[780] text-[#18181b] shadow-[inset_0_1px_rgba(255,255,255,0.82)]",
																				isOpsDense
																					? "px-2 py-0.5 text-[10px]"
																					: "px-2.5 py-1 text-[11px]",
																			)}
																		>
																			<span className="truncate">
																				文章：
																				{action.targetTitle}
																			</span>
																		</span>
																	) : null}
																	<span
																		className={cn(
																			"inline-flex rounded-full bg-[#18181b]/[0.055] font-[760] text-[#52525b]",
																			isOpsDense
																				? "px-2 py-0.5 text-[10px]"
																				: "px-2.5 py-1 text-[11px]",
																		)}
																	>
																		{getSelfMediaOpsActionUnlockCopy(
																			action.key,
																		)}
																	</span>
																</span>
															</span>
														</div>
													</button>
													{dailyInsightId ? (
														<button
															type="button"
															className={cn(
																"bg-white/82 absolute inline-flex items-center justify-center rounded-full text-[#71717a] shadow-[inset_0_1px_rgba(255,255,255,0.9),0_8px_18px_rgba(47,43,36,0.08)] transition-[background,color,transform] hover:-translate-y-0.5 hover:bg-white hover:text-[#18181b] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#18181b]/15",
																isOpsDense
																	? "right-2 top-2 h-6 w-6"
																	: "right-3 top-3 h-7 w-7",
															)}
															aria-label={`移除建议：${action.title}`}
															onClick={() =>
																handleDismissDailyInsightAction(
																	dailyInsightId,
																)
															}
															data-testid="handle-dismiss-daily-insight-action"
														>
															<X size={isOpsDense ? 12 : 14} />
														</button>
													) : null}
												</div>
											)
										})
									) : (
										<div className="bg-white/78 rounded-[18px] p-4 text-[13px] leading-[1.6] text-[#52525b]">
											{t("selfMedia.opsTodayComplete")}
										</div>
									)}
								</div>
							</div>
						</aside>
					</div>
				) : null}
			</div>
		</article>
	)
}

export default SelfMediaOpsOverviewCard

function useAnimatedOverviewValue(target: number, duration: number) {
	const [value, setValue] = useState(() => (prefersReducedOverviewMotion() ? target : 0))

	useEffect(() => {
		if (prefersReducedOverviewMotion() || target === 0) {
			setValue(target)
			return undefined
		}

		setValue(0)
		const startedAt = Date.now()
		const timer = window.setInterval(() => {
			const elapsed = Date.now() - startedAt
			const progress = clamp(elapsed / duration, 0, 1)
			const eased = 1 - Math.pow(1 - progress, 3)
			setValue(target * eased)
			if (progress >= 1) window.clearInterval(timer)
		}, 16)

		return () => window.clearInterval(timer)
	}, [duration, target])

	return value
}

function useMeasuredElementHeight<Element extends HTMLElement>(enabled: boolean) {
	const elementRef = useRef<Element | null>(null)
	const [height, setHeight] = useState(0)

	const updateHeight = useCallback(() => {
		const measuredHeight = elementRef.current?.getBoundingClientRect().height ?? 0
		setHeight((current) =>
			Math.abs(current - measuredHeight) < 0.5 ? current : measuredHeight,
		)
	}, [])

	useIsomorphicLayoutEffect(() => {
		if (!enabled) {
			setHeight(0)
			return undefined
		}

		const element = elementRef.current
		if (!element) return undefined

		updateHeight()
		let frame = 0
		const handleResize = () => updateHeight()
		window.addEventListener("resize", handleResize)

		if (typeof ResizeObserver === "undefined") {
			return () => {
				window.cancelAnimationFrame(frame)
				window.removeEventListener("resize", handleResize)
			}
		}

		const observer = new ResizeObserver(() => {
			window.cancelAnimationFrame(frame)
			frame = window.requestAnimationFrame(() => updateHeight())
		})
		observer.observe(element)

		return () => {
			window.cancelAnimationFrame(frame)
			window.removeEventListener("resize", handleResize)
			observer.disconnect()
		}
	}, [enabled, updateHeight])

	return { elementRef, height }
}

function clamp(value: number, min: number, max: number) {
	return Math.min(max, Math.max(min, value))
}

function prefersReducedOverviewMotion() {
	return (
		typeof window !== "undefined" &&
		typeof window.matchMedia === "function" &&
		window.matchMedia("(prefers-reduced-motion: reduce)").matches
	)
}

function trimStyleNumber(value: number) {
	const rounded = Math.round(value * 10) / 10
	return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)
}

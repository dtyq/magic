import { Activity, Bookmark, Eye, Heart, MessageCircle, Send, TrendingUp } from "lucide-react"
import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { cn } from "@/utils/cn"
import type { SelfMediaOpsOverview } from "../services/selfMediaOpsOverview"
import {
	formatSelfMediaCompactNumber,
	formatSelfMediaPercent,
} from "../services/selfMediaOpsOverview"
import type {
	SelfMediaOpsMetricKey,
	SelfMediaOpsMetricMotionState,
} from "../services/selfMediaOpsOverviewPresentation"

interface SelfMediaOpsDataSummaryProps {
	overview: SelfMediaOpsOverview
	values: Record<SelfMediaOpsMetricKey, string>
	statusLabels: Record<SelfMediaOpsMetricKey, string>
	motionStates: Record<SelfMediaOpsMetricKey, SelfMediaOpsMetricMotionState>
	loading?: boolean
	comfortable?: boolean
	dense?: boolean
	className?: string
}

const secondaryMetricDefs = [
	{
		key: "likes",
		labelKey: "selfMedia.likes",
		icon: Heart,
		getValue: (overview: SelfMediaOpsOverview, locale?: string) =>
			formatSelfMediaCompactNumber(getEngagementTotals(overview).likes, locale),
	},
	{
		key: "comments",
		labelKey: "selfMedia.comments",
		icon: MessageCircle,
		getValue: (overview: SelfMediaOpsOverview, locale?: string) =>
			formatSelfMediaCompactNumber(getEngagementTotals(overview).comments, locale),
	},
	{
		key: "saves",
		labelKey: "selfMedia.saves",
		icon: Bookmark,
		getValue: (overview: SelfMediaOpsOverview, locale?: string) =>
			formatSelfMediaCompactNumber(getEngagementTotals(overview).saves, locale),
	},
	{
		key: "shares",
		labelKey: "selfMedia.shares",
		icon: Send,
		getValue: (overview: SelfMediaOpsOverview, locale?: string) =>
			formatSelfMediaCompactNumber(getEngagementTotals(overview).shares, locale),
	},
] as const

const primaryMetricToneClassName = {
	reads: "border-[#d3dde1]/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.93)_0%,rgba(247,250,251,0.86)_100%)]",
	engagement:
		"border-[#d2e0da]/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.93)_0%,rgba(247,250,248,0.86)_100%)]",
	rate: "border-[#ead899]/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.9)_0%,rgba(255,249,229,0.82)_100%)]",
} satisfies Record<SelfMediaOpsMetricKey, string>

const primaryMetricAccentClassName = {
	reads: "text-[#657981]",
	engagement: "text-[#587266]",
	rate: "text-[#9b7b20]",
} satisfies Record<SelfMediaOpsMetricKey, string>

function SelfMediaOpsDataSummary({
	overview,
	values,
	statusLabels,
	motionStates,
	loading = false,
	comfortable = false,
	dense = false,
	className,
}: SelfMediaOpsDataSummaryProps) {
	const { t, i18n } = useTranslation("super")
	const secondaryLabels = {
		likes: t("selfMedia.likes"),
		comments: t("selfMedia.comments"),
		saves: t("selfMedia.saves"),
		shares: t("selfMedia.shares"),
	}
	const locale = i18n?.language
	const synced = overview.completion.metrics.done
	const total = overview.completion.metrics.total
	const averageReads = loading
		? t("selfMedia.syncing")
		: synced > 0
			? formatSelfMediaCompactNumber(overview.totalReads / synced, locale)
			: "--"
	const displayValues: Record<SelfMediaOpsMetricKey, string> = loading
		? {
				reads: t("selfMedia.syncing"),
				engagement: t("selfMedia.syncing"),
				rate: t("selfMedia.syncing"),
			}
		: values
	const displayStatusLabels: Record<SelfMediaOpsMetricKey, string> = loading
		? {
				reads: t("selfMedia.readingData"),
				engagement: t("selfMedia.readingData"),
				rate: t("selfMedia.readingData"),
			}
		: statusLabels

	return (
		<section
			className={cn(
				"rounded-[22px] border border-[#d4dcdd]/70 bg-[linear-gradient(135deg,rgba(250,251,250,0.94)_0%,rgba(246,248,246,0.84)_52%,rgba(255,249,226,0.48)_100%)] shadow-[inset_0_1px_rgba(255,255,255,0.82),0_18px_46px_rgba(38,65,72,0.09)] backdrop-blur",
				dense ? "p-3" : "p-4",
				className,
			)}
			data-testid="self-media-home-ops-data-summary"
		>
			<div
				className={cn(
					"flex flex-wrap items-center justify-between gap-3",
					dense ? "mb-2.5" : "mb-4",
				)}
			>
				<div>
					<h4 className="text-[13px] font-[820] text-[#18181b]">
						{t("selfMedia.opsSummaryTitle")}
					</h4>
					<p className="mt-1 text-[11px] font-[620] text-[#71717a]">
						{total > 0
							? t("selfMedia.syncedProgress", { synced, total })
							: t("selfMedia.waitingSync")}
					</p>
				</div>
				<div className="bg-white/64 rounded-full border border-white/70 px-3 py-1 text-[11px] font-[760] text-[#4f6670] shadow-[inset_0_1px_rgba(255,255,255,0.82)]">
					{t("selfMedia.avgReads", { value: averageReads })}
				</div>
			</div>
			<div
				className={cn(
					"grid",
					dense ? "gap-2" : "gap-3",
					comfortable ? "grid-cols-3" : "grid-cols-1",
				)}
			>
				<PrimaryMetricTile
					icon={<Eye size={dense ? 15 : 17} />}
					label={t("selfMedia.totalReads")}
					value={displayValues.reads}
					statusLabel={displayStatusLabels.reads}
					motionState={motionStates.reads}
					loading={loading}
					testId="self-media-home-ops-total-reads"
					comfortable={comfortable}
					dense={dense}
					tone="reads"
				/>
				<PrimaryMetricTile
					icon={<TrendingUp size={dense ? 15 : 17} />}
					label={t("selfMedia.totalInteractions")}
					value={displayValues.engagement}
					statusLabel={displayStatusLabels.engagement}
					motionState={motionStates.engagement}
					loading={loading}
					testId="self-media-home-ops-total-engagement"
					comfortable={comfortable}
					dense={dense}
					tone="engagement"
				/>
				<PrimaryMetricTile
					icon={<Activity size={dense ? 15 : 17} />}
					label={t("selfMedia.avgInteractionRate")}
					value={displayValues.rate}
					statusLabel={displayStatusLabels.rate}
					motionState={motionStates.rate}
					loading={loading}
					testId="self-media-home-ops-engagement-rate"
					comfortable={comfortable}
					dense={dense}
					tone="rate"
				/>
			</div>
			<div
				className={cn(
					"grid grid-cols-2 gap-2 min-[560px]:grid-cols-4",
					dense ? "mt-2" : "mt-3",
				)}
			>
				{secondaryMetricDefs.map((item) => {
					const Icon = item.icon
					return (
						<div
							key={item.key}
							className={cn(
								"bg-white/68 min-w-0 rounded-[16px] border border-[#d7e5e4]/75 px-3 text-[#5f6f73] shadow-[inset_0_1px_rgba(255,255,255,0.76)]",
								dense ? "py-1.5" : "py-2.5",
							)}
							data-testid={`self-media-home-ops-${item.key}`}
							data-loading={loading ? "true" : "false"}
						>
							<div className="flex items-center gap-1.5 text-[11px] font-[720]">
								<Icon size={13} />
								<span>{secondaryLabels[item.key]}</span>
							</div>
							<div
								className={cn(
									"mt-1 truncate font-[820] leading-none text-[#18181b]",
									dense ? "text-[13px]" : "text-[16px]",
								)}
							>
								{loading ? "—" : item.getValue(overview, locale)}
							</div>
						</div>
					)
				})}
			</div>
			{overview.bestPost ? (
				<div
					className={cn(
						"flex min-w-0 items-center gap-2 rounded-[16px] border border-[#d7e5e4]/70 bg-[linear-gradient(90deg,rgba(247,250,248,0.92)_0%,rgba(250,250,246,0.88)_100%)] px-3 text-[12px] font-[650] text-[#4f6670] shadow-[inset_0_1px_rgba(255,255,255,0.74)]",
						dense ? "mt-2 py-1.5" : "mt-3 py-2.5",
					)}
					data-testid="self-media-home-ops-best-post"
				>
					<TrendingUp size={14} className="shrink-0 text-[#587266]" />
					<span className="min-w-0 truncate">
						最佳样本：{overview.bestPost.title}，互动率{" "}
						{formatSelfMediaPercent(overview.bestPost.engagementRate)}
					</span>
				</div>
			) : null}
		</section>
	)
}

function getEngagementTotals(overview: SelfMediaOpsOverview) {
	const maybePartialOverview = overview as Partial<SelfMediaOpsOverview>
	return (
		maybePartialOverview.engagementTotals ?? {
			likes: 0,
			comments: 0,
			saves: 0,
			shares: 0,
		}
	)
}

function PrimaryMetricTile({
	icon,
	label,
	value,
	statusLabel,
	motionState,
	loading,
	testId,
	comfortable,
	dense,
	tone,
}: {
	icon: ReactNode
	label: string
	value: string
	statusLabel: string
	motionState: SelfMediaOpsMetricMotionState
	loading: boolean
	testId: string
	comfortable: boolean
	dense: boolean
	tone: SelfMediaOpsMetricKey
}) {
	return (
		<div
			className={cn(
				"min-w-0 rounded-[18px] border shadow-[inset_0_1px_rgba(255,255,255,0.86),0_10px_24px_rgba(38,65,72,0.07)]",
				dense ? "p-2.5" : "p-3.5",
				primaryMetricToneClassName[tone],
				motionState === "active" && "self-media-ops-metric-flow",
			)}
			data-motion={motionState}
			data-loading={loading ? "true" : "false"}
			data-testid={testId}
		>
			<div
				className={cn(
					"flex items-center gap-2 font-[740]",
					dense ? "text-[11px]" : "text-[12px]",
					primaryMetricAccentClassName[tone],
				)}
			>
				{icon}
				<span>{label}</span>
			</div>
			<div
				className={cn(
					"truncate font-[840] leading-none text-[#18181b]",
					dense ? "mt-1.5 text-[22px]" : "mt-2 text-[28px]",
					comfortable && !dense && "text-[30px]",
				)}
			>
				{value}
			</div>
			<div className={cn("text-[11px] font-[680] text-[#71717a]", dense ? "mt-1.5" : "mt-2")}>
				{statusLabel}
			</div>
		</div>
	)
}

export default SelfMediaOpsDataSummary

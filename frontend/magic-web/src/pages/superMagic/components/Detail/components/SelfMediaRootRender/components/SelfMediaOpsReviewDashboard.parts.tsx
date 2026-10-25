import {
	ArrowDownRight,
	ArrowUpRight,
	FileText,
	Loader2,
	Maximize2,
	Minimize2,
	RefreshCw,
	Sparkles,
	Target,
	X,
} from "lucide-react"
import { useTranslation } from "react-i18next"
import { Line, LineChart, XAxis, YAxis } from "recharts"
import { Button } from "@/components/shadcn-ui/button"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/shadcn-ui/chart"
import { SimpleEditor } from "@/components/tiptap-templates/simple/simple-editor"
import { cn } from "@/utils/cn"
import IsolatedHTMLRenderer from "@/pages/superMagic/components/Detail/contents/HTML/IsolatedHTMLRenderer"
import type { SelfMediaPlatformPostItem } from "../stores/SelfMediaStore"
import type {
	SelfMediaOpsReviewBriefItem,
	SelfMediaOpsReviewData,
	SelfMediaOpsReviewKpi,
	SelfMediaOpsReviewTrendPoint,
} from "./SelfMediaOpsReviewDashboard.helpers"
import { trendChartConfig } from "./SelfMediaOpsReviewDashboard.helpers"

const EMPTY_FILE_PATH_MAPPING = new Map<string, string>()
const NOOP_OPEN_NEW_TAB = () => undefined
const OPS_REVIEW_SOURCE_STATUSES = new Set([
	"pending",
	"fetched",
	"failed",
	"unknown",
	"completed",
	"success",
	"partial",
])

function normalizeOpsReviewSourceStatus(status: string) {
	return OPS_REVIEW_SOURCE_STATUSES.has(status) ? status : "unknown"
}

export function OpsReviewHeader({
	title,
	target,
	sourceStatus,
	syncing,
	onSync,
	onEditData,
	onClose,
}: {
	title: string
	target: SelfMediaPlatformPostItem
	sourceStatus: string
	syncing: boolean
	onSync?: () => void
	onEditData?: (target: SelfMediaPlatformPostItem) => void
	onClose: () => void
}) {
	const { t } = useTranslation("super")
	const normalizedSourceStatus = normalizeOpsReviewSourceStatus(sourceStatus)

	return (
		<header className="flex shrink-0 flex-col gap-3 border-b border-[#18181b]/[0.06] bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
			<div className="min-w-0 flex-1">
				<div className="flex flex-wrap items-center gap-2 text-xs">
					<span className="inline-flex items-center gap-1.5 rounded-full bg-[#18181b] px-2.5 py-1 font-[780] text-white shadow-[0_10px_22px_rgba(24,24,27,0.12)]">
						<Sparkles className="size-3.5 text-[#ffd637]" aria-hidden="true" />
						{t("detail.selfMedia.opsReview.title")}
					</span>
					<span
						className={cn(
							"rounded-full px-2.5 py-1 font-[700]",
							normalizedSourceStatus === "fetched" ||
								normalizedSourceStatus === "completed" ||
								normalizedSourceStatus === "success"
								? "bg-[#59b981]/12 text-[#377f59]"
								: normalizedSourceStatus === "failed"
									? "bg-destructive/10 text-destructive"
									: normalizedSourceStatus === "partial"
										? "bg-[#f59e0b]/12 text-[#8a5a00]"
										: "bg-[#f4f4f5] text-[#71717a]",
						)}
					>
						{t(`detail.selfMedia.opsReview.sourceStatus.${normalizedSourceStatus}`)}
					</span>
				</div>
				<h2 className="mt-2 truncate text-[18px] font-[820] leading-tight text-[#18181b]">
					{title}
				</h2>
			</div>
			<div className="flex min-w-0 shrink-0 items-center justify-end gap-2">
				{onSync ? (
					<Button
						type="button"
						variant="outline"
						size="sm"
						className="rounded-full border-0 bg-white px-3 text-[#18181b] shadow-[inset_0_0_0_1px_rgba(24,24,27,0.08)] hover:bg-white/85"
						onClick={onSync}
						disabled={syncing}
						data-testid="self-media-ops-review-sync"
					>
						{syncing ? (
							<Loader2 className="size-4 animate-spin" aria-hidden="true" />
						) : (
							<RefreshCw className="size-4" aria-hidden="true" />
						)}
						<span className="hidden sm:inline">
							{t("detail.selfMedia.opsReview.sync")}
						</span>
					</Button>
				) : null}
				{onEditData ? (
					<Button
						type="button"
						variant="outline"
						size="sm"
						className="rounded-full border-0 bg-white px-3 text-[#18181b] shadow-[inset_0_0_0_1px_rgba(24,24,27,0.08)] hover:bg-white/85"
						onClick={() => onEditData(target)}
						data-testid="self-media-ops-review-edit"
					>
						<span className="max-[420px]:hidden">
							{t("detail.selfMedia.opsReview.edit")}
						</span>
					</Button>
				) : null}
				<Button
					type="button"
					variant="ghost"
					size="icon"
					className="rounded-full text-[#71717a] hover:bg-[#f4f4f5] hover:text-[#18181b]"
					onClick={onClose}
					aria-label={t("detail.selfMedia.opsReview.close")}
					data-testid="self-media-ops-review-close"
				>
					<X className="size-4" aria-hidden="true" />
				</Button>
			</div>
		</header>
	)
}

export function CaseSummary({
	briefItems,
	readsDelta,
	trendData,
}: {
	briefItems: SelfMediaOpsReviewBriefItem[]
	readsDelta: number | null
	trendData: SelfMediaOpsReviewTrendPoint[]
}) {
	const { t } = useTranslation("super")

	return (
		<section
			className="bg-white/92 min-w-0 rounded-[24px] p-4 shadow-[inset_0_1px_rgba(255,255,255,0.82),0_18px_44px_rgba(47,43,36,0.06)] sm:p-5"
			data-testid="self-media-ops-review-case-summary"
		>
			<div className="mb-4 flex min-w-0 items-start justify-between gap-3">
				<div className="min-w-0">
					<div className="text-[11px] font-[800] uppercase text-[#ff776c]">
						{t("detail.selfMedia.opsReview.summaryTitle")}
					</div>
					<p className="mt-2 max-w-[42rem] text-[13px] leading-relaxed text-[#71717a]">
						{t("selfMedia.opsReviewIntro")}
					</p>
				</div>
				<DeltaBadge delta={readsDelta} />
			</div>
			<div className="grid gap-2 sm:grid-cols-3">
				{briefItems.map((item) => (
					<div key={item.label} className="rounded-[16px] bg-[#f8f8f9] px-3 py-2.5">
						<div className="text-[11px] font-[650] text-[#71717a]">{item.label}</div>
						<div className="mt-1 truncate text-[15px] font-[820] text-[#18181b]">
							{item.value}
						</div>
					</div>
				))}
			</div>
			<SummaryTrend trendData={trendData} />
		</section>
	)
}

function SummaryTrend({ trendData }: { trendData: SelfMediaOpsReviewTrendPoint[] }) {
	const { t } = useTranslation("super")
	const hasTrend = trendData.filter((item) => item.reads !== null).length >= 2

	return (
		<div
			className="mt-4 rounded-[18px] bg-[#18181b] px-3 py-3 text-white shadow-[inset_0_1px_rgba(255,255,255,0.12)]"
			data-testid="self-media-ops-review-summary-trend"
		>
			<div className="mb-2 flex items-center justify-between gap-3">
				<div className="text-xs font-[820]">
					{t("detail.selfMedia.opsReview.summaryTrendTitle")}
				</div>
				<div className="text-white/56 text-[11px] font-[680]">
					{t("detail.selfMedia.opsReview.deltaReads")}
				</div>
			</div>
			{hasTrend ? (
				<ChartContainer
					config={trendChartConfig}
					className="h-24 min-h-24 w-full min-w-0 focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 [&_*]:focus:outline-none [&_*]:focus-visible:outline-none"
					data-testid="self-media-ops-review-summary-trend-chart"
				>
					<LineChart data={trendData} margin={{ top: 6, right: 8, left: -24, bottom: 0 }}>
						<XAxis
							dataKey="label"
							tickLine={false}
							axisLine={false}
							tickMargin={6}
							tick={{ fill: "rgba(255,255,255,0.48)", fontSize: 10 }}
						/>
						<YAxis hide domain={["dataMin", "dataMax"]} />
						<ChartTooltip content={<ChartTooltipContent />} />
						<Line
							dataKey="reads"
							type="linear"
							connectNulls
							stroke="#ffd637"
							strokeWidth={3}
							dot={{
								r: 3,
								fill: "#ffd637",
								stroke: "#18181b",
								strokeWidth: 1.5,
							}}
							activeDot={{
								r: 5,
								fill: "#ffd637",
								stroke: "#fff",
								strokeWidth: 2,
							}}
						/>
					</LineChart>
				</ChartContainer>
			) : (
				<div className="border-white/14 text-white/58 flex h-24 items-center justify-center rounded-[14px] border border-dashed bg-white/[0.06] px-4 text-center text-xs leading-relaxed">
					{t("detail.selfMedia.opsReview.summaryTrendEmpty")}
				</div>
			)}
		</div>
	)
}

export function KpiStrip({ kpis }: { kpis: SelfMediaOpsReviewKpi[] }) {
	return (
		<section
			className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5"
			data-testid="self-media-ops-review-kpis"
		>
			{kpis.map((item) => (
				<div
					key={item.key}
					className="bg-white/92 min-h-24 min-w-0 rounded-[20px] p-4 shadow-[inset_0_1px_rgba(255,255,255,0.82),0_14px_34px_rgba(47,43,36,0.05)]"
				>
					<div className="text-xs font-[650] text-[#71717a]">{item.label}</div>
					<div className="mt-2 text-[28px] font-[840] leading-none text-[#18181b]">
						{item.value}
					</div>
					<div className="mt-2 text-[11px] leading-relaxed text-[#71717a]">
						{item.hint}
					</div>
				</div>
			))}
		</section>
	)
}

export function NextActions({ items }: { items: string[] }) {
	const { t } = useTranslation("super")

	return (
		<section
			className="min-w-0 rounded-[24px] bg-[#18181b] p-4 text-white shadow-[0_22px_54px_rgba(24,24,27,0.16),inset_0_1px_rgba(255,255,255,0.16)] sm:p-5"
			data-testid="self-media-ops-review-next-actions"
		>
			<div className="mb-3 flex items-center gap-2 text-sm font-[820]">
				<Target className="size-4 text-[#ffd637]" />
				{t("detail.selfMedia.opsReview.actionsTitle")}
			</div>
			<div className="space-y-2">
				{items.map((item, index) => (
					<div
						key={`${item}-${index}`}
						className="text-white/86 flex gap-2 rounded-[16px] bg-white/[0.08] px-3 py-2 text-xs leading-relaxed"
					>
						<span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-[#ffd637] text-[10px] font-[840] text-[#18181b]">
							{index + 1}
						</span>
						<span>{item}</span>
					</div>
				))}
			</div>
		</section>
	)
}

export function CommentSignals({ data }: { data: SelfMediaOpsReviewData | null }) {
	const { t } = useTranslation("super")
	const comments = data?.comments?.comments?.slice(0, 3) ?? []

	return (
		<section
			className="bg-white/92 min-w-0 rounded-[24px] p-4 shadow-[inset_0_1px_rgba(255,255,255,0.82),0_18px_44px_rgba(47,43,36,0.06)] sm:p-5"
			data-testid="self-media-ops-review-comment-signals"
		>
			<div className="flex flex-wrap items-center justify-between gap-2">
				<h3 className="text-sm font-[820] text-[#18181b]">
					{t("detail.selfMedia.opsReview.commentsTitle")}
				</h3>
				<span className="rounded-full bg-[#cdeb55]/20 px-2.5 py-1 text-[11px] font-[760] text-[#6f821d]">
					{t("detail.selfMedia.opsReview.conversionSignal")}
				</span>
			</div>
			<div data-testid="self-media-ops-review-comments">
				<p className="mt-2 text-sm leading-relaxed text-[#71717a]">
					{data?.comments?.summary || t("detail.selfMedia.opsReview.empty")}
				</p>
				<div className="mt-3 space-y-2">
					{comments.length > 0 ? (
						comments.map((comment) => (
							<div
								key={comment.id}
								className="rounded-[16px] bg-[#f8f8f9] px-3 py-2 text-xs"
							>
								<div className="font-[760] text-[#18181b]">
									{comment.author || "User"}
								</div>
								<div className="mt-1 line-clamp-2 text-[#71717a]">
									{comment.text}
								</div>
							</div>
						))
					) : (
						<EmptyBlock text={t("detail.selfMedia.opsReview.empty")} compact />
					)}
				</div>
			</div>
		</section>
	)
}

export function ReportPreview({
	hasReviewContent,
	refreshing = false,
	onRefresh,
	onFullscreen,
	children,
}: {
	hasReviewContent: boolean
	refreshing?: boolean
	onRefresh?: () => void
	onFullscreen: () => void
	children: React.ReactNode
}) {
	const { t } = useTranslation("super")

	return (
		<section
			className="min-w-0 rounded-lg border bg-white shadow-xs"
			data-testid="self-media-ops-review-report-preview"
		>
			<div className="flex items-center justify-between gap-3 border-b px-4 py-3">
				<h3 className="text-sm font-[820] text-[#18181b]">
					{t("detail.selfMedia.opsReview.reviewTitle")}
				</h3>
				<div className="flex shrink-0 items-center gap-2">
					<Button
						type="button"
						variant="ghost"
						size="sm"
						className="h-8 rounded-full px-2 text-[#71717a] hover:bg-[#f4f4f5] hover:text-[#18181b]"
						disabled={!onRefresh || refreshing}
						onClick={onRefresh}
						aria-label={t("detail.selfMedia.opsReview.refreshReport")}
						data-testid="self-media-ops-review-refresh"
					>
						<RefreshCw
							className={cn("size-4", refreshing && "animate-spin")}
							aria-hidden="true"
						/>
						<span className="hidden sm:inline">
							{t("detail.selfMedia.opsReview.refreshReport")}
						</span>
					</Button>
					<Button
						type="button"
						variant="ghost"
						size="sm"
						className="h-8 rounded-full px-2 text-[#71717a] hover:bg-[#f4f4f5] hover:text-[#18181b]"
						disabled={!hasReviewContent}
						onClick={onFullscreen}
						aria-label={t("detail.selfMedia.opsReview.fullscreen")}
						data-testid="self-media-ops-review-fullscreen"
					>
						<Maximize2 className="size-4" aria-hidden="true" />
						<span className="hidden sm:inline">
							{t("detail.selfMedia.opsReview.fullscreen")}
						</span>
					</Button>
				</div>
			</div>
			{children}
		</section>
	)
}

export function OpsReviewHtmlPreview({
	content,
	htmlRelativeFolderPath,
	isFullscreen = false,
}: {
	content: string
	htmlRelativeFolderPath: string
	isFullscreen?: boolean
}) {
	return (
		<div
			className={cn(
				"w-full overflow-hidden bg-white",
				isFullscreen
					? "h-full min-h-0 rounded-lg border"
					: "h-[min(560px,calc(100vh-220px))] min-h-[320px]",
			)}
			data-testid="self-media-ops-review-html-preview"
		>
			<IsolatedHTMLRenderer
				content={content}
				rawSourceCode={content}
				sandboxType="iframe"
				filePathMapping={EMPTY_FILE_PATH_MAPPING}
				openNewTab={NOOP_OPEN_NEW_TAB}
				htmlRelativeFolderPath={htmlRelativeFolderPath}
				isVisible
				isFullscreen={isFullscreen}
				containIframeOverscroll
				disableDynamicResourceInterception
			/>
		</div>
	)
}

export function OpsReviewMarkdownPreview({
	content,
	isFullscreen = false,
}: {
	content: string
	isFullscreen?: boolean
}) {
	return (
		<div
			className={cn(
				"overflow-auto text-sm leading-relaxed text-[#18181b] [&_a]:text-[#4f7cff] [&_code]:rounded [&_code]:bg-slate-100 [&_code]:px-1 [&_h1]:mb-3 [&_h1]:text-2xl [&_h1]:font-semibold [&_h2]:mb-2 [&_h2]:mt-5 [&_h2]:text-lg [&_h2]:font-semibold [&_li]:mb-1 [&_ol]:ml-5 [&_p]:mb-3 [&_strong]:font-semibold [&_ul]:ml-5 [&_ul]:list-disc",
				isFullscreen ? "h-full rounded-lg border bg-white p-5" : "max-h-[560px] p-5",
			)}
			data-testid="self-media-ops-review-markdown-preview"
		>
			<SimpleEditor
				isEditable={false}
				enableDragHandle={false}
				enableSearchReplace={false}
				className="!h-auto !overflow-visible [&_.simple-editor-content]:!h-auto [&_.simple-editor-content]:!overflow-visible [&_.simple-editor]:!p-0"
				content={content}
			/>
		</div>
	)
}

export function FullscreenReviewHeader({ onExit }: { onExit: () => void }) {
	const { t } = useTranslation("super")

	return (
		<div className="flex shrink-0 items-center justify-between gap-3 border-b bg-white px-4 py-3">
			<h3 className="min-w-0 truncate text-sm font-[820] text-[#18181b]">
				{t("detail.selfMedia.opsReview.reviewTitle")}
			</h3>
			<Button
				type="button"
				variant="outline"
				size="sm"
				className="rounded-full border-0 bg-white px-3 text-[#18181b] shadow-[inset_0_0_0_1px_rgba(24,24,27,0.08)] hover:bg-white/85"
				onClick={onExit}
				aria-label={t("detail.selfMedia.opsReview.exitFullscreen")}
				data-testid="self-media-ops-review-exit-fullscreen"
			>
				<Minimize2 className="size-4" aria-hidden="true" />
				<span>{t("detail.selfMedia.opsReview.exitFullscreen")}</span>
			</Button>
		</div>
	)
}

export function EmptyBlock({ text, compact = false }: { text: string; compact?: boolean }) {
	return (
		<div
			className={cn(
				"flex flex-col items-center justify-center gap-2 rounded-[16px] border border-dashed border-[#18181b]/10 bg-[#f8f8f9] text-sm text-[#71717a]",
				compact ? "min-h-20 px-3 py-4" : "min-h-32 px-4 py-6",
			)}
		>
			<FileText className="size-5" aria-hidden="true" />
			{text}
		</div>
	)
}

function DeltaBadge({ delta }: { delta: number | null }) {
	const { t } = useTranslation("super")
	if (delta === null) return null
	const positive = delta >= 0
	const Icon = positive ? ArrowUpRight : ArrowDownRight
	return (
		<div className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#f8f8f9] px-2.5 py-1 text-xs font-[720] text-[#71717a]">
			<Icon className={cn("size-3.5", positive ? "text-[#59b981]" : "text-destructive")} />
			<span>{t("detail.selfMedia.opsReview.deltaReads")}</span>
			<span className="text-[#18181b]">{positive ? `+${delta}` : delta}</span>
		</div>
	)
}

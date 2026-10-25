import { ArrowDownRight, ArrowUpRight, FileText } from "lucide-react"
import { useTranslation } from "react-i18next"
import {
	Area,
	AreaChart,
	Bar,
	BarChart,
	CartesianGrid,
	Cell,
	Pie,
	PieChart,
	XAxis,
	YAxis,
} from "recharts"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/shadcn-ui/chart"
import { cn } from "@/utils/cn"
import type {
	SelfMediaOpsReviewFunnelItem,
	SelfMediaOpsReviewImpactItem,
	SelfMediaOpsReviewTrendPoint,
} from "./SelfMediaOpsReviewDashboard.helpers"
import {
	impactChartConfig,
	OPS_PALETTE,
	QUALITY_COLORS,
	trendChartConfig,
} from "./SelfMediaOpsReviewDashboard.helpers"

export function ChartsSection({
	trendData,
	impactData,
	qualityData,
	funnelItems,
	readsDelta,
}: {
	trendData: SelfMediaOpsReviewTrendPoint[]
	impactData: SelfMediaOpsReviewImpactItem[]
	qualityData: SelfMediaOpsReviewImpactItem[]
	funnelItems: SelfMediaOpsReviewFunnelItem[]
	readsDelta: number | null
}) {
	const { t } = useTranslation("super")

	return (
		<section
			className="grid min-w-0 grid-cols-1 gap-3 xl:grid-cols-2 2xl:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)_minmax(260px,0.72fr)]"
			data-testid="self-media-ops-review-chart-grid"
		>
			<section
				className="bg-white/92 min-w-0 rounded-[24px] p-4 shadow-[inset_0_1px_rgba(255,255,255,0.82),0_18px_44px_rgba(47,43,36,0.06)]"
				data-testid="self-media-ops-review-trend"
			>
				<div className="mb-3 flex items-center justify-between gap-3">
					<h3 className="text-sm font-[820] text-[#18181b]">
						{t("detail.selfMedia.opsReview.trendTitle")}
					</h3>
					<DeltaBadge delta={readsDelta} />
				</div>
				{trendData.length > 0 ? (
					<ChartContainer
						config={trendChartConfig}
						className="h-52 w-full min-w-0"
						data-testid="self-media-ops-review-trend-chart"
					>
						<AreaChart
							data={trendData}
							margin={{ top: 12, right: 12, left: -12, bottom: 0 }}
						>
							<defs>
								<linearGradient
									id="self-media-ops-reads-gradient"
									x1="0"
									y1="0"
									x2="0"
									y2="1"
								>
									<stop
										offset="5%"
										stopColor="var(--color-reads)"
										stopOpacity={0.28}
									/>
									<stop
										offset="95%"
										stopColor="var(--color-reads)"
										stopOpacity={0.03}
									/>
								</linearGradient>
							</defs>
							<CartesianGrid vertical={false} strokeDasharray="4 4" />
							<XAxis
								dataKey="label"
								tickLine={false}
								axisLine={false}
								tickMargin={8}
							/>
							<YAxis
								tickLine={false}
								axisLine={false}
								width={44}
								domain={[
									(dataMin: number) => Math.max(0, Math.floor(dataMin * 0.92)),
									(dataMax: number) => Math.ceil(dataMax * 1.08),
								]}
							/>
							<ChartTooltip content={<ChartTooltipContent />} />
							<Area
								dataKey="reads"
								type="linear"
								connectNulls
								fill="url(#self-media-ops-reads-gradient)"
								stroke="var(--color-reads)"
								strokeWidth={3}
								dot={{
									r: 4,
									fill: OPS_PALETTE.ink,
									stroke: "#fff",
									strokeWidth: 2,
								}}
								activeDot={{
									r: 6,
									fill: OPS_PALETTE.ink,
									stroke: "#fff",
									strokeWidth: 2,
								}}
							/>
						</AreaChart>
					</ChartContainer>
				) : (
					<ChartEmptyBlock text={t("detail.selfMedia.opsReview.empty")} />
				)}
			</section>

			<section
				className="bg-white/92 min-w-0 rounded-[24px] p-4 shadow-[inset_0_1px_rgba(255,255,255,0.82),0_18px_44px_rgba(47,43,36,0.06)]"
				data-testid="self-media-ops-review-impact-map"
			>
				<h3 className="mb-3 text-sm font-[820] text-[#18181b]">
					{t("detail.selfMedia.opsReview.impactTitle")}
				</h3>
				{impactData.length ? (
					<ChartContainer config={impactChartConfig} className="h-52 w-full min-w-0">
						<BarChart data={impactData} layout="vertical">
							<CartesianGrid horizontal={false} />
							<XAxis type="number" hide />
							<YAxis
								type="category"
								dataKey="label"
								tickLine={false}
								axisLine={false}
								width={68}
							/>
							<ChartTooltip content={<ChartTooltipContent />} />
							<Bar dataKey="value" fill="var(--color-value)" radius={8} />
						</BarChart>
					</ChartContainer>
				) : (
					<ChartEmptyBlock text={t("detail.selfMedia.opsReview.empty")} />
				)}
			</section>

			<section
				className="bg-white/92 min-w-0 rounded-[24px] p-4 shadow-[inset_0_1px_rgba(255,255,255,0.82),0_18px_44px_rgba(47,43,36,0.06)] xl:col-span-2 2xl:col-span-1"
				data-testid="self-media-ops-review-quality-mix"
			>
				<h3 className="mb-3 text-sm font-[820] text-[#18181b]">
					{t("detail.selfMedia.opsReview.qualityTitle")}
				</h3>
				{qualityData.length ? (
					<div className="grid min-w-0 grid-cols-1 items-center gap-3 min-[420px]:grid-cols-[120px_minmax(0,1fr)]">
						<ChartContainer
							config={impactChartConfig}
							className="mx-auto h-32 w-32 min-w-0 min-[420px]:mx-0"
						>
							<PieChart>
								<Pie
									data={qualityData}
									dataKey="value"
									nameKey="label"
									innerRadius={34}
									outerRadius={56}
									paddingAngle={3}
								>
									{qualityData.map((entry, index) => (
										<Cell
											key={entry.label}
											fill={QUALITY_COLORS[index % QUALITY_COLORS.length]}
										/>
									))}
								</Pie>
								<ChartTooltip content={<ChartTooltipContent />} />
							</PieChart>
						</ChartContainer>
						<div className="min-w-0 space-y-1.5">
							{qualityData.map((item, index) => (
								<div
									key={item.label}
									className="flex items-center justify-between gap-3 text-xs"
								>
									<span className="inline-flex min-w-0 items-center gap-1.5 text-[#71717a]">
										<span
											className="size-2 rounded-full"
											style={{
												background:
													QUALITY_COLORS[index % QUALITY_COLORS.length],
											}}
										/>
										<span className="truncate">{item.label}</span>
									</span>
									<span className="shrink-0 font-[760] text-[#18181b]">
										{item.value}
									</span>
								</div>
							))}
						</div>
					</div>
				) : (
					<ChartEmptyBlock text={t("detail.selfMedia.opsReview.empty")} />
				)}
			</section>

			<section
				className="bg-white/92 min-w-0 rounded-[24px] p-4 shadow-[inset_0_1px_rgba(255,255,255,0.82),0_18px_44px_rgba(47,43,36,0.06)] xl:col-span-2 2xl:col-span-3"
				data-testid="self-media-ops-review-efficiency-funnel"
			>
				<h3 className="mb-3 text-sm font-[820] text-[#18181b]">
					{t("detail.selfMedia.opsReview.funnelTitle")}
				</h3>
				<div className="grid gap-3 md:grid-cols-3">
					{funnelItems.map((item) => (
						<div key={item.key} className="rounded-[16px] bg-[#f8f8f9] px-3 py-3">
							<div className="mb-2 flex items-center justify-between text-xs">
								<span className="font-[650] text-[#71717a]">{item.label}</span>
								<span className="font-[800] text-[#18181b]">{item.value}</span>
							</div>
							<div className="h-2 overflow-hidden rounded-full bg-white shadow-[inset_0_0_0_1px_rgba(24,24,27,0.04)]">
								<div
									className="h-full rounded-full"
									style={{ width: `${item.percent}%`, background: item.color }}
								/>
							</div>
						</div>
					))}
				</div>
			</section>
		</section>
	)
}

function ChartEmptyBlock({ text }: { text: string }) {
	return (
		<div className="flex min-h-32 flex-col items-center justify-center gap-2 rounded-[16px] border border-dashed border-[#18181b]/10 bg-[#f8f8f9] px-4 py-6 text-sm text-[#71717a]">
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

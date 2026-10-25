import { useMemo, useState } from "react"
import { Info } from "lucide-react"
import { observer } from "mobx-react-lite"
import { useTranslation } from "react-i18next"
import {
	Bar,
	BarChart,
	CartesianGrid,
	PolarAngleAxis,
	PolarGrid,
	Radar,
	RadarChart,
	XAxis,
	YAxis,
} from "recharts"
import {
	ChartContainer,
	ChartLegend,
	ChartLegendContent,
	ChartTooltip,
	ChartTooltipContent,
	type ChartConfig,
} from "@/components/shadcn-ui/chart"
import { cn } from "@/utils/cn"
import { usePersonaResearchStore } from "../context"
import { chooseDimensionChart, LEVEL_SCORE } from "../services/researchAnalysis"
import type { QualitativeLevel, SynthesisFile } from "../types"
import { QuoteItem } from "./ResearchBadges"
import type { OpenQuote } from "./ThemeMatrix"

/** rgb tokens work in Chrome 100 (the product baseline), unlike oklch. */
const SERIES_COLORS = [
	"rgb(var(--chart-1-rgb))",
	"rgb(var(--chart-2-rgb))",
	"rgb(var(--chart-3-rgb))",
	"rgb(var(--chart-4-rgb))",
	"rgb(var(--chart-5-rgb))",
]

/**
 * Importance of each dimension by segment. Levels are qualitative (high/medium/low → 3/2/1)
 * and the caption says so; no decimals are ever shown. Clicking a dimension lists its quotes.
 */
function DimensionChart({
	synthesis,
	onOpenQuote,
}: {
	synthesis: SynthesisFile
	onOpenQuote: OpenQuote
}) {
	const { t } = useTranslation("personaResearch")
	const store = usePersonaResearchStore()
	const dimensions = useMemo(() => synthesis.dimensions ?? [], [synthesis.dimensions])
	const [activeId, setActiveId] = useState<string | null>(null)

	const segments = useMemo(() => {
		const ids = new Set(
			dimensions.flatMap((dimension) => Object.keys(dimension.level_by_segment)),
		)
		return [...ids].map((id, index) => ({
			id,
			// Chart config keys become CSS variables; keep them simple and stable.
			key: `s${index}`,
			name: synthesis.segments.find((segment) => segment.id === id)?.name ?? id,
		}))
	}, [dimensions, synthesis.segments])

	const levelLabel: Record<QualitativeLevel, string> = {
		high: t("level.high"),
		medium: t("level.medium"),
		low: t("level.low"),
	}

	const data = dimensions.map((dimension) => {
		const row: Record<string, string | number> = { name: dimension.name }
		for (const segment of segments) {
			const level = dimension.level_by_segment[segment.id]
			row[segment.key] = level ? LEVEL_SCORE[level] : 0
		}
		return row
	})
	const config = Object.fromEntries(
		segments.map((segment, index) => [
			segment.key,
			{ label: segment.name, color: SERIES_COLORS[index % SERIES_COLORS.length] },
		]),
	) satisfies ChartConfig

	if (dimensions.length === 0 || segments.length === 0) return null

	const chartType = chooseDimensionChart(dimensions.length, segments.length)
	const scoreLabel = (value: number) =>
		value >= 3
			? levelLabel.high
			: value >= 2
				? levelLabel.medium
				: value >= 1
					? levelLabel.low
					: ""
	const tooltip = (
		<ChartTooltip
			content={
				<ChartTooltipContent
					formatter={(value, name) => (
						<span className="flex w-full justify-between gap-3">
							<span className="text-muted-foreground">
								{config[String(name)]?.label ?? name}
							</span>
							<span className="font-medium">{scoreLabel(Number(value))}</span>
						</span>
					)}
				/>
			}
		/>
	)
	const active = dimensions.find((dimension) => dimension.id === activeId) ?? null

	return (
		<div className="flex flex-col gap-3">
			<ChartContainer config={config} className="aspect-auto h-72 w-full">
				{chartType === "radar" ? (
					<RadarChart data={data} outerRadius="72%">
						<PolarGrid />
						<PolarAngleAxis dataKey="name" tick={{ fontSize: 11 }} />
						{tooltip}
						{segments.map((segment) => (
							<Radar
								key={segment.key}
								dataKey={segment.key}
								stroke={`var(--color-${segment.key})`}
								fill={`var(--color-${segment.key})`}
								fillOpacity={0.15}
							/>
						))}
						<ChartLegend
							// Recharts injects the legend payload at render time.
							content={({ payload, verticalAlign }) => (
								<ChartLegendContent
									payload={payload}
									verticalAlign={verticalAlign}
								/>
							)}
						/>
					</RadarChart>
				) : (
					<BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
						<CartesianGrid vertical={false} />
						<XAxis
							dataKey="name"
							tickLine={false}
							axisLine={false}
							tick={{ fontSize: 11 }}
						/>
						<YAxis
							domain={[0, 3]}
							ticks={[1, 2, 3]}
							tickFormatter={scoreLabel}
							tickLine={false}
							axisLine={false}
							width={40}
						/>
						{tooltip}
						{segments.map((segment) => (
							<Bar
								key={segment.key}
								dataKey={segment.key}
								fill={`var(--color-${segment.key})`}
								radius={4}
							/>
						))}
						<ChartLegend
							// Recharts injects the legend payload at render time.
							content={({ payload, verticalAlign }) => (
								<ChartLegendContent
									payload={payload}
									verticalAlign={verticalAlign}
								/>
							)}
						/>
					</BarChart>
				)}
			</ChartContainer>
			<p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
				<Info className="size-3.5" />
				{t("analysis.chartCaption")}
			</p>
			<div className="flex flex-wrap gap-1.5">
				{dimensions.map((dimension) => (
					<button
						key={dimension.id}
						type="button"
						aria-pressed={dimension.id === activeId}
						onClick={() => setActiveId(dimension.id === activeId ? null : dimension.id)}
						className={cn(
							"rounded-full border px-2.5 py-1 text-xs outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
							dimension.id === activeId
								? "border-primary bg-primary/10 text-primary"
								: "border-border text-muted-foreground hover:text-foreground",
						)}
					>
						{dimension.name}
						<span className="ml-1 opacity-70">{dimension.quote_refs?.length ?? 0}</span>
					</button>
				))}
			</div>
			{active?.quote_refs?.length ? (
				<div className="grid gap-1.5 sm:grid-cols-2">
					{active.quote_refs.map((quote, index) => (
						<QuoteItem
							key={index}
							quote={quote}
							personaName={
								store.personaById(quote.persona_id)?.name ?? quote.persona_id
							}
							onOpen={() => onOpenQuote(quote)}
						/>
					))}
				</div>
			) : null}
		</div>
	)
}

export default observer(DimensionChart)

import { ChartColumn, Globe, Layers3, Mic, TriangleAlert, UserCheck, Waves } from "lucide-react"
import { observer } from "mobx-react-lite"
import { useTranslation } from "react-i18next"
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/components/shadcn-ui/empty"
import { ScrollArea } from "@/components/shadcn-ui/scroll-area"
import { cn } from "@/utils/cn"
import { usePersonaResearchStore } from "../context"
import type { AgreementLevel, SynthesisTheme } from "../types"
import DimensionChart from "./DimensionChart"
import { AgreementBadge, ConfidenceBadge } from "./ResearchBadges"
import { CARD_SURFACE, CONFIDENCE_ACCENT } from "./surface"
import ThemeMatrix, { ThemePopover, type OpenQuote } from "./ThemeMatrix"

interface AnalysisBoardProps {
	onOpenQuote: OpenQuote
	onOpenSources?: () => void
}

/**
 * Structured analysis behind the report, all read from synthesis.json:
 * saturation, theme × persona matrix, dimension chart and themes with evidence bars.
 */
function AnalysisBoard({ onOpenQuote, onOpenSources }: AnalysisBoardProps) {
	const { t } = useTranslation("personaResearch")
	const store = usePersonaResearchStore()
	const synthesis = store.synthesis

	if (!synthesis) {
		const reportStarted = store.study?.phases.some(
			(phase) => phase.key === "report" && phase.status !== "pending",
		)
		return (
			<Empty className="h-full border-0 py-12">
				<EmptyHeader>
					<EmptyMedia variant="icon">
						<ChartColumn />
					</EmptyMedia>
					<EmptyTitle className="text-sm">{t("analysis.emptyTitle")}</EmptyTitle>
					<EmptyDescription className="text-xs">
						{reportStarted && store.study?.phase === "done"
							? t("analysis.emptyLegacy")
							: t("analysis.empty")}
					</EmptyDescription>
				</EmptyHeader>
			</Empty>
		)
	}

	/** Real-person agreement for a theme: the weakest agreement among its hypotheses. */
	const validationOf = (theme: SynthesisTheme): AgreementLevel | null => {
		const rows = (store.validationResults?.by_hypothesis ?? []).filter((row) =>
			theme.hypothesis_ids?.includes(row.hypothesis_id),
		)
		if (rows.length === 0) return null
		if (rows.some((row) => row.agreement === "disagree")) return "disagree"
		if (rows.some((row) => row.agreement === "partial")) return "partial"
		return "agree"
	}

	const saturation = synthesis.saturation

	return (
		// Radix wraps the content in a display:table box that grows to the widest child (the theme
		// matrix); forcing block keeps banners and cards inside the viewport width on narrow screens.
		<ScrollArea className="h-full" viewportClassName="[&>div]:!block">
			<div className="mx-auto flex max-w-5xl flex-col gap-6 p-4">
				{synthesis.homogeneity?.warning ? (
					// Unanimous AI answers read as strong evidence but often mean the model answered alike.
					<div className="flex items-start gap-2.5 rounded-xl bg-amber-500/10 p-3 text-xs leading-5">
						<TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-600" />
						<div className="flex flex-col gap-0.5">
							<span className="font-medium text-foreground">
								{t("analysis.homogeneityTitle")}
							</span>
							<span className="text-muted-foreground">
								{t("analysis.homogeneityText", {
									count: synthesis.homogeneity.unanimous_theme_ids.length,
								})}
							</span>
						</div>
					</div>
				) : null}
				{saturation ? (
					<div
						className={cn(
							"flex items-start gap-2.5 rounded-xl p-3 text-xs leading-5",
							saturation.saturated ? "bg-emerald-500/[0.08]" : "bg-amber-500/10",
						)}
					>
						<Waves
							className={cn(
								"mt-0.5 size-4 shrink-0",
								saturation.saturated ? "text-emerald-600" : "text-amber-600",
							)}
						/>
						<div className="flex flex-col gap-1">
							<span className="font-medium text-foreground">
								{saturation.saturated
									? t("analysis.saturated")
									: t("analysis.notSaturated")}
							</span>
							{saturation.new_themes_per_interview.length ? (
								<span
									className="flex items-end gap-1"
									aria-label={t("analysis.newThemesTrend")}
								>
									{saturation.new_themes_per_interview.map((count, index) => (
										<span
											key={index}
											className="flex flex-col items-center gap-0.5"
										>
											<span
												className="w-3 rounded-sm bg-foreground/30"
												// Bar height mirrors the count of new themes; capped so one outlier cannot dominate.
												style={{
													height: `${Math.max(2, Math.min(count, 6) * 4)}px`,
												}}
											/>
											<span className="text-[10px] tabular-nums text-muted-foreground">
												{count}
											</span>
										</span>
									))}
									<span className="ml-1 text-muted-foreground">
										{t("analysis.newThemesTrend")}
									</span>
								</span>
							) : null}
						</div>
					</div>
				) : null}

				<Section icon={<Layers3 className="size-4" />} title={t("analysis.matrixTitle")}>
					<ThemeMatrix
						synthesis={synthesis}
						onOpenQuote={onOpenQuote}
						onOpenSources={onOpenSources}
					/>
				</Section>

				{synthesis.dimensions?.length ? (
					<Section
						icon={<ChartColumn className="size-4" />}
						title={t("analysis.dimensionsTitle")}
					>
						<DimensionChart synthesis={synthesis} onOpenQuote={onOpenQuote} />
					</Section>
				) : null}

				<Section icon={<Layers3 className="size-4" />} title={t("analysis.themesTitle")}>
					<ul className="flex flex-col gap-2">
						{synthesis.themes.map((theme) => {
							const interviewed = Object.values(theme.stance_by_persona).filter(
								(stance) => stance !== "not_mentioned",
							).length
							const validation = validationOf(theme)
							return (
								<li
									key={theme.id}
									className={cn(
										CARD_SURFACE,
										"relative overflow-hidden py-3.5 pl-5 pr-4",
									)}
								>
									<span
										aria-hidden
										className={cn(
											"absolute inset-y-0 left-0 w-1",
											CONFIDENCE_ACCENT[theme.confidence],
										)}
									/>
									<div className="flex items-start justify-between gap-3">
										<ThemePopover
											theme={theme}
											onOpenQuote={onOpenQuote}
											onOpenSources={onOpenSources}
										>
											<button
												type="button"
												className="text-left text-sm font-semibold text-foreground underline-offset-2 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
											>
												{theme.name}
											</button>
										</ThemePopover>
										<ConfidenceBadge confidence={theme.confidence} />
									</div>
									{theme.description ? (
										<p className="mt-1 text-xs leading-5 text-muted-foreground">
											{theme.description}
										</p>
									) : null}
									{/* Evidence bar: where the theme's support comes from, in one line. */}
									<div className="mt-2.5 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
										<span className="inline-flex items-center gap-1">
											<Globe className="size-3.5" />
											{t("analysis.webSources", {
												count: theme.source_refs?.length ?? 0,
											})}
										</span>
										<span className="inline-flex items-center gap-1">
											<Mic className="size-3.5" />
											{t("analysis.aiInterviews", { count: interviewed })}
										</span>
										<span className="inline-flex items-center gap-1">
											<UserCheck className="size-3.5" />
											{validation ? (
												<AgreementBadge agreement={validation} />
											) : (
												t("analysis.notValidated")
											)}
										</span>
									</div>
								</li>
							)
						})}
					</ul>
				</Section>
			</div>
		</ScrollArea>
	)
}

function Section({
	icon,
	title,
	children,
}: {
	icon: React.ReactNode
	title: string
	children: React.ReactNode
}) {
	return (
		<section className="flex flex-col gap-3">
			<h3 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
				<span className="text-muted-foreground">{icon}</span>
				{title}
			</h3>
			{children}
		</section>
	)
}

export default observer(AnalysisBoard)

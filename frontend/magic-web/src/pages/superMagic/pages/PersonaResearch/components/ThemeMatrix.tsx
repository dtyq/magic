import { useMemo, type ReactNode } from "react"
import { observer } from "mobx-react-lite"
import { useTranslation } from "react-i18next"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/shadcn-ui/popover"
import { cn } from "@/utils/cn"
import { usePersonaResearchStore } from "../context"
import type { QuoteRef, SynthesisFile, SynthesisTheme, ThemeStance } from "../types"
import PersonaAvatar from "./PersonaAvatar"
import { CARD_SURFACE } from "./surface"
import { ConfidenceBadge, QuoteItem, SourceChip } from "./ResearchBadges"

export type OpenQuote = (quote: Pick<QuoteRef, "persona_id" | "round_index" | "file">) => void

/** Stance colours: support/oppose read at a glance; "not mentioned" stays quiet. */
const STANCE_STYLE: Record<ThemeStance, string> = {
	support: "bg-emerald-500/70",
	oppose: "bg-rose-500/70",
	mixed: "bg-amber-400/70",
	not_mentioned: "bg-muted",
}

interface ColumnGroup {
	id: string
	name: string
	personaIds: string[]
}

/**
 * Theme × persona matrix (a digital affinity map). Columns are grouped by segment; personas
 * that appear in stances but in no segment fall into an "other" group so nothing is hidden.
 */
function ThemeMatrix({
	synthesis,
	onOpenQuote,
	onOpenSources,
}: {
	synthesis: SynthesisFile
	onOpenQuote: OpenQuote
	onOpenSources?: () => void
}) {
	const { t } = useTranslation("personaResearch")
	const store = usePersonaResearchStore()

	const groups = useMemo<ColumnGroup[]>(() => {
		const seen = new Set<string>()
		const result: ColumnGroup[] = synthesis.segments.map((segment) => {
			segment.persona_ids.forEach((id) => seen.add(id))
			return { id: segment.id, name: segment.name, personaIds: segment.persona_ids }
		})
		const others = [
			...new Set(synthesis.themes.flatMap((theme) => Object.keys(theme.stance_by_persona))),
		].filter((id) => !seen.has(id))
		if (others.length)
			result.push({ id: "__other", name: t("analysis.otherSegment"), personaIds: others })
		return result
	}, [synthesis, t])

	const stanceLabel: Record<ThemeStance, string> = {
		support: t("stance.support"),
		oppose: t("stance.oppose"),
		mixed: t("stance.mixed"),
		not_mentioned: t("stance.notMentioned"),
	}
	const nameOf = (id: string) => store.personaById(id)?.name ?? id

	return (
		<div className="flex flex-col gap-2">
			<div className={cn(CARD_SURFACE, "overflow-x-auto")}>
				<table className="w-full border-collapse text-xs">
					<thead>
						<tr>
							<th className="sticky left-0 z-10 bg-card" />
							{groups.map((group) => (
								<th
									key={group.id}
									colSpan={group.personaIds.length}
									className="border-b border-l border-border bg-muted/40 px-2 py-1.5 text-center font-medium text-muted-foreground"
								>
									{group.name}
								</th>
							))}
							<th className="border-b border-l border-border bg-muted/40 px-2 py-1.5 font-medium text-muted-foreground">
								{t("analysis.confidence")}
							</th>
						</tr>
						<tr>
							<th className="sticky left-0 z-10 min-w-40 border-b border-border bg-card px-3 py-2 text-left font-medium text-muted-foreground">
								{t("analysis.theme")}
							</th>
							{groups.flatMap((group) =>
								group.personaIds.map((id, index) => (
									<th
										key={`${group.id}-${id}`}
										className={cn(
											"border-b border-border px-1 py-2",
											index === 0 && "border-l",
										)}
										title={nameOf(id)}
									>
										<span className="flex justify-center">
											<PersonaAvatar
												id={id}
												name={nameOf(id)}
												className="size-6 text-[10px]"
											/>
										</span>
									</th>
								)),
							)}
							<th className="border-b border-l border-border" />
						</tr>
					</thead>
					<tbody>
						{synthesis.themes.map((theme) => (
							<tr key={theme.id} className="group">
								<th className="sticky left-0 z-10 border-b border-border bg-card px-3 py-2 text-left font-normal group-hover:bg-accent/40">
									<ThemePopover
										theme={theme}
										onOpenQuote={onOpenQuote}
										onOpenSources={onOpenSources}
									>
										<button
											type="button"
											className="line-clamp-2 rounded text-left text-foreground underline-offset-2 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
										>
											{theme.name}
										</button>
									</ThemePopover>
								</th>
								{groups.flatMap((group) =>
									group.personaIds.map((personaId, index) => {
										const stance =
											theme.stance_by_persona[personaId] ?? "not_mentioned"
										const quotes = (theme.quote_refs ?? []).filter(
											(ref) => ref.persona_id === personaId,
										)
										return (
											<td
												key={`${theme.id}-${personaId}`}
												className={cn(
													"border-b border-border p-1 text-center group-hover:bg-accent/40",
													index === 0 && "border-l",
												)}
											>
												<CellPopover
													title={`${nameOf(personaId)} · ${theme.name}`}
													quotes={quotes}
													onOpenQuote={onOpenQuote}
												>
													<button
														type="button"
														aria-label={`${nameOf(personaId)} · ${stanceLabel[stance]}`}
														disabled={quotes.length === 0}
														className={cn(
															"mx-auto block size-6 rounded-md outline-none transition-transform focus-visible:ring-2 focus-visible:ring-ring",
															STANCE_STYLE[stance],
															quotes.length > 0 &&
																"cursor-pointer hover:scale-110 motion-reduce:transform-none",
														)}
													/>
												</CellPopover>
											</td>
										)
									}),
								)}
								<td className="border-b border-l border-border px-2 py-1.5 group-hover:bg-accent/40">
									<ConfidenceBadge confidence={theme.confidence} />
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
			<div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
				{(Object.keys(STANCE_STYLE) as ThemeStance[]).map((stance) => (
					<span key={stance} className="inline-flex items-center gap-1">
						<span className={cn("size-3 rounded", STANCE_STYLE[stance])} />
						{stanceLabel[stance]}
					</span>
				))}
				<span className="ml-auto">{t("analysis.matrixHint")}</span>
			</div>
		</div>
	)
}

/** Quotes behind one matrix cell. */
const CellPopover = observer(function CellPopover({
	title,
	quotes,
	onOpenQuote,
	children,
}: {
	title: string
	quotes: QuoteRef[]
	onOpenQuote: OpenQuote
	children: ReactNode
}) {
	const store = usePersonaResearchStore()
	if (quotes.length === 0) return <>{children}</>
	return (
		<Popover>
			<PopoverTrigger asChild>{children}</PopoverTrigger>
			<PopoverContent className="flex w-80 flex-col gap-2 p-3" align="start">
				<p className="text-xs font-medium">{title}</p>
				{quotes.map((quote, index) => (
					<QuoteItem
						key={index}
						quote={quote}
						personaName={store.personaById(quote.persona_id)?.name ?? quote.persona_id}
						onOpen={() => onOpenQuote(quote)}
					/>
				))}
			</PopoverContent>
		</Popover>
	)
})

/** Everything behind a theme: description, rule-based confidence, all quotes and sources. */
export const ThemePopover = observer(function ThemePopover({
	theme,
	onOpenQuote,
	onOpenSources,
	children,
}: {
	theme: SynthesisTheme
	onOpenQuote: OpenQuote
	onOpenSources?: () => void
	children: ReactNode
}) {
	const { t } = useTranslation("personaResearch")
	const store = usePersonaResearchStore()
	return (
		<Popover>
			<PopoverTrigger asChild>{children}</PopoverTrigger>
			<PopoverContent
				className="flex max-h-[420px] w-96 flex-col gap-2.5 overflow-y-auto p-3"
				align="start"
			>
				<div className="flex items-start justify-between gap-2">
					<p className="text-sm font-medium">{theme.name}</p>
					<ConfidenceBadge confidence={theme.confidence} />
				</div>
				{theme.description ? (
					<p className="text-xs leading-5 text-muted-foreground">{theme.description}</p>
				) : null}
				{theme.confidence_reason ? (
					<p className="rounded-md bg-muted/60 p-2 text-xs leading-5">
						{theme.confidence_reason}
					</p>
				) : null}
				{theme.hypothesis_ids?.length ? (
					<p className="text-[11px] text-muted-foreground">
						{t("analysis.relatedHypotheses", { ids: theme.hypothesis_ids.join("、") })}
					</p>
				) : null}
				{(theme.quote_refs ?? []).map((quote, index) => (
					<QuoteItem
						key={index}
						quote={quote}
						personaName={store.personaById(quote.persona_id)?.name ?? quote.persona_id}
						onOpen={() => onOpenQuote(quote)}
					/>
				))}
				{theme.source_refs?.length ? (
					<div className="flex flex-wrap gap-1.5">
						{theme.source_refs.map((ref) => (
							<SourceChip key={ref} sourceRef={ref} onOpen={onOpenSources} />
						))}
					</div>
				) : null}
			</PopoverContent>
		</Popover>
	)
})

export default observer(ThemeMatrix)

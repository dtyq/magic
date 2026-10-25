import { useMemo } from "react"
import { UsersRound } from "lucide-react"
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
import { Skeleton } from "@/components/shadcn-ui/skeleton"
import { cn } from "@/utils/cn"
import { usePersonaResearchStore } from "../context"
import { hypothesisStanceGroups, type VoiceStance } from "../services/hypothesisVoices"
import type { PersonaFile } from "../types"
import PersonaCard from "./PersonaCard"

/**
 * Personas of the current study with a distribution strip on top: planned quota vs actual
 * per segment and evidence tiers, so a skewed or over-generated panel is visible at once.
 */
function PersonaPanel({
	variant,
	onOpenPersona,
}: {
	variant: "desktop" | "mobile"
	onOpenPersona: (persona: PersonaFile) => void
}) {
	const { t } = useTranslation("personaResearch")
	const store = usePersonaResearchStore()
	const personas = store.studyPersonas
	const isMobile = variant === "mobile"
	const interviewByPersona = useMemo(
		() => new Map(store.interviews.map((ref) => [ref.data.persona_id, ref.data])),
		[store.interviews],
	)
	const quota = store.study?.quota ?? []
	// Per-persona stance on each hypothesis, only where synthesis themes link to hypotheses.
	const stancesByPersona = useMemo(() => {
		const map = new Map<string, { id: string; stance: VoiceStance }[]>()
		const themes = store.synthesis?.themes ?? []
		const panelIds = personas.map((persona) => persona.id)
		for (const hypothesis of store.study?.hypotheses ?? []) {
			const groups = hypothesisStanceGroups(hypothesis, themes, panelIds)
			if (!groups) continue
			for (const group of groups) {
				for (const personaId of group.personaIds) {
					const list = map.get(personaId) ?? []
					list.push({ id: hypothesis.id, stance: group.stance })
					map.set(personaId, list)
				}
			}
		}
		return map
	}, [store.synthesis, store.study, personas])
	const interviewRunning =
		store.study?.phases.some(
			(phase) => phase.key === "interview" && phase.status === "running",
		) ?? false

	const segmentCounts = useMemo(() => {
		const counts = new Map<string, number>()
		for (const item of store.studyPanel?.selection ?? []) {
			if (item.segment) counts.set(item.segment, (counts.get(item.segment) ?? 0) + 1)
		}
		return counts
	}, [store.studyPanel])
	// Manual personas come from the user, not from sources, so they are counted on their own.
	const evidenceBased = personas.filter(
		(persona) => persona.tier === "evidence_based" || persona.tier === "imported",
	).length
	const manualCount = personas.filter((persona) => persona.tier === "manual").length

	if (personas.length === 0) {
		if (interviewRunning) return <CardSkeletonGrid isMobile={isMobile} />
		return (
			<Empty className="h-full border-0 py-12">
				<EmptyHeader>
					<EmptyMedia variant="icon">
						<UsersRound />
					</EmptyMedia>
					<EmptyTitle className="text-sm">{t("console.personasEmptyTitle")}</EmptyTitle>
					<EmptyDescription className="text-xs">
						{t("console.personasEmpty")}
					</EmptyDescription>
				</EmptyHeader>
			</Empty>
		)
	}

	return (
		<ScrollArea className="h-full" viewportClassName="[&>div]:!block">
			<div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-b border-border px-5 py-2.5 text-xs text-muted-foreground">
				{quota.map((row) => {
					const actual = segmentCounts.get(row.segment) ?? 0
					return (
						<span
							key={row.segment}
							className={cn(
								actual < row.count && "text-amber-600 dark:text-amber-400",
							)}
						>
							{row.segment}{" "}
							<span className="tabular-nums">
								{actual}/{row.count}
							</span>
						</span>
					)
				})}
				<span className="ml-auto">
					{t("persona.distribution", { sourced: evidenceBased, total: personas.length })}
					{manualCount > 0
						? ` · ${t("persona.distributionManual", { count: manualCount })}`
						: null}
				</span>
			</div>
			<div
				className={cn(
					"grid gap-3.5",
					isMobile
						? "grid-cols-1 p-4"
						: "grid-cols-[repeat(auto-fill,minmax(250px,1fr))] p-5",
				)}
			>
				{personas.map((persona) => {
					const interview = interviewByPersona.get(persona.id)
					return (
						<PersonaCard
							key={persona.id}
							persona={persona}
							interviewStatus={interview?.status}
							quote={interview?.quotes?.[0]?.text}
							reason={store.selectionReasonOf(persona.id)}
							stances={stancesByPersona.get(persona.id)}
							onOpen={() => onOpenPersona(persona)}
						/>
					)
				})}
			</div>
		</ScrollArea>
	)
}

/** Placeholder cards while personas are being built, so the layout does not jump. */
function CardSkeletonGrid({ isMobile }: { isMobile: boolean }) {
	return (
		<div
			className={cn(
				"grid gap-3 p-4",
				isMobile ? "grid-cols-1" : "grid-cols-[repeat(auto-fill,minmax(250px,1fr))]",
			)}
			aria-busy
		>
			{Array.from({ length: isMobile ? 3 : 6 }, (_, index) => (
				<div
					key={index}
					className="flex flex-col gap-3 rounded-xl border border-border p-3.5"
				>
					<div className="flex items-center gap-2.5">
						<Skeleton className="size-10 rounded-full" />
						<div className="flex flex-1 flex-col gap-1.5">
							<Skeleton className="h-3.5 w-1/2" />
							<Skeleton className="h-3 w-3/4" />
						</div>
					</div>
					<Skeleton className="h-3 w-2/3" />
				</div>
			))}
		</div>
	)
}

export default observer(PersonaPanel)

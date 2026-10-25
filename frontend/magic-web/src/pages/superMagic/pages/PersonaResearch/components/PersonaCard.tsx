import type { ReactNode } from "react"
import { CircleAlert, CircleCheck, Loader2, Target } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Checkbox } from "@/components/shadcn-ui/checkbox"
import MagicTooltip from "@/components/base/MagicTooltip"
import { cn } from "@/utils/cn"
import type { VoiceStance } from "../services/hypothesisVoices"
import type { InterviewFile, PersonaFile } from "../types"
import HangingQuote from "./HangingQuote"
import PersonaAvatar from "./PersonaAvatar"
import { personaTone } from "./personaPortrait"

interface PersonaCardProps {
	persona: PersonaFile
	interviewStatus?: InterviewFile["status"]
	/** First quote from this persona's interview, shown as a teaser once available. */
	quote?: string
	/** Why the current study picked this persona (study panel selection). */
	reason?: string
	selectable?: boolean
	selected?: boolean
	onSelectedChange?: (selected: boolean) => void
	/** Actions menu shown on hover next to the checkbox (persona library: edit, delete). */
	actions?: ReactNode
	/** Just created in this page session: green ring and a "new" label for a few seconds. */
	isNew?: boolean
	/** Stance on each hypothesis of the current study, when the synthesis links themes to them. */
	stances?: { id: string; stance: VoiceStance }[]
	onOpen: () => void
}

/** Persona summary card used by the study panel and the persona library. */
export default function PersonaCard({
	persona,
	interviewStatus,
	quote,
	reason,
	selectable = false,
	selected = false,
	onSelectedChange,
	actions,
	isNew = false,
	stances,
	onOpen,
}: PersonaCardProps) {
	const { t } = useTranslation("personaResearch")
	const tierLabel = {
		generated: t("persona.tier.generated"),
		evidence_based: t("persona.tier.evidenceBased"),
		imported: t("persona.tier.imported"),
		manual: t("persona.tier.manual"),
	}[persona.tier]

	const { tint } = personaTone(persona.name || persona.id)

	return (
		<div
			className={cn(
				"group relative flex h-full flex-col overflow-hidden rounded-2xl bg-card text-left ring-1 ring-border",
				"transition-all duration-200 [transition-timing-function:cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-0.5 hover:shadow-[0_14px_30px_-18px_rgb(0_0_0/0.35)] active:scale-[0.99] motion-reduce:transform-none motion-reduce:transition-none",
				selected && "ring-2 ring-foreground",
				isNew && !selected && "ring-2 ring-emerald-500/60",
			)}
			data-testid="persona-research-persona-card"
		>
			{selectable || actions ? (
				<span className="absolute right-3 top-3 z-10 flex items-center gap-1">
					{actions}
					{selectable ? (
						<Checkbox
							// A white fill only while unchecked: on a checked box it would hide the
							// white tick against the primary background.
							className={cn(!selected && "bg-background")}
							checked={selected}
							onCheckedChange={(value) => onSelectedChange?.(value === true)}
							aria-label={t("persona.select", { name: persona.name })}
						/>
					) : null}
				</span>
			) : null}
			{/* The whole body opens details; the checkbox above stays a separate control. */}
			<button
				type="button"
				className="flex flex-1 flex-col text-left outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
				onClick={onOpen}
			>
				{/* Persona-coloured header: the same tone as their quotes and transcript highlights. */}
				<span
					className="flex items-center gap-3.5 px-4 pb-3.5 pt-4"
					style={{ backgroundColor: tint }}
				>
					<PersonaAvatar
						id={persona.id}
						name={persona.name}
						shape="square"
						className="size-14"
					/>
					<span
						className={cn(
							"flex min-w-0 flex-1 flex-col gap-0.5",
							actions ? "pr-12" : "pr-6",
						)}
					>
						<span className="flex min-w-0 items-center gap-1.5">
							<span className="truncate text-base font-bold text-foreground">
								{persona.name}
							</span>
							{isNew ? (
								<span className="shrink-0 rounded bg-emerald-500/10 px-1 text-[10px] font-medium text-emerald-700 dark:text-emerald-400">
									{t("library.new")}
								</span>
							) : null}
						</span>
						{persona.tagline ? (
							<span className="line-clamp-3 text-[13px] leading-5 text-muted-foreground">
								{persona.tagline}
							</span>
						) : null}
					</span>
				</span>
				<span className="flex flex-1 flex-col gap-3 px-4 pt-3.5">
					{quote ? (
						<HangingQuote
							text={quote}
							clampClassName="line-clamp-3"
							className="text-[14.5px] font-bold leading-relaxed text-foreground"
						/>
					) : null}
					{reason ? (
						<span className="flex gap-1.5 text-xs leading-5 text-muted-foreground">
							<Target className="mt-0.5 size-3 shrink-0" />
							<span className="line-clamp-2">{reason}</span>
						</span>
					) : null}
					{persona.tags?.length ? (
						<span className="flex flex-wrap gap-1">
							{persona.tags.slice(0, 4).map((tag) => (
								<span
									key={tag}
									className="rounded-md bg-muted/60 px-1.5 py-px text-xs text-muted-foreground ring-1 ring-border"
								>
									{tag}
								</span>
							))}
						</span>
					) : null}
				</span>
			</button>
			<div className="mt-3.5 flex items-center gap-2.5 border-t border-border px-4 py-2.5 text-xs text-muted-foreground">
				{stances?.length ? (
					<MagicTooltip title={t("persona.stanceHint")}>
						<span className="flex items-center gap-1">
							{stances.map(({ id, stance }) => (
								<span
									key={id}
									className={cn(
										"flex h-4 min-w-4 items-center justify-center rounded px-0.5 font-mono text-[9px] text-white",
										STANCE_CELL[stance],
									)}
								>
									{id.replace(/^H/i, "")}
								</span>
							))}
						</span>
					</MagicTooltip>
				) : (
					<span className="truncate">
						{tierLabel} · {t("persona.aiSimulated")}
					</span>
				)}
				{interviewStatus ? (
					<span className="ml-auto shrink-0">
						<InterviewStatusChip status={interviewStatus} />
					</span>
				) : null}
			</div>
		</div>
	)
}

/** One cell per hypothesis in the card footer; semantic colours match the hypothesis board. */
const STANCE_CELL: Record<VoiceStance, string> = {
	support: "bg-emerald-600",
	partial: "bg-amber-500",
	oppose: "bg-rose-500",
	none: "bg-muted-foreground/35",
}

/** Interview progress chip shared by persona cards and the interview list. */
export function InterviewStatusChip({ status }: { status: InterviewFile["status"] }) {
	const { t } = useTranslation("personaResearch")
	if (status === "done") {
		return (
			<span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
				<CircleCheck className="size-3.5" />
				{t("persona.interviewDone")}
			</span>
		)
	}
	if (status === "failed") {
		return (
			<span className="inline-flex items-center gap-1 text-destructive">
				<CircleAlert className="size-3.5" />
				{t("persona.interviewFailed")}
			</span>
		)
	}
	return (
		<span className="inline-flex items-center gap-1 text-primary">
			<Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" />
			{t("persona.interviewRunning")}
		</span>
	)
}

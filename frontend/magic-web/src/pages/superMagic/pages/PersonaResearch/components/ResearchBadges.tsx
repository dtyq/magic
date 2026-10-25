import { CircleCheck, CircleDashed, CircleHelp, CircleMinus, CircleX, Link2 } from "lucide-react"
import { useTranslation } from "react-i18next"
import { cn } from "@/utils/cn"
import type { AgreementLevel, HypothesisVerdict, QuoteRef, ThemeConfidence } from "../types"
import PersonaAvatar from "./PersonaAvatar"

const pill =
	"inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"

/** Hypothesis verdict; "mixed" doubles as "partially supported, pending real-person validation". */
export function VerdictBadge({
	verdict,
	className,
}: {
	verdict: HypothesisVerdict
	className?: string
}) {
	const { t } = useTranslation("personaResearch")
	const config = {
		supported: {
			label: t("verdict.supported"),
			icon: CircleCheck,
			tone: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
		},
		refuted: {
			label: t("verdict.refuted"),
			icon: CircleX,
			tone: "bg-destructive/10 text-destructive",
		},
		mixed: {
			label: t("verdict.mixed"),
			icon: CircleMinus,
			tone: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
		},
		insufficient: {
			label: t("verdict.insufficient"),
			icon: CircleHelp,
			tone: "bg-muted text-muted-foreground",
		},
		pending: {
			label: t("verdict.pending"),
			icon: CircleDashed,
			tone: "bg-muted text-muted-foreground",
		},
	}[verdict]
	const Icon = config.icon
	return (
		<span className={cn(pill, config.tone, className)}>
			<Icon className="size-3.5" />
			{config.label}
		</span>
	)
}

/** Real-person vs AI agreement. */
export function AgreementBadge({
	agreement,
	className,
}: {
	agreement: AgreementLevel
	className?: string
}) {
	const { t } = useTranslation("personaResearch")
	const config = {
		agree: {
			label: t("agreement.agree"),
			tone: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
		},
		partial: {
			label: t("agreement.partial"),
			tone: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
		},
		disagree: { label: t("agreement.disagree"), tone: "bg-destructive/10 text-destructive" },
	}[agreement]
	return <span className={cn(pill, config.tone, className)}>{config.label}</span>
}

/** Rule-based theme confidence; "to_validate" is the ceiling for AI-only evidence. */
export function ConfidenceBadge({
	confidence,
	className,
}: {
	confidence: ThemeConfidence
	className?: string
}) {
	const { t } = useTranslation("personaResearch")
	const config = {
		high: {
			label: t("confidence.high"),
			tone: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
		},
		medium: {
			label: t("confidence.medium"),
			tone: "bg-sky-500/15 text-sky-700 dark:text-sky-400",
		},
		low: { label: t("confidence.low"), tone: "bg-muted text-muted-foreground" },
		to_validate: {
			label: t("confidence.toValidate"),
			tone: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
		},
	}[confidence]
	return <span className={cn(pill, config.tone, className)}>{config.label}</span>
}

/** One quote with its speaker; clicking opens the transcript at that round. */
export function QuoteItem({
	quote,
	personaName,
	onOpen,
}: {
	quote: Pick<QuoteRef, "persona_id" | "text" | "round_index">
	personaName: string
	onOpen?: () => void
}) {
	const { t } = useTranslation("personaResearch")
	return (
		<button
			type="button"
			disabled={!onOpen}
			onClick={onOpen}
			className={cn(
				"flex w-full items-start gap-2 rounded-lg border border-border p-2.5 text-left outline-none transition-colors",
				onOpen &&
					"hover:border-primary/40 hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-ring",
			)}
		>
			<PersonaAvatar
				id={quote.persona_id}
				name={personaName}
				className="size-6 text-[10px]"
			/>
			<span className="flex min-w-0 flex-1 flex-col gap-0.5">
				<span className="text-[11px] text-muted-foreground">
					{personaName}
					{quote.round_index !== undefined
						? ` · ${t("evidence.round", { index: quote.round_index + 1 })}`
						: ""}
				</span>
				<span className="text-xs leading-5 text-foreground">“{quote.text}”</span>
			</span>
		</button>
	)
}

/** Desk-research source chip such as "S3"; opens desk-research.md where sources are listed. */
export function SourceChip({ sourceRef, onOpen }: { sourceRef: string; onOpen?: () => void }) {
	return (
		<button
			type="button"
			disabled={!onOpen}
			onClick={onOpen}
			className={cn(
				"inline-flex items-center gap-1 rounded-md border border-border px-1.5 py-0.5 text-[11px] text-muted-foreground outline-none",
				onOpen &&
					"hover:border-primary/40 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
			)}
		>
			<Link2 className="size-3" />
			{sourceRef}
		</button>
	)
}

/** Fixed label so screenshots of personas and transcripts keep their AI-simulation context. */
export function AiSimulatedNote({ className }: { className?: string }) {
	const { t } = useTranslation("personaResearch")
	return (
		<p className={cn("text-[11px] leading-4 text-muted-foreground", className)}>
			{t("study.aiDisclaimer")}
		</p>
	)
}

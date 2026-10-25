import { createContext, useContext, useRef, type ReactNode } from "react"
import {
	Brain,
	ExternalLink,
	FileText,
	FingerprintPattern,
	Globe,
	Layers,
	MessageCircleQuestion,
	MessagesSquare,
	Pencil,
	Quote,
	ShieldAlert,
	Smartphone,
	Split,
	Trash2,
	X,
} from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/shadcn-ui/button"
import MagicTooltip from "@/components/base/MagicTooltip"
import dayjs from "@/infrastructure/vendors/dayjs"
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogTitle,
} from "@/components/shadcn-ui/dialog"
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/shadcn-ui/sheet"
import { cn } from "@/utils/cn"
import type {
	InterviewFile,
	PersonaDimensionKey,
	PersonaEvidence,
	PersonaFieldSource,
	PersonaFile,
} from "../types"
import { normalizeDecisionWeights } from "../services/researchAnalysis"
import { formatResearchValue } from "./formatValue"
import { AiSimulatedNote } from "./ResearchBadges"
import HangingQuote from "./HangingQuote"
import PersonaAvatar from "./PersonaAvatar"
import { personaTone } from "./personaPortrait"

interface PersonaDetailSheetProps {
	persona: PersonaFile | null
	interview?: InterviewFile | null
	onOpenChange: (open: boolean) => void
	/** Prefills the composer with a follow-up question for this persona. */
	onAskPersona?: (persona: PersonaFile) => void
	onOpenInterview?: (personaId: string) => void
	/** Persona library only: open the edit form / ask to delete this persona. */
	onEdit?: (persona: PersonaFile) => void
	onDelete?: (persona: PersonaFile) => void
	/** A centred dialog on desktop, so the page behind keeps its place; a bottom sheet on phones. */
	side?: "center" | "bottom"
}

/** The opened persona's own names for keys the agent made up (persona.field_labels). */
const FieldLabelsContext = createContext<Record<string, string> | undefined>(undefined)

/** Seven dimensions, four evidence layers and sources of one persona. */
export default function PersonaDetailSheet({
	persona,
	interview,
	onOpenChange,
	onAskPersona,
	onOpenInterview,
	onEdit,
	onDelete,
	side = "center",
}: PersonaDetailSheetProps) {
	const { t } = useTranslation("personaResearch")
	const dimensions = persona?.dimensions
	const layers = persona?.layers
	const isManual = persona?.tier === "manual"
	// Every field of a manual persona is the user's, so per-field marks would only repeat the tier.
	const fieldSourceOf = (key: PersonaDimensionKey) =>
		isManual ? undefined : persona?.field_sources?.[key]
	const tierCopy = persona
		? {
				generated: {
					label: t("persona.tier.generated"),
					hint: t("persona.tierHint.generated"),
				},
				evidence_based: {
					label: t("persona.tier.evidenceBased"),
					hint: t("persona.tierHint.evidenceBased"),
				},
				imported: {
					label: t("persona.tier.imported"),
					hint: t("persona.tierHint.imported"),
				},
				manual: {
					label: t("persona.tier.manual"),
					hint: t("persona.tierHint.manual"),
				},
			}[persona.tier]
		: null
	const answeredRounds = interview?.rounds.filter((round) => round.role === "persona").length ?? 0
	const leadQuote = interview?.quotes?.[0]?.text
	const isDialog = side === "center"
	const Title = isDialog ? DialogTitle : SheetTitle
	const Description = isDialog ? DialogDescription : SheetDescription
	// Closing returns focus to the persona card, except after "ask" or "view interview":
	// those move the user on (to the composer or the interview), so focus must not jump back.
	const leavingRef = useRef(false)
	const leaveWith = (action: () => void) => {
		leavingRef.current = true
		action()
	}
	const onCloseAutoFocus = (event: Event) => {
		if (!leavingRef.current) return
		event.preventDefault()
		leavingRef.current = false
	}

	const content =
		persona && tierCopy ? (
			<>
				{/* Persona-coloured header, matching their card, quotes and transcript highlights. */}
				<div
					className="flex shrink-0 flex-col gap-3 border-b border-border p-5 text-left"
					style={{
						backgroundColor: personaTone(persona.name || persona.id).tint,
					}}
				>
					<div className="flex items-center gap-3.5">
						<PersonaAvatar
							id={persona.id}
							name={persona.name}
							shape="square"
							className="size-16"
						/>
						<div className="min-w-0 flex-1">
							<Title className="truncate text-xl font-black leading-tight tracking-tight">
								{persona.name}
							</Title>
							<Description className="line-clamp-2">{persona.tagline}</Description>
						</div>
						{/* One button row: edit, delete, then close after a divider, all 32px high on the
						    same centre line. The bottom sheet's own corner close is switched off: it sat
						    about 8px higher than this row, so the three buttons did not line up. */}
						<div className="flex shrink-0 items-center gap-1 self-start">
							{onEdit ? (
								<Button
									variant="ghost"
									size="sm"
									className="h-8 gap-1.5 px-2.5 text-xs"
									onClick={() => onEdit(persona)}
								>
									<Pencil className="size-3.5" />
									{t("persona.edit")}
								</Button>
							) : null}
							{onDelete ? (
								<MagicTooltip title={t("persona.delete")}>
									<Button
										variant="ghost"
										size="icon"
										className="size-8 text-muted-foreground hover:text-destructive"
										aria-label={t("persona.delete")}
										onClick={() => onDelete(persona)}
									>
										<Trash2 className="size-4" />
									</Button>
								</MagicTooltip>
							) : null}
							{onEdit || onDelete ? (
								<span className="mx-1 h-4 w-px bg-border" aria-hidden />
							) : null}
							<Button
								variant="ghost"
								size="icon"
								className="size-8 text-muted-foreground"
								aria-label={t("common.close")}
								onClick={() => onOpenChange(false)}
							>
								<X className="size-4" />
							</Button>
						</div>
					</div>
					{leadQuote ? (
						<HangingQuote
							text={leadQuote}
							className="text-[15px] font-bold leading-relaxed text-foreground"
						/>
					) : null}
					<div className="flex flex-wrap gap-1">
						{(persona.tags ?? []).map((tag) => (
							<span
								key={tag}
								className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground"
							>
								{tag}
							</span>
						))}
					</div>
					<div className="grid grid-cols-3 gap-2 text-center">
						<Stat label={t("persona.stat.tier")} value={tierCopy.label} />
						<Stat
							label={t("persona.stat.sources")}
							value={isManual ? "—" : String(persona.evidence?.length ?? 0)}
						/>
						<Stat
							label={t("persona.stat.rounds")}
							value={interview ? String(answeredRounds) : "—"}
						/>
					</div>
					<p className="text-xs leading-5 text-muted-foreground">{tierCopy.hint}</p>
					{persona.edited_at && !isManual ? (
						<p className="rounded-lg bg-muted/60 px-2.5 py-1.5 text-xs leading-5 text-muted-foreground">
							{t("persona.editedNotice", {
								date: dayjs(persona.edited_at).format("MM-DD"),
							})}
						</p>
					) : null}
					<AiSimulatedNote />
				</div>
				{/* A plain scrolling box between the fixed header and footer: the Radix scroll area
				    did not take its flex height here, so long content ran on under the footer. */}
				<FieldLabelsContext.Provider value={persona.field_labels}>
					<div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
						<div className="flex flex-col gap-6 p-5 text-sm">
							{interview?.quotes?.[0] ? (
								<blockquote className="flex gap-2 rounded-xl bg-primary/5 p-3 text-sm leading-6">
									<Quote className="mt-1 size-4 shrink-0 text-primary" />
									<span>{interview.quotes[0].text}</span>
								</blockquote>
							) : null}
							<Section
								icon={<FingerprintPattern className="size-4" />}
								title={t("persona.section.dimensions")}
							>
								<Field
									label={t("persona.dimension.demographics")}
									value={dimensions?.demographics}
									source={fieldSourceOf("demographics")}
								/>
								<Field
									label={t("persona.dimension.geography")}
									value={dimensions?.geography}
									source={fieldSourceOf("geography")}
								/>
								<Field
									label={t("persona.dimension.psychographics")}
									value={dimensions?.psychographics}
									source={fieldSourceOf("psychographics")}
								/>
								<Field
									label={t("persona.dimension.behavior")}
									value={dimensions?.behavior}
									source={fieldSourceOf("behavior")}
								/>
								<Field
									label={t("persona.dimension.needsPains")}
									value={dimensions?.needs_pains}
									source={fieldSourceOf("needs_pains")}
								/>
								<Field
									label={t("persona.dimension.techAdoption")}
									value={dimensions?.tech_adoption}
									source={fieldSourceOf("tech_adoption")}
								/>
								<Field
									label={t("persona.dimension.social")}
									value={dimensions?.social}
									source={fieldSourceOf("social")}
								/>
							</Section>
							<Section
								icon={<Layers className="size-4" />}
								title={t("persona.section.layers")}
							>
								<Field
									label={t("persona.layer.expression")}
									value={layers?.expression}
								/>
								<Field label={t("persona.layer.story")} value={layers?.story} />
								<DecisionWeights value={layers?.cognition?.decision_weights} />
								<Field
									label={t("persona.layer.behavior")}
									value={layers?.behavior}
								/>
							</Section>
							{persona.consistency_notes?.length ? (
								<Section
									icon={<Split className="size-4" />}
									title={t("persona.section.contradictions")}
								>
									<ul className="flex flex-col gap-1.5">
										{persona.consistency_notes.map((note, index) => (
											<li
												key={index}
												className="rounded-lg bg-muted/60 px-2.5 py-1.5 text-xs leading-5"
											>
												{note}
											</li>
										))}
									</ul>
									<p className="text-[11px] text-muted-foreground">
										{t("persona.contradictionsHint")}
									</p>
								</Section>
							) : null}
							{isManual && !persona.evidence?.length ? null : (
								<Section
									icon={<Brain className="size-4" />}
									title={t("persona.section.evidence")}
								>
									{persona.evidence?.length ? (
										<ul className="flex flex-col gap-2">
											{persona.evidence.map((item) => (
												<EvidenceItem key={item.id} item={item} />
											))}
										</ul>
									) : (
										<p className="flex items-start gap-2 rounded-lg bg-amber-500/10 p-3 text-xs leading-5 text-amber-700 dark:text-amber-400">
											<ShieldAlert className="mt-0.5 size-4 shrink-0" />
											{t("persona.noEvidence")}
										</p>
									)}
								</Section>
							)}
						</div>
					</div>
				</FieldLabelsContext.Provider>
				{onAskPersona || (interview && onOpenInterview) ? (
					// A lone "view interview" sits at the right instead of stretching across.
					<div
						className={cn(
							"flex shrink-0 gap-2 border-t border-border bg-background p-4",
							!onAskPersona && "justify-end",
						)}
					>
						{onAskPersona ? (
							<Button
								className="flex-1"
								onClick={() => leaveWith(() => onAskPersona(persona))}
							>
								<MessageCircleQuestion className="size-4" />
								{t("persona.ask")}
							</Button>
						) : null}
						{interview && onOpenInterview ? (
							<Button
								variant="outline"
								className={onAskPersona ? "flex-1" : undefined}
								onClick={() => leaveWith(() => onOpenInterview(persona.id))}
							>
								<MessagesSquare className="size-4" />
								{t("persona.viewInterview")}
							</Button>
						) : null}
					</div>
				) : null}
			</>
		) : null

	if (isDialog) {
		return (
			<Dialog open={Boolean(persona)} onOpenChange={onOpenChange}>
				<DialogContent
					className="flex max-h-[85vh] w-[calc(100vw-2rem)] max-w-[760px] flex-col gap-0 overflow-hidden p-0 sm:max-w-[760px]"
					onCloseAutoFocus={onCloseAutoFocus}
					// The close button sits in the header's button row instead.
					showCloseButton={false}
				>
					{content}
				</DialogContent>
			</Dialog>
		)
	}
	return (
		<Sheet open={Boolean(persona)} onOpenChange={onOpenChange}>
			<SheetContent
				side="bottom"
				showClose={false}
				className="flex max-h-[88vh] flex-col gap-0 rounded-t-2xl p-0 pb-[env(safe-area-inset-bottom)]"
				onCloseAutoFocus={onCloseAutoFocus}
			>
				{content}
			</SheetContent>
		</Sheet>
	)
}

function Stat({ label, value }: { label: string; value: string }) {
	return (
		<div className="rounded-lg bg-muted/60 px-2 py-1.5">
			<div className="truncate text-sm font-semibold text-foreground">{value}</div>
			<div className="text-[11px] text-muted-foreground">{label}</div>
		</div>
	)
}

function Section({
	icon,
	title,
	children,
}: {
	icon: ReactNode
	title: string
	children: ReactNode
}) {
	return (
		<section className="flex flex-col gap-2.5">
			<h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
				{icon}
				{title}
			</h3>
			<div className="flex flex-col gap-2">{children}</div>
		</section>
	)
}

function Field({
	label,
	value,
	source,
}: {
	label: string
	value: unknown
	/** Evidence ids, "inferred" or "user"; absent on older persona files and manual personas. */
	source?: PersonaFieldSource
}) {
	const { t, i18n } = useTranslation("personaResearch")
	const fieldLabels = useContext(FieldLabelsContext)
	// A key's name: the persona's own label for made-up keys, then the built-in names for
	// contract keys and values (age, city_tier, male); null when neither knows it.
	const nameOf = (text: string): string | null =>
		fieldLabels?.[text]?.trim() ||
		(i18n.exists(`personaResearch:persona.field.${text}`) ? t(`persona.field.${text}`) : null)
	const labelOf = (text: string) => nameOf(text) ?? text.replaceAll("_", " ")
	const format = (item: unknown) =>
		formatResearchValue(item, {
			labelOf,
			keySeparator: i18n.language.toLowerCase().startsWith("zh") ? "：" : ": ",
		})
	// Objects become a small key/value grid and lists one item per line; text stays as written.
	const entries =
		value && typeof value === "object" && !Array.isArray(value)
			? Object.entries(value as Record<string, unknown>)
					.map(([key, item]) => ({
						key,
						label: nameOf(key),
						rawLabel: humanizeKey(key),
						text: format(item),
					}))
					.filter((entry) => entry.text)
			: null
	const items = Array.isArray(value) ? value.map(format).filter(Boolean) : null
	const text = entries || items ? "" : format(value)
	if (!entries?.length && !items?.length && !text) return null
	return (
		<div className="grid grid-cols-[88px_minmax(0,1fr)] gap-2">
			<span className="flex flex-col gap-1 text-xs leading-5 text-muted-foreground">
				{label}
				{source ? (
					<span
						className={cn(
							"w-fit rounded px-1 text-[10px] leading-4",
							source === "inferred"
								? "bg-amber-500/15 text-amber-700 dark:text-amber-400"
								: source === "user"
									? "bg-slate-500/15 text-slate-700 dark:text-slate-300"
									: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
						)}
					>
						{source === "inferred"
							? t("persona.fieldInferred")
							: source === "user"
								? t("persona.fieldUser")
								: t("persona.fieldSourced", { ids: source.join("、") })}
					</span>
				) : null}
			</span>
			{entries?.length ? (
				<dl className="grid min-w-0 grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-x-4 gap-y-3">
					{entries.map((entry) => (
						<div
							key={entry.key}
							className={cn(
								"flex min-w-0 flex-col gap-0.5",
								// Sentences get two columns so they are not squeezed into a narrow cell.
								entry.text.length > LONG_VALUE_LENGTH && "sm:col-span-2",
							)}
						>
							{/* Every cell has its title above the value; a key without a name shows as
							    readable words ("Time style") in a lighter tone. */}
							<dt
								className={cn(
									"text-[11px] leading-4",
									entry.label
										? "text-muted-foreground"
										: "text-muted-foreground/60",
								)}
							>
								{entry.label ?? entry.rawLabel}
							</dt>
							<dd className="break-words leading-5 text-foreground">{entry.text}</dd>
						</div>
					))}
				</dl>
			) : items?.length ? (
				<ul className="flex min-w-0 flex-col gap-1.5">
					{items.map((item, index) => (
						<li key={index} className="flex gap-2 leading-5 text-foreground">
							<span className="mt-2 size-1 shrink-0 rounded-full bg-muted-foreground/60" />
							<span className="min-w-0 break-words">{item}</span>
						</li>
					))}
				</ul>
			) : (
				<span className="min-w-0 whitespace-pre-wrap break-words leading-5 text-foreground">
					{text}
				</span>
			)}
		</div>
	)
}

/** Values longer than this span two grid columns. */
const LONG_VALUE_LENGTH = 24

/** "time_style" → "Time style": a readable title for a key that has no display name. */
function humanizeKey(key: string): string {
	const words = key.replace(/[_-]+/g, " ").trim()
	return words.charAt(0).toUpperCase() + words.slice(1)
}

/** Source card: type icon, title, domain for web sources and the quoted snippet. */
function EvidenceItem({ item }: { item: PersonaEvidence }) {
	const { t } = useTranslation("personaResearch")
	const Icon =
		item.type === "web"
			? Globe
			: item.type === "social"
				? Smartphone
				: item.type === "upload"
					? FileText
					: MessagesSquare
	let domain = ""
	if (item.url) {
		try {
			domain = new URL(item.url).hostname.replace(/^www\./, "")
		} catch {
			domain = ""
		}
	}
	return (
		<li className="rounded-lg border border-border p-2.5">
			<div className="flex items-center gap-2 text-xs">
				<Icon className="size-3.5 shrink-0 text-muted-foreground" />
				<span className="min-w-0 flex-1 truncate font-medium text-foreground">
					{item.platform ? `${item.platform} · ` : ""}
					{item.title || item.file || domain || item.url}
				</span>
				{item.url ? (
					<a
						href={item.url}
						target="_blank"
						rel="noreferrer noopener"
						className="flex shrink-0 items-center gap-1 rounded text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
						aria-label={t("persona.openSource")}
					>
						{domain}
						<ExternalLink className="size-3" />
					</a>
				) : null}
			</div>
			{item.quote ? (
				<p className="mt-1.5 border-l-2 border-border pl-2 text-xs leading-5 text-muted-foreground">
					{item.quote}
				</p>
			) : null}
		</li>
	)
}

/** Decision factors as high / medium / low chips; legacy numeric weights are ranked, never shown. */
function DecisionWeights({ value }: { value: unknown }) {
	const { t } = useTranslation("personaResearch")
	const weights = normalizeDecisionWeights(value)
	if (weights.length === 0) return null
	const levelLabel = { high: t("level.high"), medium: t("level.medium"), low: t("level.low") }
	return (
		<div className="grid grid-cols-[88px_minmax(0,1fr)] gap-2">
			<span className="text-xs leading-5 text-muted-foreground">
				{t("persona.layer.cognition")}
			</span>
			<span className="flex flex-wrap gap-1.5">
				{weights.map((weight) => (
					<span
						key={weight.factor}
						className={cn(
							"inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs",
							weight.level === "high"
								? "border-primary/40 bg-primary/10 text-primary"
								: "border-border text-foreground",
						)}
					>
						{weight.factor}
						<span className="text-[10px] opacity-70">{levelLabel[weight.level]}</span>
					</span>
				))}
			</span>
		</div>
	)
}

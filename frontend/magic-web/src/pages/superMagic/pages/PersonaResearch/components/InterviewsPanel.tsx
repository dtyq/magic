import { useMemo, useRef } from "react"
import { useSize } from "ahooks"
import { ArrowLeft, ChevronLeft, ChevronRight, Mic } from "lucide-react"
import { userStore } from "@/models/user"
import { observer } from "mobx-react-lite"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/shadcn-ui/button"
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/components/shadcn-ui/empty"
import { ScrollArea } from "@/components/shadcn-ui/scroll-area"
import MagicTooltip from "@/components/base/MagicTooltip"
import { cn } from "@/utils/cn"
import { usePersonaResearchStore } from "../context"
import { resolveTranscriptQuality } from "../services/researchAnalysis"
import type { InterviewFile, PersonaFile } from "../types"
import PersonaAvatar from "./PersonaAvatar"
import { InterviewStatusChip } from "./PersonaCard"
import { personaTone } from "./personaPortrait"
import TranscriptView, { TranscriptInsights } from "./TranscriptView"
import InterviewConversation from "./InterviewConversation"
import type { InterviewChatSend } from "../services/interviewChat"

interface InterviewsPanelProps {
	onSendFollowUp?: InterviewChatSend
	onShowProgress?: () => void
	variant: "desktop" | "mobile"
	focusedPersonaId: string | null
	onFocus: (personaId: string | null) => void
	/** Round to scroll to in the focused interview, set when a quote elsewhere is opened. */
	focusRound: { roundIndex: number; nonce: number } | null
}

/** Interview list (with round progress and quality warning) beside the selected transcript. */
function InterviewsPanel({
	variant,
	focusedPersonaId,
	onFocus,
	focusRound,
	onSendFollowUp,
	onShowProgress,
}: InterviewsPanelProps) {
	const { t } = useTranslation("personaResearch")
	const store = usePersonaResearchStore()
	const interviews = store.interviews
	const isMobile = variant === "mobile"
	const byPersona = useMemo(
		() => new Map(interviews.map((ref) => [ref.data.persona_id, ref.data])),
		[interviews],
	)
	const ids = interviews.map((ref) => ref.data.persona_id)
	// Desktop shows the first interview by default; mobile starts on the list.
	const selectedId = focusedPersonaId ?? (isMobile ? null : (ids[0] ?? null))
	const selected = selectedId ? (byPersona.get(selectedId) ?? null) : null
	const selectedIndex = selectedId ? ids.indexOf(selectedId) : -1
	// Wide panels put summary and findings in a third column beside the transcript.
	const rootRef = useRef<HTMLDivElement>(null)
	const rootSize = useSize(rootRef)
	const wide = !isMobile && (rootSize?.width ?? 0) >= 1000
	// Quotes cited by hypotheses (tagged with their id) and the interview's own quote list.
	const highlights = useMemo(() => {
		if (!selected) return []
		const cited = (store.study?.hypotheses ?? []).flatMap((hypothesis) =>
			(hypothesis.evidence_refs ?? []).flatMap((ref) =>
				ref.kind === "quote" && ref.persona_id === selected.persona_id
					? [{ personaId: ref.persona_id, text: ref.text, tag: hypothesis.id }]
					: [],
			),
		)
		const own = (selected.quotes ?? []).map((quote) => ({
			personaId: selected.persona_id,
			text: quote.text,
		}))
		return [...cited, ...own]
	}, [selected, store.study])

	const transcriptContent = selected ? (
		<>
			<RespondentHeader persona={store.personaById(selected.persona_id)} />
			<TranscriptView
				key={selected.persona_id}
				chat
				transcript={selected}
				respondentId={selected.persona_id}
				resolvePersona={store.personaById}
				focusRound={focusRound}
				highlights={highlights}
				insightsPlacement={wide ? "side" : "inline"}
			/>
		</>
	) : null

	if (interviews.length === 0) {
		return (
			<Empty className="h-full border-0 py-12">
				<EmptyHeader>
					<EmptyMedia variant="icon">
						<Mic />
					</EmptyMedia>
					<EmptyTitle className="text-sm">{t("console.interviewsEmptyTitle")}</EmptyTitle>
					<EmptyDescription className="text-xs">
						{t("console.interviewsEmpty")}
					</EmptyDescription>
				</EmptyHeader>
			</Empty>
		)
	}

	const list = (
		<InterviewList
			items={ids}
			selectedId={isMobile ? null : selectedId}
			resolvePersona={store.personaById}
			interviewOf={(id) => byPersona.get(id)}
			onSelect={onFocus}
		/>
	)
	if (isMobile && !selected)
		return (
			<ScrollArea className="h-full" viewportClassName="[&>div]:!block">
				{list}
			</ScrollArea>
		)

	return (
		<div ref={rootRef} className={cn("flex h-full min-h-0", isMobile && "flex-col")}>
			{isMobile ? null : (
				<ScrollArea className="w-56 shrink-0 border-r border-border">{list}</ScrollArea>
			)}
			<div className="flex min-h-0 min-w-0 flex-1 flex-col">
				{selected ? (
					<div className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-2">
						{isMobile ? (
							<Button
								variant="ghost"
								size="sm"
								className="-ml-2"
								onClick={() => onFocus(null)}
							>
								<ArrowLeft className="size-4" />
								{t("console.backToList")}
							</Button>
						) : (
							// The respondent header below names the person; the bar only navigates.
							<span className="flex-1" />
						)}
						<span className="ml-auto flex items-center gap-1">
							<span className="text-xs tabular-nums text-muted-foreground">
								{selectedIndex + 1}/{ids.length}
							</span>
							<MagicTooltip title={t("console.previous")}>
								<Button
									variant="ghost"
									size="icon"
									className="size-7"
									aria-label={t("console.previous")}
									disabled={selectedIndex <= 0}
									onClick={() => onFocus(ids[selectedIndex - 1] ?? null)}
								>
									<ChevronLeft className="size-4" />
								</Button>
							</MagicTooltip>
							<MagicTooltip title={t("console.next")}>
								<Button
									variant="ghost"
									size="icon"
									className="size-7"
									aria-label={t("console.next")}
									disabled={selectedIndex >= ids.length - 1}
									onClick={() => onFocus(ids[selectedIndex + 1] ?? null)}
								>
									<ChevronRight className="size-4" />
								</Button>
							</MagicTooltip>
						</span>
					</div>
				) : null}
				<div className="flex min-h-0 flex-1">
					{selected && onSendFollowUp && onShowProgress && !store.isReadOnly ? (
						<InterviewConversation
							key={`${userStore.user.userInfo?.user_id}:${userStore.user.userInfo?.organization_code}:${store.selectedProject?.id}:${store.selectedTopic?.id}:${selected.persona_id}`}
							transcript={selected}
							name={
								store.personaById(selected.persona_id)?.name ?? selected.persona_id
							}
							isMobile={isMobile}
							onSend={onSendFollowUp}
							onShowProgress={onShowProgress}
						>
							{transcriptContent}
						</InterviewConversation>
					) : (
						<ScrollArea
							className="min-h-0 min-w-0 flex-1"
							viewportClassName="[&>div]:!block"
						>
							<div className="mx-auto flex max-w-3xl flex-col gap-5 px-6 pb-14 pt-6">
								{transcriptContent}
							</div>
						</ScrollArea>
					)}
					{wide && selected ? (
						<ScrollArea className="w-80 shrink-0 border-l border-border bg-muted/30">
							<TranscriptInsights transcript={selected} className="p-5" />
						</ScrollArea>
					) : null}
				</div>
			</div>
		</div>
	)
}

function InterviewList({
	items,
	selectedId,
	resolvePersona,
	interviewOf,
	onSelect,
}: {
	items: string[]
	selectedId: string | null
	resolvePersona: (id: string) => PersonaFile | null
	interviewOf: (id: string) => InterviewFile | undefined
	onSelect: (id: string) => void
}) {
	const { t } = useTranslation("personaResearch")
	return (
		<ul className="flex flex-col gap-0.5 p-2">
			{items.map((id) => {
				const persona = resolvePersona(id)
				const interview = interviewOf(id)
				const answered =
					interview?.rounds.filter((round) => round.role === "persona").length ?? 0
				const highInferred = interview
					? resolveTranscriptQuality(interview).isHighInferred
					: false
				return (
					<li key={id}>
						<button
							type="button"
							className={cn(
								"flex w-full flex-col gap-1.5 rounded-lg px-2.5 py-2 text-left outline-none transition-colors",
								"hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring",
								selectedId === id && "font-medium",
							)}
							// The selected respondent takes their own colour, as on their card.
							style={
								selectedId === id
									? { backgroundColor: personaTone(persona?.name ?? id).tint }
									: undefined
							}
							onClick={() => onSelect(id)}
						>
							<span className="flex items-center gap-2">
								<PersonaAvatar
									id={id}
									name={persona?.name ?? id}
									className="size-7"
								/>
								<span className="min-w-0 flex-1 truncate text-sm">
									{persona?.name ?? id}
								</span>
								{highInferred ? (
									<span className="rounded bg-amber-500/15 px-1 text-[10px] text-amber-700 dark:text-amber-400">
										{t("quality.highInferredShort")}
									</span>
								) : null}
							</span>
							{interview?.status === "done" || interview?.status === "failed" ? (
								<span className="pl-9 text-[11px]">
									<InterviewStatusChip status={interview.status} />
								</span>
							) : (
								// The ceiling is a safety budget, not a completion target.
								<span className="flex items-center gap-2 pl-9">
									<span className="text-[11px] text-muted-foreground">
										{t("options.answeredRounds", { count: answered })}
									</span>
									{interview ? (
										<span className="text-[11px]">
											<InterviewStatusChip status={interview.status} />
										</span>
									) : null}
								</span>
							)}
						</button>
					</li>
				)
			})}
		</ul>
	)
}

/** Who is speaking: square portrait, name and the one-line profile above the transcript. */
function RespondentHeader({ persona }: { persona: PersonaFile | null }) {
	if (!persona) return null
	return (
		<header className="flex items-center gap-4">
			<PersonaAvatar
				id={persona.id}
				name={persona.name}
				shape="square"
				className="size-[60px]"
			/>
			<div className="flex min-w-0 flex-col gap-0.5">
				<h3 className="truncate text-xl font-bold tracking-tight text-foreground">
					{persona.name}
				</h3>
				{persona.tagline ? (
					<p className="line-clamp-2 text-[13px] leading-6 text-muted-foreground">
						{persona.tagline}
					</p>
				) : null}
			</div>
		</header>
	)
}

export default observer(InterviewsPanel)

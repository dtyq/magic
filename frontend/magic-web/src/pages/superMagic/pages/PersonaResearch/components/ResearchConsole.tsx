import { useEffect, useRef, useState, type ReactNode } from "react"
import {
	BookOpenText,
	ChartColumn,
	ClipboardCheck,
	FolderOpen,
	MessagesSquare,
	Mic,
	Target,
	UsersRound,
	type LucideIcon,
} from "lucide-react"
import { useMemoizedFn } from "ahooks"
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
import { Skeleton } from "@/components/shadcn-ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/shadcn-ui/tabs"
import type { AttachmentItem } from "@/pages/superMagic/components/TopicFilesButton/hooks/types"
import { cn } from "@/utils/cn"
import { usePersonaResearchStore } from "../context"
import { useScrollFade } from "../hooks/useScrollFade"
import { useSlidingThumb } from "../hooks/useSlidingThumb"
import { ResearchOnboardingAnchor } from "../onboarding/onboardingState"
import type { PersonaFile, QuoteRef } from "../types"
import AnalysisBoard from "./AnalysisBoard"
import { discussionTitle } from "../services/discussionTitle"
import HypothesisBoard from "./HypothesisBoard"
import InterviewsPanel from "./InterviewsPanel"
import PersonaAvatar from "./PersonaAvatar"
import PersonaPanel from "./PersonaPanel"
import StudyFileList from "./StudyFileList"
import { EASE_OUT, PRESSABLE } from "./surface"
import TranscriptView from "./TranscriptView"
import ValidationPane from "./ValidationPane"

import type { InterviewChatSend } from "../services/interviewChat"

export type ResearchConsoleTab =
	| "report"
	| "hypotheses"
	| "personas"
	| "interviews"
	| "discussions"
	| "analysis"
	| "files"
	| "validation"

interface ResearchConsoleProps {
	onSendFollowUp?: InterviewChatSend
	onShowConversation?: () => void
	activeTab: ResearchConsoleTab
	onTabChange: (tab: ResearchConsoleTab) => void
	/** The report on its own, the first thing a finished study shows. */
	reportPane: ReactNode
	/** Report actions (full screen, edit and download) shown in the tab bar on the report tab. */
	reportActions?: ReactNode
	/** Content before the tabs in the same bar (share page: study title), so no extra header row is needed. */
	toolbarStart?: ReactNode
	/** Content at the right end of the tab bar (share page: share actions and view switch). */
	toolbarEnd?: ReactNode
	/** The shared file preview (any study file or tool result clicked in the conversation). */
	filesPane: ReactNode
	/** File open in the preview, highlighted in the files list. */
	activeFileId?: string | null
	/** Interview to show when the tab opens from a persona card. */
	focusedInterviewPersonaId: string | null
	onFocusInterview: (personaId: string | null) => void
	onOpenPersona: (persona: PersonaFile) => void
	/** Opens a study file (desk research, questionnaire CSV) in the shared preview. */
	onOpenFile: (file: AttachmentItem) => void
	/** Moves to the conversation and prefills the "compare real answers" request. */
	onRequestValidationUpload: () => void
	variant: "desktop" | "mobile"
}

type RoundHighlight = { key: string; roundIndex: number; nonce: number }

/**
 * Study outputs panel. Tool calls stay in the conversation; this panel shows the research
 * artifacts: hypotheses, personas, interviews, focus groups, analysis, report/files and
 * real-person validation. Quotes anywhere jump to their transcript round.
 */
function ResearchConsole({
	onSendFollowUp,
	onShowConversation,
	activeTab,
	onTabChange,
	reportPane,
	reportActions,
	toolbarStart,
	toolbarEnd,
	filesPane,
	activeFileId,
	focusedInterviewPersonaId,
	onFocusInterview,
	onOpenPersona,
	onOpenFile,
	onRequestValidationUpload,
	variant,
}: ResearchConsoleProps) {
	const { t } = useTranslation("personaResearch")
	const store = usePersonaResearchStore()
	const study = store.study
	const studyAttachments = store.studyAttachments
	const discussions = store.discussions
	const isMobile = variant === "mobile"
	const [activeDiscussionIndex, setActiveDiscussionIndex] = useState(0)
	const [focusRound, setFocusRound] = useState<RoundHighlight | null>(null)

	useEffect(() => {
		if (activeDiscussionIndex >= discussions.length) setActiveDiscussionIndex(0)
	}, [activeDiscussionIndex, discussions.length])

	/**
	 * Opens the transcript a quote came from and highlights its round.
	 * file "discussions/<id>.json" → that focus group; otherwise the persona's interview.
	 */
	const openQuote = useMemoizedFn(
		(quote: Pick<QuoteRef, "persona_id" | "round_index" | "file">) => {
			const file = quote.file ?? ""
			if (file.startsWith("discussions/")) {
				const index = discussions.findIndex((ref) => ref.path.endsWith(file))
				if (index >= 0) {
					setActiveDiscussionIndex(index)
					onTabChange("discussions")
					if (quote.round_index !== undefined) {
						setFocusRound({
							key: `d:${index}`,
							roundIndex: quote.round_index,
							nonce: Date.now(),
						})
					}
					return
				}
			}
			onFocusInterview(quote.persona_id)
			onTabChange("interviews")
			if (quote.round_index !== undefined) {
				setFocusRound({
					key: `i:${quote.persona_id}`,
					roundIndex: quote.round_index,
					nonce: Date.now(),
				})
			}
		},
	)

	const openSources = useMemoizedFn(() => {
		if (studyAttachments?.deskResearch) onOpenFile(studyAttachments.deskResearch)
	})

	const hypotheses = study?.hypotheses ?? []
	const decidedCount = hypotheses.filter((item) => item.verdict !== "pending").length
	const doneInterviews = store.interviews.filter((ref) => ref.data.status === "done").length

	/**
	 * "New content" dots: a tab shows a dot when its count grew since the user last viewed it.
	 * Example: on the personas tab while interviews 3→5 finish, the interviews tab gets a dot.
	 */
	const counts: Record<ResearchConsoleTab, number> = {
		report: studyAttachments?.report ? 1 : 0,
		hypotheses: hypotheses.length + decidedCount,
		personas: store.studyPersonas.length,
		interviews: doneInterviews,
		discussions: discussions.length,
		analysis: store.synthesis?.themes.length ?? 0,
		files: studyAttachments?.all.length ?? 0,
		validation: (studyAttachments?.validation ? 1 : 0) + (store.validationResults ? 1 : 0),
	}
	const seenCountsRef = useRef<Record<ResearchConsoleTab, number> | null>(null)
	if (seenCountsRef.current === null) seenCountsRef.current = { ...counts }
	useEffect(() => {
		if (seenCountsRef.current) seenCountsRef.current[activeTab] = counts[activeTab]
	})
	const hasNew = (tab: ResearchConsoleTab) =>
		tab !== activeTab && counts[tab] > (seenCountsRef.current?.[tab] ?? 0)

	const tabs: { value: ResearchConsoleTab; icon: LucideIcon; label: string; badge?: string }[] = [
		{ value: "report", icon: BookOpenText, label: t("console.report") },
		{
			value: "hypotheses",
			icon: Target,
			label: t("console.hypotheses"),
			badge: hypotheses.length ? `${decidedCount}/${hypotheses.length}` : undefined,
		},
		{
			value: "personas",
			icon: UsersRound,
			label: t("console.personas"),
			badge: store.studyPersonas.length ? String(store.studyPersonas.length) : undefined,
		},
		{
			value: "interviews",
			icon: Mic,
			label: t("console.interviews"),
			badge: store.interviews.length
				? `${doneInterviews}/${store.interviews.length}`
				: undefined,
		},
		{
			value: "discussions",
			icon: MessagesSquare,
			label: t("console.discussions"),
			badge: discussions.length ? String(discussions.length) : undefined,
		},
		{
			value: "analysis",
			icon: ChartColumn,
			label: t("console.analysis"),
			badge: store.synthesis?.themes.length
				? String(store.synthesis.themes.length)
				: undefined,
		},
		{ value: "files", icon: FolderOpen, label: t("console.files") },
		{
			value: "validation",
			icon: ClipboardCheck,
			label: t("console.validation"),
			badge: store.validationResults
				? String(store.validationResults.respondent_count)
				: undefined,
		},
	]

	const activeDiscussion = discussions[activeDiscussionIndex]
	const activeDiscussionTitle = activeDiscussion ? discussionTitle(activeDiscussion.data) : null
	const { containerRef: thumbContainerRef, rect: thumb } = useSlidingThumb<HTMLDivElement>(
		`${activeTab}:${isMobile}`,
	)

	const { ref: tabsScrollRef, maskStyle: tabsFadeStyle } = useScrollFade<HTMLDivElement>(
		`${activeTab}:${isMobile}`,
	)

	return (
		<Tabs
			value={activeTab}
			onValueChange={(value) => onTabChange(value as ResearchConsoleTab)}
			// gap-0: the Tabs default gap-2 would leave an 8px strip between the tab bar and content.
			className="flex h-full min-h-0 flex-col gap-0"
			data-testid="persona-research-console"
		>
			<div className="flex shrink-0 items-center gap-3 border-b border-border px-4 py-2">
				{toolbarStart}
				{/* Narrow consoles scroll the tabs sideways; the scrollbar is hidden because an
				    always-visible one draws a second line and a gap under the tab bar. */}
				<div
					ref={tabsScrollRef}
					style={tabsFadeStyle}
					className="min-w-0 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
				>
					{/* The ink pill is one thumb that slides to the active tab (falls back to a per-tab
				    background until it has been measured). */}
					<div ref={thumbContainerRef} className="relative w-max">
						{thumb ? (
							<span
								aria-hidden
								className={cn(
									"absolute inset-y-0 left-0 rounded-full bg-foreground transition-[transform,width] duration-200 motion-reduce:transition-none",
									EASE_OUT,
								)}
								style={{
									width: thumb.width,
									transform: `translateX(${thumb.left}px)`,
								}}
							/>
						) : null}
						<TabsList
							className="relative h-auto gap-0.5 bg-transparent p-0"
							data-guide-anchor={ResearchOnboardingAnchor.StudioTabs}
						>
							{tabs.map(({ value, icon: Icon, label, badge }) => (
								<TabsTrigger
									key={value}
									value={value}
									// Mobile inactive tabs show only the icon, so the name must be on the control.
									aria-label={isMobile ? label : undefined}
									data-guide-anchor={
										value === "validation"
											? ResearchOnboardingAnchor.StudioValidation
											: undefined
									}
									className={cn(
										"relative h-8 gap-1.5 rounded-full border-0 bg-transparent px-3 text-[13px] text-muted-foreground shadow-none transition-colors duration-200 hover:text-foreground",
										"data-[state=active]:bg-transparent data-[state=active]:text-background data-[state=active]:shadow-none dark:data-[state=active]:border-transparent dark:data-[state=active]:bg-transparent",
										!thumb &&
											"data-[state=active]:bg-foreground dark:data-[state=active]:bg-foreground",
										PRESSABLE,
									)}
								>
									{/* Desktop labels are enough; mobile keeps icons because inactive labels are hidden. */}
									{isMobile ? <Icon className="size-3.5" /> : null}
									{isMobile && value !== activeTab ? null : label}
									{badge ? (
										<span className="font-mono text-[11px] tabular-nums opacity-60">
											{badge}
										</span>
									) : null}
									{hasNew(value) ? (
										<span
											className="absolute right-1 top-1 size-1.5 rounded-full bg-primary"
											aria-label={t("console.newContent")}
										/>
									) : null}
								</TabsTrigger>
							))}
						</TabsList>
					</div>
				</div>
				{(activeTab === "report" && reportActions) || toolbarEnd ? (
					// Same height as a tab (h-8) so showing the actions never changes the bar height.
					<div className="ml-auto flex h-8 shrink-0 items-center gap-1.5">
						{activeTab === "report" && reportActions ? (
							<div className="flex items-center gap-1 [&_button]:h-6">
								{reportActions}
							</div>
						) : null}
						{toolbarEnd}
					</div>
				) : null}
			</div>
			{store.studyFileInvalid ? (
				<p className="mx-3 mt-2 rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
					{t("console.studyFileInvalid")}
				</p>
			) : null}

			{/* Kept mounted so the report preview is not reloaded on every tab switch. */}
			<TabsContent
				value="report"
				forceMount
				className={cn("relative mt-0 min-h-0 flex-1", activeTab !== "report" && "hidden")}
			>
				{reportPane}
			</TabsContent>

			<TabsContent value="hypotheses" className="mt-0 min-h-0 flex-1">
				<HypothesisBoard onOpenQuote={openQuote} onOpenSources={openSources} />
			</TabsContent>

			<TabsContent value="personas" className="mt-0 min-h-0 flex-1">
				<PersonaPanel variant={variant} onOpenPersona={onOpenPersona} />
			</TabsContent>

			<TabsContent value="interviews" className="mt-0 min-h-0 flex-1">
				<InterviewsPanel
					onSendFollowUp={onSendFollowUp}
					onShowProgress={onShowConversation}
					variant={variant}
					focusedPersonaId={focusedInterviewPersonaId}
					onFocus={onFocusInterview}
					focusRound={
						focusRound?.key === `i:${focusedInterviewPersonaId}` ? focusRound : null
					}
				/>
			</TabsContent>

			<TabsContent value="discussions" className="mt-0 min-h-0 flex-1">
				{discussions.length === 0 ? (
					<Empty className="h-full border-0 py-12">
						<EmptyHeader>
							<EmptyMedia variant="icon">
								<MessagesSquare />
							</EmptyMedia>
							<EmptyTitle className="text-sm">
								{t("console.discussionsEmptyTitle")}
							</EmptyTitle>
							<EmptyDescription className="text-xs">
								{t("console.discussionsEmpty")}
							</EmptyDescription>
						</EmptyHeader>
					</Empty>
				) : (
					<div className="flex h-full min-h-0 flex-col">
						<div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border px-4 py-2.5">
							{discussions.length > 1
								? discussions.map((ref, index) => (
										<Button
											key={ref.fileId}
											size="sm"
											variant={
												index === activeDiscussionIndex
													? "secondary"
													: "ghost"
											}
											className="h-7"
											onClick={() => setActiveDiscussionIndex(index)}
										>
											{/* The topic tells discussions apart; older files fall back to a number. */}
											<span className="max-w-[16em] truncate">
												{discussionTitle(ref.data)?.text ||
													t("console.discussionN", { index: index + 1 })}
											</span>
										</Button>
									))
								: null}
							<span className="flex -space-x-1.5">
								{(activeDiscussion?.data.participants ?? []).map((id) => (
									<PersonaAvatar
										key={id}
										id={id}
										name={store.personaById(id)?.name ?? id}
										className="size-6 border-2 border-background text-[10px]"
									/>
								))}
							</span>
							<span className="text-xs text-muted-foreground">
								{t("console.participants", {
									count: activeDiscussion?.data.participants.length ?? 0,
								})}
							</span>
						</div>
						<ScrollArea className="min-h-0 flex-1" viewportClassName="[&>div]:!block">
							<div className="mx-auto max-w-3xl p-4">
								{activeDiscussionTitle ? (
									// Older discussions saved no topic; their first question stands in,
									// labelled as such so it is not read as a topic.
									<h3
										className={cn(
											"mb-3 text-[15px] leading-6",
											activeDiscussionTitle.isFirstQuestion
												? "font-medium text-muted-foreground"
												: "font-semibold text-foreground",
										)}
									>
										{t(
											activeDiscussionTitle.isFirstQuestion
												? "console.discussionFirstQuestion"
												: "console.discussionTopic",
											{ topic: activeDiscussionTitle.text },
										)}
									</h3>
								) : null}
								{activeDiscussion ? (
									<TranscriptView
										transcript={activeDiscussion.data}
										resolvePersona={store.personaById}
										focusRound={
											focusRound?.key === `d:${activeDiscussionIndex}`
												? focusRound
												: null
										}
									/>
								) : null}
							</div>
						</ScrollArea>
					</div>
				)}
			</TabsContent>

			<TabsContent value="analysis" className="mt-0 min-h-0 flex-1 bg-muted/40">
				<AnalysisBoard onOpenQuote={openQuote} onOpenSources={openSources} />
			</TabsContent>

			{/* Keep the file preview mounted so its tabs and renderer caches survive tab switches. */}
			<TabsContent
				value="files"
				forceMount
				className={cn(
					"relative mt-0 flex min-h-0 flex-1 flex-col",
					activeTab !== "files" && "hidden",
				)}
			>
				{isMobile ? (
					// Phones list the files only; a tap opens the preview in the studio's popup (the
					// preview pane is mounted there, never here, so there is a single instance).
					<div className="min-h-0 flex-1 bg-muted/40">
						<StudyFileList
							activeFileId={activeFileId}
							onOpenFile={onOpenFile}
							variant="mobile"
						/>
					</div>
				) : (
					<div className="flex min-h-0 flex-1">
						<div className="w-60 shrink-0 border-r border-border bg-muted/40">
							<StudyFileList
								activeFileId={activeFileId}
								onOpenFile={onOpenFile}
								variant="desktop"
							/>
						</div>
						<div className="relative min-h-0 min-w-0 flex-1">{filesPane}</div>
					</div>
				)}
			</TabsContent>

			<TabsContent value="validation" className="mt-0 min-h-0 flex-1 bg-muted/40">
				<ValidationPane
					onRequestUpload={onRequestValidationUpload}
					onOpenFile={onOpenFile}
				/>
			</TabsContent>
		</Tabs>
	)
}

/** Tab bar and card placeholders while the study's files load. */
export function ResearchConsoleSkeleton() {
	return (
		<div className="flex h-full min-h-0 flex-col" aria-busy>
			<div className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-2.5">
				{Array.from({ length: 7 }, (_, index) => (
					<Skeleton key={index} className="h-6 w-16" />
				))}
			</div>
			<div className="flex flex-col gap-3 p-4">
				<Skeleton className="h-16 w-full rounded-xl" />
				{Array.from({ length: 3 }, (_, index) => (
					<Skeleton key={index} className="h-24 w-full rounded-xl" />
				))}
			</div>
		</div>
	)
}

export default observer(ResearchConsole)

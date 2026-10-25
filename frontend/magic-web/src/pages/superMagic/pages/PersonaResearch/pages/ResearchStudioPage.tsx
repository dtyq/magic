import { useEffect, useRef, useState } from "react"
import { useMemoizedFn, useSize } from "ahooks"
import {
	ArrowLeft,
	ChevronDown,
	FileSearch,
	Info,
	Maximize2,
	PanelRightClose,
	PanelRightOpen,
	PencilLine,
	RefreshCw,
	Share2,
} from "lucide-react"
import type { ImperativePanelHandle } from "react-resizable-panels"
import { observer } from "mobx-react-lite"
import { useTranslation } from "react-i18next"
import { useParams } from "react-router-dom"
import { toast } from "sonner"
import { Button } from "@/components/shadcn-ui/button"
import { Skeleton } from "@/components/shadcn-ui/skeleton"
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/components/shadcn-ui/empty"
import {
	ResizableHandle,
	ResizablePanel,
	ResizablePanelGroup,
} from "@/components/shadcn-ui/resizable"
import { Tabs, TabsList, TabsTrigger } from "@/components/shadcn-ui/tabs"
import MagicTooltip from "@/components/base/MagicTooltip"
import type { DetailRef } from "@/pages/superMagic/components/Detail"
import TopicSharePopover from "@/pages/superMagic/components/TopicSharePopover"
import type { AttachmentItem } from "@/pages/superMagic/components/TopicFilesButton/hooks/types"
import { useIsMobile } from "@/hooks/useIsMobile"
import { useNavigate } from "@/routes/hooks/useNavigate"
import { RouteName } from "@/routes/constants"
import { cn } from "@/utils/cn"
import { platformKey } from "@/utils/storage"
import { usePersonaResearchStore } from "../context"
import { useResearchBack } from "../hooks/useResearchBack"
import { useResearchDetailEvents, whenDetailReady } from "../hooks/useResearchDetailEvents"
import ResearchConsole, {
	ResearchConsoleSkeleton,
	type ResearchConsoleTab,
} from "../components/ResearchConsole"
import ResearchConversationPanel, {
	type ResearchConversationPanelRef,
} from "../components/ResearchConversationPanel"
import ResearchFilesPane from "../components/ResearchFilesPane"
import ResearchMobilePreview, {
	type ResearchMobilePreviewRef,
} from "../components/ResearchMobilePreview"
import ResearchReportPane, { type ResearchReportPaneRef } from "../components/ResearchReportPane"
import PersonaAvatar from "../components/PersonaAvatar"
import PersonaDetailSheet from "../components/PersonaDetailSheet"
import StudyStepper, { StudyStepperSkeleton } from "../components/StudyStepper"
import StudyTitleEditor from "../components/StudyTitleEditor"
import {
	StudyProgressSegments,
	StudyStatusBadge,
	StudyStatusBadgeSkeleton,
} from "../components/StudyStatusBadge"
import ResearchOnboarding from "../onboarding/ResearchOnboarding"
import ResearchHelp from "../onboarding/ResearchHelp"
import { ResearchOnboardingAnchor } from "../onboarding/onboardingState"
import type { InterviewChatSend } from "../services/interviewChat"
import { routeResearchFile } from "../services/researchFileRouting"
import { getAttachmentPath, normalizeResearchPath } from "../services/researchFiles"
import {
	countVisibleStudyFiles,
	firstOutputTab,
	hasStudyOutputs,
	type StudyOutputCounts,
} from "../services/studyOutputs"
import { resolveStudyStatus } from "../services/studyStatus"
import type { PersonaFile, StudyFile, StudyPhaseKey } from "../types"

/** Console width from which the report actions keep their text labels (English needs the most). */
const REPORT_ACTIONS_LABEL_MIN_WIDTH = 1160

/** Which output tab follows each phase while the study runs (clarify stays in the conversation). */
const PHASE_TAB: Partial<Record<StudyFile["phase"], ResearchConsoleTab>> = {
	plan: "hypotheses",
	interview: "personas",
	report: "report",
	validation: "report",
	// Finished studies open on the report, the deliverable a decision maker reads first.
	done: "report",
}

/** Research studio: stepper, conversation on the left, study outputs on the right. */
function ResearchStudioPage() {
	const goBack = useResearchBack()
	const { t } = useTranslation("personaResearch")
	const { topicId } = useParams<{ topicId?: string }>()
	const navigate = useNavigate()
	const isMobile = useIsMobile()
	const store = usePersonaResearchStore()
	const conversationRef = useRef<ResearchConversationPanelRef>(null)
	const detailRef = useRef<DetailRef>(null)

	const [consoleTab, setConsoleTab] = useState<ResearchConsoleTab>("hypotheses")
	const [mobileView, setMobileView] = useState<"conversation" | "outputs">("conversation")
	const [focusedInterviewId, setFocusedInterviewId] = useState<string | null>(null)
	const [openedPersona, setOpenedPersona] = useState<PersonaFile | null>(null)
	const [userSelectDetail, setUserSelectDetail] = useState<unknown>()
	const [autoDetail, setAutoDetail] = useState<unknown>()
	const [activeFileId, setActiveFileId] = useState<string | null>(null)
	const [shareOpen, setShareOpen] = useState(false)
	// Phones preview files in the shared mobile popup; desktop uses the files tab.
	const mobilePreviewRef = useRef<ResearchMobilePreviewRef>(null)
	// The report's action buttons share the tab bar with the tabs; labelled they need about 1160px,
	// below that they squeeze the tabs out of sight, so they shrink to icons.
	const consolePanelRef = useRef<HTMLDivElement>(null)
	const consolePanelWidth = useSize(consolePanelRef)?.width
	const compactReportActions =
		isMobile ||
		(consolePanelWidth !== undefined && consolePanelWidth < REPORT_ACTIONS_LABEL_MIN_WIDTH)
	const followedPhaseRef = useRef<string | null>(null)
	const reportPaneRef = useRef<ResearchReportPaneRef>(null)
	const conversationPanelRef = useRef<ImperativePanelHandle>(null)
	const [conversationCollapsed, setConversationCollapsed] = useState(false)
	// Finished studies fold the six-step stepper into a small toggle to give the report room.
	const [stepperOpen, setStepperOpen] = useState(false)
	// Set while the results panel slides in after the study's first output appears.
	const [outputsRevealing, setOutputsRevealing] = useState(false)
	// A study with no outputs hides the results panel; opening a preview or file must bring it in.
	const [outputsRequested, setOutputsRequested] = useState(false)
	const outputsWereHiddenRef = useRef(false)

	useEffect(() => {
		store.selectStudy(topicId)
		followedPhaseRef.current = null
		outputsWereHiddenRef.current = false
		setOutputsRequested(false)
		// Tool steps belong to one study's conversation; never carry them into another study.
		setUserSelectDetail(undefined)
		setAutoDetail(undefined)
	}, [store, topicId])

	const selectedTopic = store.selectedTopic
	const study = store.study
	const studyAttachments = store.studyAttachments
	const report = studyAttachments?.report ?? null
	const status = resolveStudyStatus(selectedTopic, study)
	const isContentLoading = store.isStudyContentLoading
	// Persona building has no plan, interviews or report: no phase stepper and no study scale.
	const isPersonaBuild = study?.study_type === "persona_build"
	const reportWriting =
		study?.phases.some((phase) => phase.key === "report" && phase.status === "running") ?? false

	const showOutputs = useMemoizedFn((tab: ResearchConsoleTab) => {
		setOutputsRequested(true)
		setConsoleTab(tab)
		if (isMobile) setMobileView("outputs")
	})

	/**
	 * Contract files (persona, interview, discussion, synthesis, validation results) have their own
	 * UI; raw JSON in the generic preview helps nobody. Every entry that opens a file (report links,
	 * message mentions, file lists, deliverables) goes through here. Returns true when handled.
	 */
	const routeFile = useMemoizedFn((fileItem?: unknown): boolean => {
		const file = fileItem as Partial<AttachmentItem> | undefined
		const path = file
			? getAttachmentPath(file as AttachmentItem) || normalizeResearchPath(file.file_path)
			: ""
		const target = routeResearchFile(path)
		switch (target.kind) {
			case "persona": {
				const persona = store.personaById(target.personaId)
				// An unreadable persona file falls back to the preview rather than doing nothing.
				if (!persona) return false
				setOpenedPersona(persona)
				return true
			}
			case "interview":
				setOpenedPersona(null)
				setFocusedInterviewId(target.personaId)
				showOutputs("interviews")
				return true
			case "tab":
				showOutputs(target.tab)
				return true
			default:
				return false
		}
	})

	/** Files from the conversation open in the shared preview tab (a popup on phones). */
	const openFile = useMemoizedFn((fileItem?: unknown) => {
		if (routeFile(fileItem)) return
		if (isMobile) {
			mobilePreviewRef.current?.openFile(fileItem)
			return
		}
		showOutputs("files")
		setUserSelectDetail(undefined)
		// The preview tab is force-mounted; wait for the panel to mount and have layout.
		setTimeout(
			() => whenDetailReady(detailRef, (detail) => detail.openFileTab?.(fileItem)),
			100,
		)
	})

	/** Tool results (search results, browser steps) open as a detail view in the same tab. */
	const handleSelectDetail = useMemoizedFn((detail?: unknown) => {
		if (isMobile) {
			mobilePreviewRef.current?.openDetail(detail)
			return
		}
		showOutputs("files")
		setUserSelectDetail(detail)
	})

	// An empty files tab is a dead end: the first visit per study opens the report (or the plan
	// before it exists). Later, closing every tab is the user's choice and stays empty.
	const defaultFile = report ?? studyAttachments?.plan ?? null
	const filesOpenedRef = useRef(false)
	useEffect(() => {
		filesOpenedRef.current = false
	}, [topicId])
	useEffect(() => {
		// On phones the files tab is just the list; a preview popup must never open by itself.
		if (isMobile || consoleTab !== "files" || filesOpenedRef.current) return
		// autoDetail is the conversation's latest tool step, pushed on load even when no tab shows it.
		if (activeFileId || userSelectDetail) {
			filesOpenedRef.current = true
			return
		}
		if (!defaultFile) return
		filesOpenedRef.current = true
		openFile(defaultFile)
	}, [activeFileId, consoleTab, defaultFile, isMobile, openFile, userSelectDetail])

	// Message cards open previews through pubsub (tool playback, file mentions, citations).
	useResearchDetailEvents({
		detailRef,
		attachmentList: store.attachmentList,
		routeFile,
		// On phones the mobile preview below hosts these events instead.
		enabled: !isMobile,
		revealFiles: () => showOutputs("files"),
		setActiveFileId,
		setAutoDetail,
	})

	/**
	 * The output panel follows the study once per phase change (personas when interviews start,
	 * report when it is written). A user's later manual tab choice is kept until the next phase.
	 * On first load the panel jumps to the current phase without replaying earlier ones.
	 */
	useEffect(() => {
		const phase = study?.phase
		if (!phase || followedPhaseRef.current === phase) return
		followedPhaseRef.current = phase
		// A finished study without a report (persona building) opens on what it did produce.
		const tab =
			phase === "done" && !report
				? isPersonaBuild
					? "personas"
					: "hypotheses"
				: PHASE_TAB[phase]
		if (tab && !isMobile) setConsoleTab(tab)
		// Only phase changes move the panel; the report arriving later must not steal focus.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [isMobile, study?.phase])

	/**
	 * Until the study produces anything (clarify, waiting for the plan), the results panel would
	 * only hold empty tabs, so the conversation takes the page. The first output brings the panel
	 * in on its tab; the same counts as the tab badges, so no extra request.
	 */
	const outputCounts: StudyOutputCounts = {
		hypotheses: study?.hypotheses?.length ?? 0,
		personas: store.studyPersonas.length,
		interviews: store.interviews.length,
		discussions: store.discussions.length,
		analysis: store.synthesis?.themes.length ?? 0,
		report: report ? 1 : 0,
		validation: (studyAttachments?.validation ? 1 : 0) + (store.validationResults ? 1 : 0),
		files: countVisibleStudyFiles((studyAttachments?.all ?? []).map(getAttachmentPath)),
	}
	const outputsHidden =
		!isMobile && !isContentLoading && !outputsRequested && !hasStudyOutputs(outputCounts)
	const revealTab = firstOutputTab(outputCounts)
	useEffect(() => {
		if (outputsHidden) {
			outputsWereHiddenRef.current = true
			return
		}
		if (!outputsWereHiddenRef.current) return
		outputsWereHiddenRef.current = false
		setOutputsRevealing(true)
		// Only the tab changes: focus stays wherever the user is typing.
		if (revealTab) setConsoleTab(revealTab)
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [outputsHidden])

	const toggleConversation = useMemoizedFn(() => {
		const panel = conversationPanelRef.current
		if (!panel) return
		if (panel.isCollapsed()) panel.expand()
		else panel.collapse()
	})

	/** Stepper shortcuts: each finished or running phase opens its own output. */
	const handleStepClick = useMemoizedFn((key: StudyPhaseKey) => {
		const fileByStep: Partial<Record<StudyPhaseKey, AttachmentItem | null | undefined>> = {
			plan: studyAttachments?.plan,
			desk_research: studyAttachments?.deskResearch,
			report: studyAttachments?.report,
		}
		if (key === "clarify") {
			if (isMobile) setMobileView("conversation")
			return
		}
		if (key === "interview") return showOutputs("interviews")
		if (key === "validation") return showOutputs("validation")
		if (key === "report") return showOutputs("report")
		const file = fileByStep[key]
		if (file) openFile(file)
		else showOutputs("files")
	})

	/** Real answers are uploaded as conversation attachments; the agent does the comparison. */
	const handleRequestValidationUpload = useMemoizedFn(() => {
		if (isMobile) setMobileView("conversation")
		setTimeout(() => conversationRef.current?.fillComposer(t("validation.uploadPrompt")), 50)
		toast.info(t("validation.uploadHint"))
	})

	const handleAskPersona = useMemoizedFn((persona: PersonaFile) => {
		setOpenedPersona(null)
		if (isMobile) setMobileView("conversation")
		// Defer until the composer is visible on mobile.
		setTimeout(
			() =>
				conversationRef.current?.fillComposer(
					t("persona.askPrompt", { name: persona.name }),
				),
			50,
		)
	})

	const handleOpenInterview = useMemoizedFn((personaId: string) => {
		setOpenedPersona(null)
		setFocusedInterviewId(personaId)
		showOutputs("interviews")
	})

	const title = (selectedTopic && store.studyTitleOf(selectedTopic)) || t("study.untitled")
	const outputsCount = [report, studyAttachments?.validation].filter(Boolean).length

	const sendInterviewFollowUp = useMemoizedFn<InterviewChatSend>(async (request) => {
		return (await conversationRef.current?.sendInterviewFollowUp(request)) ?? false
	})
	const showConversation = useMemoizedFn(() => {
		if (isMobile) setMobileView("conversation")
		else conversationPanelRef.current?.expand()
	})

	if (!selectedTopic) {
		return (
			<Empty className="h-full">
				<EmptyHeader>
					<EmptyMedia variant="icon">
						<FileSearch />
					</EmptyMedia>
					<EmptyTitle>{t("study.notFoundTitle")}</EmptyTitle>
					<EmptyDescription>{t("study.notFound")}</EmptyDescription>
				</EmptyHeader>
				<EmptyContent>
					<Button
						variant="outline"
						onClick={() => navigate({ name: RouteName.PersonaResearch })}
					>
						{t("study.backHome")}
					</Button>
				</EmptyContent>
			</Empty>
		)
	}

	const studyTypeLabel = study?.study_type
		? {
				user_research: t("studyType.userResearch"),
				product_rnd: t("studyType.productRnd"),
				concept_test: t("studyType.conceptTest"),
				fast_insight: t("studyType.fastInsight"),
				panel_only: t("studyType.panelOnly"),
				persona_build: t("studyType.personaBuild"),
			}[study.study_type]
		: null
	const metaChips = [
		studyTypeLabel,
		study?.framework?.length ? study.framework.join(" · ") : null,
		study?.limits?.personas && !isPersonaBuild
			? t("study.scale", {
					personas: study.limits.personas,
					rounds: study.limits.interview_rounds ?? 20,
				})
			: null,
		// Only platforms that desk research actually sampled; unavailable or skipped sampling shows nothing.
		study?.social_sampling?.status === "sampled" && study.social_sampling.platforms.length
			? t("study.socialSampled", { platforms: study.social_sampling.platforms.join(" / ") })
			: null,
	].filter((chip): chip is string => Boolean(chip))

	const header = (
		<div className="flex shrink-0 flex-col gap-3 border-b border-border px-5 pb-3 pt-3">
			<div className="flex items-center gap-2">
				<MagicTooltip title={t("study.backHome")}>
					<Button
						variant="outline"
						size="icon"
						className="size-8 shrink-0"
						aria-label={t("study.backHome")}
						onClick={goBack}
					>
						<ArrowLeft className="size-4" />
					</Button>
				</MagicTooltip>
				{/* Prototype layout: title on top; status, step bar and method/scale as one quiet line. */}
				<div className="flex min-w-0 flex-1 flex-col gap-1">
					<StudyTitleEditor
						topicId={selectedTopic.id}
						title={store.studyTitleOf(selectedTopic)}
					/>
					<div
						className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground"
						data-guide-anchor={ResearchOnboardingAnchor.StudioProgress}
					>
						{isContentLoading ? (
							<StudyStatusBadgeSkeleton />
						) : (
							<StudyStatusBadge status={status} />
						)}
						{!isPersonaBuild && !isContentLoading ? (
							// The step bar doubles as the toggle for the full stepper once a study is done.
							<button
								type="button"
								className={cn(
									"flex shrink-0 items-center gap-1.5 rounded px-1 py-0.5 outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
									status.kind !== "done" && "pointer-events-none",
								)}
								aria-expanded={status.kind === "done" ? stepperOpen : undefined}
								aria-label={t("study.progressToggle", {
									done: status.completed,
									total: status.total,
								})}
								onClick={() => setStepperOpen((open) => !open)}
							>
								<StudyProgressSegments status={status} className="w-16" />
								{status.kind === "done" ? (
									<ChevronDown
										className={cn(
											"size-3.5 transition-transform",
											stepperOpen && "rotate-180",
										)}
									/>
								) : null}
							</button>
						) : null}
						{metaChips.length && !isMobile ? (
							<span className="truncate">{metaChips.join(" · ")}</span>
						) : null}
					</div>
				</div>
				{isMobile || store.studyPersonas.length === 0 ? null : (
					// Who was interviewed, at a glance; the note keeps the AI-simulation context visible.
					<button
						type="button"
						data-guide-anchor={ResearchOnboardingAnchor.StudioRespondents}
						className="hidden shrink-0 items-center gap-2 rounded-full py-0.5 pl-0.5 pr-2 text-[11.5px] text-muted-foreground outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring lg:flex"
						onClick={() => showOutputs("personas")}
					>
						<span className="flex -space-x-1.5">
							{store.studyPersonas.slice(0, 8).map((persona) => (
								<PersonaAvatar
									key={persona.id}
									id={persona.id}
									name={persona.name}
									className="size-6 ring-2 ring-background"
								/>
							))}
						</span>
						<span className="inline-flex items-center gap-1">
							<Info className="size-3.5" />
							{t("study.aiPanel", { count: store.studyPersonas.length })}
						</span>
					</button>
				)}
				<ResearchHelp page="studio" />
				{isMobile || outputsHidden ? null : (
					<Button
						variant="outline"
						size="sm"
						className="h-8 shrink-0 gap-1.5"
						onClick={toggleConversation}
					>
						{conversationCollapsed ? (
							<PanelRightOpen className="size-4" />
						) : (
							<PanelRightClose className="size-4" />
						)}
						{conversationCollapsed
							? t("study.expandConversation")
							: t("study.collapseConversation")}
					</Button>
				)}
				<TopicSharePopover
					// Shared research shows its results from study files; warn before hiding them.
					fileListOffHint={t("share.fileListOffHint")}
					open={shareOpen}
					onOpenChange={setShareOpen}
					topicId={selectedTopic.id}
					topicTitle={title}
				>
					<Button
						size={isMobile ? "icon" : "sm"}
						className={cn("h-8", isMobile && "size-8")}
						aria-label={t("study.share")}
						data-guide-anchor={ResearchOnboardingAnchor.StudioShare}
						// On phones the share popover only renders its sheet; the trigger is not wired to
						// it, so the caller opens it. Desktop's popover trigger already toggles itself.
						onClick={isMobile ? () => setShareOpen(true) : undefined}
					>
						<Share2 className="size-4" />
						{isMobile ? null : t("study.share")}
					</Button>
				</TopicSharePopover>
			</div>
			{isContentLoading ? (
				<StudyStepperSkeleton compact={isMobile} />
			) : isPersonaBuild || (status.kind === "done" && !stepperOpen) ? null : (
				<StudyStepper
					study={study}
					compact={isMobile}
					waitingForUser={status.kind === "waiting_user"}
					onStepClick={handleStepClick}
				/>
			)}
		</div>
	)

	// Desktop only: phones never mount this pane (see ResearchMobilePreview).
	const filesPaneNode = (
		<ResearchFilesPane
			ref={detailRef}
			userSelectDetail={userSelectDetail}
			autoDetail={autoDetail}
			setUserSelectDetail={setUserSelectDetail}
			activeFileId={activeFileId}
			onActiveFileChange={setActiveFileId}
			onInterceptFile={routeFile}
		/>
	)

	const consoleNode = isContentLoading ? (
		<ResearchConsoleSkeleton />
	) : (
		<ResearchConsole
			onSendFollowUp={sendInterviewFollowUp}
			onShowConversation={showConversation}
			activeTab={consoleTab}
			onTabChange={setConsoleTab}
			focusedInterviewPersonaId={focusedInterviewId}
			onFocusInterview={setFocusedInterviewId}
			onOpenPersona={setOpenedPersona}
			onOpenFile={openFile}
			onRequestValidationUpload={handleRequestValidationUpload}
			variant={isMobile ? "mobile" : "desktop"}
			activeFileId={activeFileId}
			reportPane={
				<ResearchReportPane
					ref={reportPaneRef}
					generating={reportWriting}
					onInterceptFile={routeFile}
				/>
			}
			// Icon-only when narrow: the three labelled buttons (about 330px in English) squeeze the tab
			// strip beside them down to nothing, so the other tabs could not be reached.
			reportActions={
				report ? (
					<>
						<Button
							variant="ghost"
							size="sm"
							className="h-7 gap-1.5 px-2 text-xs"
							aria-label={t("report.refresh")}
							onClick={() => reportPaneRef.current?.refresh()}
						>
							<RefreshCw className="size-3.5" />
							{compactReportActions ? null : t("report.refresh")}
						</Button>
						{/* Phones open the report in the file popup, which already is full screen. */}
						{isMobile ? null : (
							<Button
								variant="ghost"
								size="sm"
								className="h-7 gap-1.5 px-2 text-xs"
								aria-label={t("report.fullscreen")}
								onClick={() => reportPaneRef.current?.enterFullscreen()}
							>
								<Maximize2 className="size-3.5" />
								{compactReportActions ? null : t("report.fullscreen")}
							</Button>
						)}
						<Button
							variant="ghost"
							size="sm"
							className="h-7 gap-1.5 px-2 text-xs"
							aria-label={t("report.editDownload")}
							onClick={() => openFile(report)}
						>
							<PencilLine className="size-3.5" />
							{compactReportActions ? null : t("report.editDownload")}
						</Button>
					</>
				) : null
			}
			filesPane={filesPaneNode}
		/>
	)

	const conversationNode = (
		<ResearchConversationPanel
			ref={conversationRef}
			variant={isMobile ? "mobile" : "desktop"}
			onFileClick={openFile}
			onSelectDetail={handleSelectDetail}
			onAutoDetailChange={setAutoDetail}
			onShowOutputs={showOutputs}
		/>
	)

	const sheet = (
		<PersonaDetailSheet
			persona={openedPersona}
			interview={
				openedPersona
					? (store.interviews.find((ref) => ref.data.persona_id === openedPersona.id)
							?.data ?? null)
					: null
			}
			onOpenChange={(open) => !open && setOpenedPersona(null)}
			onAskPersona={handleAskPersona}
			onOpenInterview={handleOpenInterview}
			side={isMobile ? "bottom" : "center"}
		/>
	)

	if (isMobile) {
		return (
			<div
				className="flex h-full min-h-0 flex-col bg-background"
				data-testid="persona-research-studio"
			>
				{header}
				<div className="shrink-0 px-4 pt-2">
					<Tabs
						value={mobileView}
						onValueChange={(value) => setMobileView(value as typeof mobileView)}
					>
						<TabsList className="w-full">
							<TabsTrigger value="conversation" className="flex-1">
								{t("study.conversation")}
							</TabsTrigger>
							<TabsTrigger value="outputs" className="flex-1 gap-1.5">
								{t("study.outputs")}
								{outputsCount + store.studyPersonas.length > 0 ? (
									<span className="rounded-full bg-primary/10 px-1.5 text-[10px] font-medium text-primary">
										{outputsCount + store.studyPersonas.length}
									</span>
								) : null}
							</TabsTrigger>
						</TabsList>
					</Tabs>
				</div>
				{/* Both views stay mounted so the composer draft and preview tabs survive switching. */}
				<div className={cn("min-h-0 flex-1", mobileView !== "conversation" && "hidden")}>
					{conversationNode}
				</div>
				<div className={cn("min-h-0 flex-1", mobileView !== "outputs" && "hidden")}>
					{consoleNode}
				</div>
				{sheet}
				<ResearchMobilePreview ref={mobilePreviewRef} routeFile={routeFile} />
			</div>
		)
	}

	return (
		<div
			className="flex h-full min-h-0 flex-col bg-background"
			data-testid="persona-research-studio"
		>
			{header}
			{/* Outputs on the left, conversation on the right; v2 key drops layouts saved in the old order. */}
			<ResizablePanelGroup
				direction="horizontal"
				autoSaveId={platformKey("persona-research-studio-layout-v2")}
				className="min-h-0 flex-1"
			>
				{/* The conversation panel keeps its place in the tree while the results panel is
				    absent, so the composer is never remounted and keeps its text and focus. A
				    one-panel layout is saved under its own key, leaving the two-panel ratio alone. */}
				{outputsHidden ? null : (
					<ResizablePanel id="outputs" order={1} defaultSize={64} minSize={40}>
						<div
							ref={consolePanelRef}
							className={cn(
								"h-full",
								outputsRevealing &&
									"duration-300 animate-in fade-in-0 slide-in-from-left-4 motion-reduce:animate-none",
							)}
							onAnimationEnd={() => setOutputsRevealing(false)}
						>
							{consoleNode}
						</div>
					</ResizablePanel>
				)}
				{/* Wide transparent hit area with a hairline; highlights while hovered or dragged. */}
				{outputsHidden ? null : (
					<ResizableHandle
						aria-label={t("study.resizePanels")}
						className="w-1.5 bg-transparent after:w-px after:bg-border hover:after:bg-primary/40 focus-visible:after:bg-primary data-[resize-handle-state=drag]:after:bg-primary"
					/>
				)}
				<ResizablePanel
					ref={conversationPanelRef}
					id="conversation"
					order={2}
					defaultSize={outputsHidden ? 100 : 36}
					minSize={outputsHidden ? 100 : 26}
					maxSize={outputsHidden ? 100 : 55}
					collapsible={!outputsHidden}
					collapsedSize={0}
					onCollapse={() => setConversationCollapsed(true)}
					onExpand={() => setConversationCollapsed(false)}
				>
					<div
						className={cn(
							"flex h-full min-h-0 flex-col bg-background",
							// Alone on the page, the conversation reads as a centred column.
							outputsHidden && "mx-auto w-full max-w-[860px]",
						)}
						data-guide-anchor={ResearchOnboardingAnchor.StudioConversation}
					>
						{conversationNode}
					</div>
				</ResizablePanel>
			</ResizablePanelGroup>
			<div className="flex shrink-0 items-center gap-4 border-t border-border px-4 py-2 text-xs text-muted-foreground">
				{isContentLoading ? (
					<>
						<Skeleton className="h-1 w-32" />
						<Skeleton className="h-3 w-14" />
					</>
				) : (
					<>
						<StudyProgressSegments status={status} className="w-32" />
						<span className="tabular-nums">
							{t("study.progress", { done: status.completed, total: status.total })}
						</span>
					</>
				)}
				{/* Shortcuts into the results panel; nothing to open while it is hidden. */}
				{outputsHidden ? null : (
					<>
						<span className="h-3 w-px bg-border" aria-hidden />
						<button
							type="button"
							className="rounded hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
							onClick={() => showOutputs("files")}
						>
							{t("study.outputsCount", { count: outputsCount })}
						</button>
						<button
							type="button"
							className="rounded hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
							onClick={() => showOutputs("personas")}
						>
							{t("study.personasCount", { count: store.studyPersonas.length })}
						</button>
					</>
				)}
				<span className="ml-auto">{t("study.aiDisclaimer")}</span>
			</div>
			{sheet}
			{/* Keyed by study so opening another one re-checks once its content has loaded. */}
			<ResearchOnboarding
				key={selectedTopic.id}
				page="studio"
				ready={!isContentLoading}
				// The agent waiting for an answer (an ask_user card) or still working is not the
				// moment for a tour: it would cover the card the user needs to answer. Without any
				// output the results panel is not rendered yet, so the tour would skip its tabs
				// and validation steps and still be marked seen; wait for the first output.
				deferred={
					status.kind === "waiting_user" ||
					status.kind === "running" ||
					store.isConversationGenerating ||
					outputsHidden
				}
				interrupted={status.kind === "waiting_user"}
			/>
		</div>
	)
}

export default observer(ResearchStudioPage)

import { useEffect, useState, type ReactNode } from "react"
import { useTranslation } from "react-i18next"
import {
	AudioLines,
	ChevronLeft,
	ChevronRight,
	Download,
	Ellipsis,
	Mic,
	Pause,
	RotateCcw,
	Share2,
	Sparkles,
	X,
} from "lucide-react"
import {
	HOME_ONBOARDING_REQUEST_EVENT,
	HOME_ONBOARDING_STATE_EVENT,
	HOME_ONBOARDING_STEP_EVENT,
	HomeOnboardingAnchor,
	getHomeOnboardingEntryTask,
	getHomeOnboardingStepIndex,
} from "@/pages/superMagic/components/LazyGuideTour/GuideTourManager"
import { useCanHostHomeOnboarding } from "@/pages/superMagic/components/LazyGuideTour/onboardingAvailability"
import { RECORDING_GUIDE_MOCK_RECORDING, resolveRecordingGuideStage } from "./recording-guide-mock"

/**
 * The staged view the "了解 AI 录音完成流程" tour walks over.
 *
 * The tour cannot point at the page's own controls for five of its seven steps, because entering a
 * recording, ending one and the summary it produces are states the page only reaches by really
 * recording — see `recording-guide-mock.ts` for why nothing of the sort happens here. This is what
 * the tour points at instead: a mock of the recording session and of the result page, drawn inside
 * the recordings route and published to the tour through the same anchors the real controls use.
 *
 * It is deliberately inert. The whole stage is `pointer-events-none`, and the tour's own overlay
 * sits above it, so nothing here can be clicked, dragged or typed into: everything the user may
 * actually do is in the step card, which is what the demo note underneath it says. The stage is
 * also never the product's state — no recording starts, no file is written and no summary is
 * requested — it only borrows the page's own labels so the mock reads as the product does.
 *
 * The stage is driven by the run's position rather than by a prop, because the two are separate
 * component trees: the tour is mounted by the page wrapper and reports where it is through the
 * manager's events, exactly as the AI-PPT steps are served by their own page.
 */
function RecordingGuideStageView() {
	const { t } = useTranslation(["super/guideTour", "super", "audioRecordings"])
	const [stepIndex, setStepIndex] = useState(() => getHomeOnboardingStepIndex())
	/**
	 * Whether this page is the one the run was opened for. It is read from the manager on mount as
	 * well as followed, because the entry navigates here and the page may mount either side of the
	 * tour — and it goes back to false the moment the run ends, which is what takes the stage down
	 * again without waiting for a remount.
	 */
	const [isGuideRun, setIsGuideRun] = useState(
		() => getHomeOnboardingEntryTask() === "audio-recording",
	)

	useEffect(() => {
		const sync = () => {
			setIsGuideRun(getHomeOnboardingEntryTask() === "audio-recording")
			setStepIndex(getHomeOnboardingStepIndex())
		}
		// A request opens a run (and a replay re-opens one, which starts it from its first step), a
		// step event moves it, and a state event reports it as over — the three together are
		// everything the staged view has to follow.
		window.addEventListener(HOME_ONBOARDING_REQUEST_EVENT, sync)
		window.addEventListener(HOME_ONBOARDING_STEP_EVENT, sync)
		window.addEventListener(HOME_ONBOARDING_STATE_EVENT, sync)
		return () => {
			window.removeEventListener(HOME_ONBOARDING_REQUEST_EVENT, sync)
			window.removeEventListener(HOME_ONBOARDING_STEP_EVENT, sync)
			window.removeEventListener(HOME_ONBOARDING_STATE_EVENT, sync)
		}
	}, [])

	if (!isGuideRun) return null

	const { stage, menu } = resolveRecordingGuideStage(stepIndex)
	if (stage === "none") return null

	return (
		<div
			aria-hidden="true"
			data-testid="recording-guide-demo"
			data-stage={stage}
			/*
			 * Laid inside the page's own card rather than over the whole window: the tour dims
			 * everything except the part a step points at, and the app around the recordings page —
			 * the sidebar and the shell — is not what this stage is standing in for. The backdrop is
			 * deliberately opaque: the list the stage is standing in front of is not the page these
			 * steps are talking about, and letting it show through would read as two screens at once.
			 *
			 * And below the tour's own layer: its mask is drawn as a vast spread shadow around the
			 * anchor box, so whatever sits under it is dimmed except the part the current step
			 * points at — which is the only part of this stage meant to be read closely.
			 */
			className="pointer-events-none absolute inset-0 z-10 overflow-hidden bg-muted text-foreground"
		>
			{stage === "result" ? (
				<div className="flex h-full min-h-0 flex-col px-6 py-5">
					<RecordingGuideResultHeader menu={menu} />
					<div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] gap-4">
						<RecordingGuidePanel label={t("audioRecordings:detail.tabs.transcript")}>
							<p className="whitespace-pre-line text-xs leading-6 text-muted-foreground">
								{t("homeOnboarding.audioRecording.demo.transcript")}
							</p>
						</RecordingGuidePanel>
						<RecordingGuidePanel label={t("audioRecordings:detail.tabs.summary")}>
							<p className="whitespace-pre-line text-xs leading-6 text-muted-foreground">
								{t("homeOnboarding.audioRecording.demo.summary")}
							</p>
						</RecordingGuidePanel>
					</div>
				</div>
			) : (
				<div className="flex h-full min-h-0 flex-col gap-5 px-6 py-5">
					<RecordingGuideStatusBar />
					<div className="grid min-h-0 flex-1 grid-cols-[minmax(280px,360px)_minmax(0,1fr)] gap-4">
						{/* The live transcript: the pane the fourth step frames, still empty because the
						 * staged session has only just started. */}
						<div
							data-guide-anchor={HomeOnboardingAnchor.AudioRecordingLiveTranscript}
							className="flex h-[168px] flex-col gap-3 self-start rounded-xl border border-border bg-background px-4 py-4 shadow-xs"
						>
							<div className="flex items-center gap-2 text-sm text-muted-foreground">
								<AudioLines className="size-4" aria-hidden />
								<span>{t("super:recordingSummary.ui.emptyState.description")}</span>
							</div>
							<div className="rounded-lg bg-muted px-3 py-2.5 text-xs text-muted-foreground">
								{t("super:recordingSummary.ui.emptyState.hint")}
							</div>
						</div>
						<RecordingGuidePanel label={t("super:recordingSummary.ui.editorTitle")}>
							<p className="whitespace-pre-line text-xs leading-6 text-muted-foreground">
								{t("homeOnboarding.audioRecording.demo.notes")}
							</p>
						</RecordingGuidePanel>
					</div>
					{stage === "finishing" ? <RecordingGuideFinishSheet /> : null}
				</div>
			)}
		</div>
	)
}

/** A plain content panel of the staged page, used for the transcript and the notes. */
function RecordingGuidePanel({ label, children }: { label: string; children: ReactNode }) {
	return (
		<section className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-background shadow-xs">
			<header className="shrink-0 border-b border-border px-4 py-3 text-sm font-semibold">
				{label}
			</header>
			<div className="min-h-0 flex-1 overflow-hidden px-4 py-3">{children}</div>
		</section>
	)
}

/**
 * The bar a recording session carries: what it is, how long it has been running, and the controls
 * for pausing, stopping, restarting and choosing where the sound comes from. Every label is the
 * floating panel's own, so a user who has recorded before recognises it.
 */
function RecordingGuideStatusBar() {
	const { t } = useTranslation("super")
	return (
		<div
			data-guide-anchor={HomeOnboardingAnchor.AudioRecordingStatusBar}
			className="flex shrink-0 items-center gap-3 self-center rounded-xl border border-border bg-background px-4 py-2.5 shadow-lg"
		>
			<span className="grid size-6 shrink-0 place-items-center rounded-full bg-[#6b3ff0] text-white">
				<Mic className="size-3.5" aria-hidden />
			</span>
			<span className="text-sm font-medium">{t("recordingSummary.status.recording")}</span>
			{/* A stand-in for the live waveform: the stage is a picture of a session, not one. */}
			<span className="flex h-4 items-end gap-0.5" aria-hidden>
				{[3, 7, 5, 9, 6, 4, 8, 5, 3].map((height, index) => (
					<i className="w-0.5 rounded-full bg-[#6b3ff0]" style={{ height }} key={index} />
				))}
			</span>
			<span className="font-mono text-sm tabular-nums text-muted-foreground">
				{RECORDING_GUIDE_MOCK_RECORDING.elapsed}
			</span>
			<span className="ml-1 flex items-center gap-2" aria-hidden>
				<Pause className="size-4 text-muted-foreground" />
				<span className="size-4 rounded-full bg-red-500" />
				<RotateCcw className="size-4 text-muted-foreground" />
			</span>
			<span className="ml-2 flex items-center gap-1 text-xs text-muted-foreground">
				{t("recordingSummary.audioSource.prefix")}
				<span className="text-foreground/70">：</span>
				{t("recordingSummary.audioSource.microphone.label")}
			</span>
			<span className="text-xs text-muted-foreground">
				{t("recordingSummary.audioSource.microphone.deviceDefault")}
			</span>
		</div>
	)
}

/**
 * The sheet the product opens when a recording is stopped: what will happen to what was just
 * recorded, which model will summarise it, and the three ways out. The fifth step frames it.
 */
function RecordingGuideFinishSheet() {
	const { t } = useTranslation(["super", "audioRecordings"])
	return (
		<div
			data-guide-anchor={HomeOnboardingAnchor.AudioRecordingFinishSheet}
			className="absolute bottom-6 left-1/2 w-[440px] -translate-x-1/2 overflow-hidden rounded-2xl border border-border bg-background shadow-2xl"
		>
			<div className="flex items-start justify-between gap-3 px-5 pb-3 pt-5">
				<div className="flex items-center gap-2 text-sm font-semibold">
					<span className="grid size-7 place-items-center rounded-lg bg-muted text-muted-foreground">
						<Mic className="size-4" aria-hidden />
					</span>
					{t("recordingSummary.cancelModal.finishAndSummarize")}
				</div>
				<X className="size-4 text-muted-foreground" aria-hidden />
			</div>
			<div className="px-5 pb-4">
				<p className="text-xs leading-5 text-muted-foreground">
					{t("recordingSummary.cancelModal.message")}
				</p>
				<div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
					<span>{t("recordingSummary.cancelModal.useModel")}</span>
					<span className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-foreground">
						<Sparkles className="size-3.5 text-[#6b3ff0]" aria-hidden />
						Auto
					</span>
					<span>{t("recordingSummary.cancelModal.toSummarize")}</span>
				</div>
			</div>
			<div className="flex items-center justify-between gap-3 border-t border-border bg-muted/40 px-5 py-3.5">
				<span className="text-xs font-medium text-red-500">
					{t("recordingSummary.cancelModal.noNeed")}
				</span>
				<span className="flex items-center gap-2">
					<span className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs">
						{t("audioRecordings:actions.cancel")}
					</span>
					<span className="rounded-lg bg-foreground px-3 py-1.5 text-xs font-medium text-background">
						{t("recordingSummary.cancelModal.summarize")}
					</span>
				</span>
			</div>
		</div>
	)
}

/**
 * The header of a finished recording — its name, when it was made and how long it ran — together
 * with the actions the last two steps walk: summarising it again, exporting it, sharing it, and the
 * menu of lesser actions. The two steps frame this one cluster and differ only in which of its
 * menus is open, so the menus are rendered inside the cluster rather than floating above it: the
 * tour draws its highlight around the element it is given, and a menu that hangs outside that box
 * would leave the step pointing at buttons with the menu it is talking about outside the frame.
 */
function RecordingGuideResultHeader({ menu }: { menu: "export" | "share" | null }) {
	const { t } = useTranslation(["audioRecordings", "super/guideTour"])
	const exportItems = [
		t("detail.exportAudio"),
		t("detail.exportTranscript"),
		t("detail.exportNotes"),
	]
	return (
		<div className="flex shrink-0 items-start justify-between gap-6 pb-4">
			<div className="flex min-w-0 items-center gap-3">
				<ChevronLeft className="size-5 text-muted-foreground" aria-hidden />
				<div className="min-w-0">
					<h1 className="truncate text-xl font-semibold">
						{t("super/guideTour:homeOnboarding.audioRecording.demo.recordingTitle")}
					</h1>
					<div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
						<span>{RECORDING_GUIDE_MOCK_RECORDING.finishedDate}</span>
						<span>·</span>
						<span>{RECORDING_GUIDE_MOCK_RECORDING.finishedDuration}</span>
						<span>·</span>
						<span>{t("card.sourceRecorded")}</span>
						<span className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-700">
							{t("card.summarized")}
						</span>
					</div>
				</div>
			</div>

			<div
				data-guide-anchor={HomeOnboardingAnchor.AudioRecordingHeaderActions}
				className="flex shrink-0 flex-col items-end gap-2"
			>
				<div className="flex items-center gap-2">
					<span className="inline-flex items-center gap-1.5 rounded-lg bg-foreground px-3 py-2 text-xs font-medium text-background">
						<Sparkles className="size-3.5" aria-hidden />
						{t("card.regenerateSummary")}
					</span>
					<span
						className={`inline-flex items-center gap-1.5 rounded-lg border bg-background px-3 py-2 text-xs font-medium ${menu === "export" ? "border-foreground" : "border-border"}`}
					>
						<Download className="size-3.5" aria-hidden />
						{t("detail.export")}
					</span>
					<span
						className={`inline-flex items-center gap-1.5 rounded-lg border bg-background px-3 py-2 text-xs font-medium ${menu === "share" ? "border-foreground" : "border-border"}`}
					>
						<Share2 className="size-3.5" aria-hidden />
						{t("detail.share")}
					</span>
					<span className="grid size-8 place-items-center rounded-lg border border-border bg-background text-muted-foreground">
						<Ellipsis className="size-4" aria-hidden />
					</span>
				</div>
				{menu === "export" ? (
					<div className="w-[220px] rounded-xl border border-border bg-background p-1.5 shadow-xl">
						{exportItems.map((label) => (
							<div
								className="rounded-lg px-2.5 py-2 text-xs text-muted-foreground"
								key={label}
							>
								{label}
							</div>
						))}
						<div className="flex items-center justify-between rounded-lg px-2.5 py-2 text-xs text-muted-foreground">
							<span>{t("detail.exportSummary")}</span>
							<ChevronRight className="size-3.5" aria-hidden />
						</div>
						<div className="mt-1.5 border-t border-border pt-1.5">
							<div className="rounded-lg px-2.5 py-2 text-xs text-muted-foreground">
								{t("detail.exportAll")}
							</div>
						</div>
					</div>
				) : null}
				{menu === "share" ? (
					<div className="w-[180px] rounded-xl border border-border bg-background p-1.5 shadow-xl">
						<div className="rounded-lg px-2.5 py-2 text-xs text-muted-foreground">
							{t("detail.shareCreate")}
						</div>
						<div className="rounded-lg px-2.5 py-2 text-xs text-muted-foreground">
							{t("detail.shareManage")}
						</div>
					</div>
				) : null}
			</div>
		</div>
	)
}

/**
 * The stage is part of the new-user onboarding, so it is mounted only where that feature exists —
 * see `onboardingAvailability` for the rule. On a private deployment or in a team organization the
 * tour never opens a run here, and nothing is mounted to wait for one.
 */
export default function RecordingGuideDemo() {
	if (!useCanHostHomeOnboarding()) return null

	return <RecordingGuideStageView />
}

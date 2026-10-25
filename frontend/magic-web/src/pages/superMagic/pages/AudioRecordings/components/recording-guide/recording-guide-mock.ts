/**
 * The staged recording the "了解 AI 录音完成流程" steps run on.
 *
 * Entering a recording, ending one and the summary it leaves behind are states the product only
 * reaches by really recording: a microphone permission, a real upload and a real summarisation
 * task, all of which land in the user's own account. A guided course must not do that to a user who
 * only asked to be shown around, so the recordings page stages a session instead of starting one —
 * nothing here is recorded, uploaded or written anywhere, which is what the popover's demo note
 * spells out.
 *
 * Two kinds of thing live here, and deliberately so:
 *
 * - the *shape* of the run: which staged view each step needs, and which of the result header's
 *   menus has to be open for it. That is real logic — the tour's step list and this mapping have to
 *   agree — so it is a pure function that can be checked on its own.
 * - the *facts* of the mock recording: how far the staged session has run and what the finished
 *   one reports. Only what a translator would not translate belongs here; the prose the stage
 *   shows (the mock transcript, notes and summary) is copy like any other and lives in the
 *   `super/guideTour` dictionaries under `homeOnboarding.audioRecording.demo`.
 *
 * The labels the stage borrows are the page's own keys — the status bar, the transcript empty
 * state, the finish sheet and the header's menus are all rendered from the strings the product
 * itself uses — so the stage reads as the page does rather than as a paraphrase of it.
 */

/** Which staged view a step of the run needs the page to show. */
export type RecordingGuideStage =
	/** Nothing staged: the steps point at the real creation entries of the list. */
	| "none"
	/** A recording in progress: the status bar, the live transcript and the notes. */
	| "session"
	/** The same session, with the sheet that asks what to do with it once it ends. */
	| "finishing"
	/** The summary a finished recording leaves behind, with the header's menus. */
	| "result"

/** Which of the result header's menus a step needs open. */
export type RecordingGuideMenu = "export" | "share" | null

export interface RecordingGuideStageState {
	stage: RecordingGuideStage
	menu: RecordingGuideMenu
}

/**
 * What each of the run's seven steps needs on screen, by index — the same order the tour walks
 * them. Kept as a list rather than derived from the anchors because the two are different things:
 * an anchor says *where* a step looks, this says *what the page has to be showing* for it to look
 * at anything at all.
 */
const STAGE_BY_STEP: RecordingGuideStageState[] = [
	// 1. "开始录音" — the list's own button.
	{ stage: "none", menu: null },
	// 2. "导入音频" — the list's own button.
	{ stage: "none", menu: null },
	// 3. the status bar of a recording in progress.
	{ stage: "session", menu: null },
	// 4. the live transcript beside it.
	{ stage: "session", menu: null },
	// 5. the sheet that asks what to do with the finished recording.
	{ stage: "finishing", menu: null },
	// 6. the result's header, with the export menu open.
	{ stage: "result", menu: "export" },
	// 7. the same header, with the share menu open.
	{ stage: "result", menu: "share" },
]

/** How many steps the run walks. Exported so the page and its tests share one source. */
export const RECORDING_GUIDE_STEP_COUNT = STAGE_BY_STEP.length

export function resolveRecordingGuideStage(stepIndex: number): RecordingGuideStageState {
	// A position outside the run — an index from another task's step list, or one left over from an
	// earlier run — stages nothing rather than guessing at a view.
	return STAGE_BY_STEP[stepIndex] ?? { stage: "none", menu: null }
}

/**
 * The staged recording itself. A session that has just started: the timeline has not moved yet and
 * nothing has been said, which is why the transcript is still showing its own empty state and the
 * notes are still the mock author's own jottings.
 */
export const RECORDING_GUIDE_MOCK_RECORDING = {
	/** Elapsed time on the status bar. */
	elapsed: "00:00:00",
	/** What the finished recording reports, once the summary exists. */
	finishedDuration: "00:00:42",
	/** The day the finished recording was made, as the page's own header formats it. */
	finishedDate: "2026-09-28",
} as const

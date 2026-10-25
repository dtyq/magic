/*
 * Only the dependency-free half of the onboarding contract is imported statically. Components all
 * over the app — and most of the guide's own tests — import this module for an anchor string or a
 * predicate, so anything reachable from here lands in *their* module graph too; pulling the HTTP
 * client in that way cost about a minute of collection time on each of them. The two calls that
 * actually go to the network are loaded where they are used, below.
 */
import {
	isOnboardingRetryableCode,
	isOnboardingUnsupportedCode,
	ONBOARDING_RESPONSE_CODE,
	readOnboardingErrorCode,
	readOnboardingErrorMessage,
} from "@/apis/modules/onboarding-codes"
import type { OnboardingParticipantType } from "@/apis/modules/onboarding"
import {
	HOME_ONBOARDING_TASK_CODE,
	toHomeOnboardingReward,
	type HomeOnboardingReward,
} from "./onboardingTaskCodes"

export {
	canManuallyCompleteHomeOnboardingTask,
	getHomeOnboardingTaskIdByCode,
	HOME_ONBOARDING_TASK_CODE,
} from "./onboardingTaskCodes"
export type { HomeOnboardingReward } from "./onboardingTaskCodes"

export const HomeOnboardingAnchor = {
	WorkspaceSidebar: "workspace-sidebar",
	WorkspaceList: "sidebar-workspace-list",
	RoleSwitcher: "role-switcher",
	MessageComposer: "message-composer",
	/**
	 * The two entries at the top of the navigation — the task entry and the chat entry. They are
	 * rendered as one block, above the capability list and outside the area the list scrolls in,
	 * which is why the sidebar step needs this anchor at all: see `OnboardingStep.extraAnchors`.
	 */
	SidebarHomeActions: "sidebar-home-actions",
	/** The "了解超级龙虾如何使用" steps live on the MagiClaw page, which is a route of its own. */
	MagiClawHero: "magi-claw-hero",
	MagiClawCreatedSection: "magi-claw-created-section",
	MagiClawFeatures: "magi-claw-features",
	/**
	 * The "了解如何雇佣使用数字员工" steps live on the crew market page, another route of its own.
	 * `CrewMarketCardDetails` carries both the third and the fifth step: they highlight the very
	 * same control — a card's secondary action, which reads "详情" until the employee is hired and
	 * "对话" afterwards — and only the wording of the step differs.
	 */
	CrewMarketSearch: "crew-market-search",
	CrewMarketCategories: "crew-market-categories",
	CrewMarketCardDetails: "crew-market-card-details",
	CrewMarketCardHire: "crew-market-card-hire",
	/**
	 * The "了解如何添加/管理技能" steps. Unlike the other tours they do not stay on one page: the run
	 * starts in the skill library, hands over to "My Skills" for the two steps about its tabs, and
	 * comes back for the last one. Every step therefore names the page it belongs to.
	 */
	SkillMarketSearch: "skill-market-search",
	SkillMarketCard: "skill-market-card",
	SkillMarketCardAdd: "skill-market-card-add",
	SkillMarketMySkills: "skill-market-my-skills",
	SkillMarketCreate: "skill-market-create",
	MySkillsCreatedTab: "my-skills-created-tab",
	MySkillsLibraryTab: "my-skills-library-tab",
	/**
	 * The "了解微应用创建流程" steps. They stay on the app-space page: the first two highlight the
	 * creation prompt — its text area and then its bottom toolbar — and the last one the whole
	 * "应用空间" section that fills the lower half of the page.
	 *
	 * The text area is the composer's own anchor, shared with every other editor; the app-space
	 * page mounts a single composer, so it resolves to that one. The toolbar is its own anchor,
	 * right below it. The library is a region rather than a control, so it is anchored on the
	 * section that carries its heading, its search box and the create button — not on one of the
	 * widgets inside it, which the page's own layout moves around.
	 */
	MessageEditorContent: "message-editor-content",
	MessageEditorToolbar: "message-editor-toolbar",
	MicroAppsLibrary: "micro-apps-library",
	/**
	 * The "了解如何使用 AI PPT" steps. Their anchors are on the slides-template page, which is a route
	 * of its own: the benefits card is the only entry, and it navigates there before asking for the
	 * run.
	 *
	 * The first and the third step point at a template card carrying the "精选" badge. Which card
	 * that is is decided at run time — the page is an endless wall of templates that slides on its
	 * own, so the canvas centres a featured one, keeps it there while the step is up, and only then
	 * publishes this anchor on a marker drawn over it. The card itself is data: an account whose
	 * library carries no featured templates has none, which is why both steps may be stepped over.
	 * The second step points at the search box, the "发现灵感" button and the category tabs, which
	 * share one toolbar band, and the last one at the panel underneath it — the template the guide
	 * picked, together with the editor where the request is described.
	 */
	SlidesTemplateFeaturedCard: "slides-template-featured-card",
	SlidesTemplatesToolbar: "slides-templates-toolbar",
	SlidesTemplatesPrompt: "slides-templates-prompt",
	/**
	 * The "了解 AI 录音完成流程" steps. Their anchors are on the recordings page, which is a route of
	 * its own: the benefits card is the only entry, and it navigates there before asking for the run.
	 *
	 * The first two steps point at the two real creation entries of the list — the recording button
	 * and the import button. The five that follow cannot point at the page's own controls: entering
	 * a recording, ending one and the result it produces are states the product only reaches by
	 * actually recording, which a demo must not do. The page therefore stages a mock session for
	 * them — see `RecordingGuideDemo` — and publishes these anchors over the parts of that stage a
	 * step highlights. The same anchor carries both of the last two steps, which only differ in
	 * which of the header's menus is open.
	 */
	AudioRecordingsStart: "audio-recordings-start",
	AudioRecordingsImport: "audio-recordings-import",
	AudioRecordingStatusBar: "audio-recording-status-bar",
	AudioRecordingLiveTranscript: "audio-recording-live-transcript",
	AudioRecordingFinishSheet: "audio-recording-finish-sheet",
	AudioRecordingHeaderActions: "audio-recording-header-actions",
	/**
	 * The two steps a user gets the first time they open a file a task produced. They belong to no
	 * task's flow: no task is finished by looking at a result, and what offers this tour is the
	 * account still being a new one, not a row being unfinished. See `startHomeOnboardingDeliverableRunIfDue`.
	 *
	 * `DeliverableAttachment` is the attachment block of the message that delivered the file — the
	 * one that was clicked, because it is the click that opens the tour. The second step is not
	 * named here at all: it points at the project files area, which is where the result was filed —
	 * see `ProjectSider`.
	 */
	DeliverableAttachment: "deliverable-attachment",
	/**
	 * The project files area of the project page: the sidebar that holds the files tab and the tree
	 * under it. Two steps point at it — the in-project tour's first ("项目文件，一目了然") and the
	 * second of the tour a delivered file opens, which says where the result was filed.
	 *
	 * It is the region rather than anything inside it because the region is the one thing the page
	 * always has: a file's own row is published only while that file is the open one, and an entry
	 * behind a tab is only reachable once the user is on that tab. The page renders this sidebar
	 * whatever the account's state, which is what makes a step pointing at it a step that always
	 * has something to frame.
	 */
	ProjectSider: "project-sider",
} as const

export const HOME_ONBOARDING_REQUEST_EVENT = "magic-home-onboarding-request"

/**
 * Broadcast whenever a status changes, so the surfaces that mirror it (the benefits rows and their
 * counters) refresh in place instead of waiting for a remount. Deliberately separate from
 * `HOME_ONBOARDING_REQUEST_EVENT`: that one re-mounts the tour to make it visible again, which must
 * not happen while the tour is merely reporting an outcome.
 */
export const HOME_ONBOARDING_STATE_EVENT = "magic-home-onboarding-state"

/**
 * Announced every time a run moves on to another highlighted step, carrying that step's index. A
 * page cannot work out from the step list what a step needs of it — the list lives in the tour —
 * and two kinds of step do need the page: the AI-PPT tour shows a template card the canvas only
 * puts in a frameable spot once it has centred it, and its last step shows the selection such a
 * card brings with it. The page follows this and prepares what its step highlights.
 *
 * Deliberately separate from the other two events: the request event re-mounts the tour, the state
 * event refreshes the surfaces that mirror outcomes, and this one tells the hosting page where the
 * run is. The position is only ever announced, never read back — a page that mounts late reads the
 * index itself.
 */
export const HOME_ONBOARDING_STEP_EVENT = "magic-home-onboarding-step"

/**
 * Announced every time the run moves on to a step that frames a different region, carrying the
 * anchor it now frames — or `null` while it is framing nothing on this page.
 *
 * A page cannot work out from the step list what a step needs of it — the list lives in the tour —
 * and one kind of step does need the page: the project files area is a panel the user may collapse,
 * and collapsed it answers with a zero-width box at the left edge. Both steps that point at it (the
 * in-project tour's first and the second of the tour a delivered file opens) would then draw their
 * highlight around a sliver instead of the file tree, and the copy beside it would be talking about
 * something the user cannot see. The tour cannot open the panel itself: the collapse state belongs
 * to the page's layout, which keeps one instance per mount, so the step announces the region it is
 * about to frame and the page opens it.
 *
 * The anchor rather than the step's position, because those two steps live in different flows and a
 * flow numbers its steps from its own start; what the page has to act on is which region is being
 * framed, and no page but the one that renders it reads this. Deliberately separate from the step
 * event above: that one carries a position in the home steps for the surfaces that stage them,
 * while this one names a region. Read on mount as well as followed — the page and the tour mount in
 * whichever order the entry's navigation happens to take.
 */
export const HOME_ONBOARDING_ANCHOR_EVENT = "magic-home-onboarding-anchor"

/**
 * Announced by the page hosting a run once it is finished preparing the step it was asked for,
 * carrying that step's index. Some steps do not point at something that is simply there: the AI-PPT
 * steps frame a template card, and the card cannot be framed until the page has the library, has
 * picked one and has finished moving the canvas to it. The tour cannot tell a page that is still
 * working from a page that has nothing to show — both look like a missing anchor — so the verdict
 * belongs to the page. A page that will never be able to show a step announces it all the same,
 * which is what lets an optional step be walked past for a real reason instead of a slow one.
 *
 * Deliberately separate from the step announcement: that one goes out as the tour moves and is read
 * by whatever needs to react, while this one answers it and marks the step as settled.
 */
export const HOME_ONBOARDING_STEP_READY_EVENT = "magic-home-onboarding-step-ready"

/**
 * Announced when a run takes the screen and again when it gives the screen back.
 *
 * The other four events all describe what a run is doing; this one is about whether it is there at
 * all. The surface that needs it is the benefits entry card, which is the way into every one of
 * these runs and is also the thing standing in the way once one is up: the introduction dialog
 * opens over it on a first visit, and every step overlay covers it while the user is being walked
 * through the page. None of that routes through the card — the dialog belongs to an automatic run
 * the card never asked for — so the card cannot derive it, only be told.
 *
 * Deliberately separate from the request event: that one re-mounts the tour (and is therefore only
 * ever sent when someone asks for a run), while this one follows the run's own lifetime, from the
 * frame its first surface paints to the frame it closes — however it closes.
 */
export const HOME_ONBOARDING_RUN_EVENT = "magic-home-onboarding-run"

/**
 * The steps of the AI-PPT run that the page has to act on, as indices into the order the tour walks
 * them: the two that point at a featured template card, and the one that highlights the selection
 * such a card brings with it. They live here, beside the task they belong to, so the tour's step
 * list and the page's reaction to it cannot drift apart.
 */
export const HOME_ONBOARDING_AI_PPT_TEMPLATE_STEP_INDEXES = [0, 2]
export const HOME_ONBOARDING_AI_PPT_SELECTION_STEP_INDEX = 3

/**
 * `pending`: never finished (first visit or left before finishing); `aborted`: explicitly left
 * mid-way; `completed`: the whole flow was walked through. `pending` and `aborted` behave the same
 * for the product (auto open on load, "开始" entry); the distinction exists for inspection.
 */
export type HomeOnboardingStatus = "pending" | "aborted" | "completed"

/**
 * The benefit tasks that own a guided flow. They are entered separately — the automatic run opens
 * `first-ai-work`, and the benefits card is the only way into any of them:
 *
 * - `workbench` — "了解超级麦吉工作台": the four highlighted home steps (sidebar, workspace list,
 *   role switcher, composer). Walking them through finishes it, and a finished one can be re-watched.
 * - `first-ai-work` — "完成第一次AI工作": the introduction dialog on a first visit, then the
 *   featured-case picker, the prefilled prompt and the in-project tour.
 * - `super-lobster` — "了解超级龙虾如何使用": the three highlighted steps of the MagiClaw page
 *   (hero, create card, capability list). It is a demo tour: nothing is created.
 * - `hire-employee` — "了解如何雇佣使用数字员工": the five highlighted steps of the crew market page
 *   (search, category tabs, card details, hire, conversation). It is a demo tour as well: no
 *   employee is hired and no conversation is opened.
 * - `manage-skill` — "了解如何添加/管理技能": the seven highlighted steps that walk the skill
 *   library (search, card, add, my-skills) and continue on "My Skills" (its two tabs) before coming
 *   back for the create entry. Also a demo: nothing is added, imported or created.
 * - `create-micro-app` — "了解微应用创建流程": the three highlighted steps of the app-space page
 *   (the creation prompt, its toolbar, the library's scope tabs). A demo as well: no app is really
 *   created.
 * - `create-ai-ppt` — "了解如何使用 AI PPT": the four highlighted steps of the slides-template page
 *   (a featured template card, the search and category band, another featured card, and the
 *   selection plus the request editor). A demo as well: no slide is really produced.
 * - `audio-recording` — "了解 AI 录音完成流程": the seven highlighted steps of the recordings page
 *   (start and import, then the recording session, ending it and the summary it produces, and
 *   finally exporting and sharing the result). A demo as well: no recording is really made and the
 *   session the later steps point at is staged by the page instead of by a microphone.
 */
export type HomeOnboardingTaskId =
	| "workbench"
	| "first-ai-work"
	| "super-lobster"
	| "hire-employee"
	| "manage-skill"
	| "create-micro-app"
	| "create-ai-ppt"
	| "audio-recording"

/**
 * Which page a task's steps are highlighted on. The home tasks share the home page's layout, while
 * the others belong to standalone routes, not workspace states. Only a page that carries a task's
 * anchors may serve a run for that task, and its entry has to navigate to the first of them.
 */
export type HomeOnboardingTaskPage =
	| "home"
	| "magi-claw"
	| "crew-market"
	| "skill-market"
	| "my-skills"
	| "micro-apps"
	| "slides-templates"
	| "recordings"

/**
 * Every page a task's steps live on, in the order the run walks them. A task normally lives on one
 * page, so the list has a single entry; `manage-skill` is the exception — it starts in the skill
 * library, hands over to "My Skills" for two steps and comes back — and its run does the moving
 * itself.
 */
export const HOME_ONBOARDING_TASK_PAGES: Record<HomeOnboardingTaskId, HomeOnboardingTaskPage[]> = {
	workbench: ["home"],
	"first-ai-work": ["home"],
	"super-lobster": ["magi-claw"],
	"hire-employee": ["crew-market"],
	"manage-skill": ["skill-market", "my-skills"],
	"create-micro-app": ["micro-apps"],
	"create-ai-ppt": ["slides-templates"],
	"audio-recording": ["recordings"],
}

/**
 * The page a task opens on: the first one its steps live on, and therefore the page an entry from
 * the benefits card has to navigate to before asking for the run. Derived from the lists above, so
 * there is only one place to keep a task's pages right.
 */
export function getHomeOnboardingTaskEntryPage(task: HomeOnboardingTaskId): HomeOnboardingTaskPage {
	return HOME_ONBOARDING_TASK_PAGES[task][0]
}

export function isHomeOnboardingTaskOnPage(
	task: HomeOnboardingTaskId | null,
	page: HomeOnboardingTaskPage,
) {
	return Boolean(task) && HOME_ONBOARDING_TASK_PAGES[task as HomeOnboardingTaskId].includes(page)
}

/**
 * The tasks whose steps live on the home page, so they are what the automatic run can offer. The
 * tasks of the other routes stay out of it: their anchors are elsewhere, so a page load cannot start
 * them — the benefits card is the only entry.
 */
export const HOME_ONBOARDING_TASK_IDS: HomeOnboardingTaskId[] = ["workbench", "first-ai-work"]

/**
 * The tasks a finished row can open again. Walking them produces nothing — they only point at parts
 * of the product — so a second pass is a review of an already-finished task rather than a repeat of
 * the job, and the last step says so instead of promising the reward again.
 *
 * That covers every task but `first-ai-work`, which is left out because walking it *does* produce
 * something: a template is picked, a prompt is sent and a project comes out, so a second pass would
 * be another piece of work rather than a look back at this one. It is also the only task the client
 * may not finish, which makes the review a claim about a flow this side cannot close.
 */
export const HOME_ONBOARDING_REPLAYABLE_TASK_IDS: HomeOnboardingTaskId[] = [
	"workbench",
	"super-lobster",
	"hire-employee",
	"manage-skill",
	"create-micro-app",
	"create-ai-ppt",
	"audio-recording",
]

export function isReplayableHomeOnboardingTask(task: HomeOnboardingTaskId) {
	return HOME_ONBOARDING_REPLAYABLE_TASK_IDS.includes(task)
}

export type HomeOnboardingFlow =
	| "featured-case"
	| "prompt-ready"
	| "task-processing"
	| "project-result"
	| "project-file"
	| "project-orientation"

/**
 * Home onboarding runtime state — deliberately memory-only, never persisted.
 *
 * The completion statuses stand in for the account's real progress, which will be read from the
 * backend API. Until that call is wired up, a page load starts from a clean slate: refreshing
 * resets every task, so the flows are offered again on every init.
 *
 * The in-flight step (`flow`) and the sidebar top mode live here for the same reason. Persisting
 * them would resume the tour mid-way after a reload, at a step whose anchors are not on screen, and
 * the missing target would end the run before it could show its welcome step.
 */
const onboardingStatusByUser = new Map<string, HomeOnboardingStatus>()
let onboardingFlow: HomeOnboardingFlow | null = null
let onboardingSidebarTopMode = false
/**
 * Which highlighted step the run is on. It lives here rather than inside the tour because a run may
 * span more than one route — the skill tour hands over from the skill library to "My Skills" and
 * comes back — and each of those pages hosts its own tour instance, so component state would be
 * lost on the way. Memory-only like the rest: a reload starts the task from its first step again.
 */
let onboardingStepIndex = 0
/**
 * The region the run is framing, kept beside the position it is framing it from and for the same
 * reason: the page that has to act on it may mount after the run has already moved. Memory-only
 * like the rest — a reload starts the task from its first step, where nothing has been framed yet.
 */
let onboardingAnchor: string | null = null
/**
 * Which step the hosting page has finished preparing, if any. Kept beside the position it answers
 * for the same reason: the page and the tour are two components that may mount in either order, and
 * which step is ready has to outlive the one that answered.
 */
let onboardingPreparedStepIndex: number | null = null
/**
 * Which task the coming run should open. A one-shot request written by a benefits-card entry and
 * read once by the tour on mount — it cannot be derived from `flow`, because a workbench run opens
 * on its first highlighted step and has no step of its own. Cleared when that run closes.
 */
let onboardingEntryTask: HomeOnboardingTaskId | null = null
/**
 * Whether a run holds the screen right now. Written by the tour alone — it is the only thing that
 * knows what a run is showing, and what it is showing is a whole-page overlay either way: the
 * introduction dialog of a first visit, an overlay holding the user while a step's anchor is being
 * prepared, or the step card itself. Read by the surfaces that stand aside for it.
 *
 * Memory-only like the rest of the runtime state, and for a stronger reason: a reload re-mounts a
 * tour, which announces its own state on the way in.
 */
let onboardingRunActive = false
/**
 * Whether the lazy tour has already been selected but has not mounted yet. Its loading fallback
 * owns this reservation so surfaces that yield to the tour cannot flash — or spend an exposure —
 * in the gap between deciding to show the tour and downloading its component.
 */
let onboardingRunPending = false

/** Analytics follows a run across route remounts; completion status must not change replay mid-run. */
interface OnboardingAnalyticsRun {
	id: number
	task: HomeOnboardingTaskId
	isReplay: boolean
	exposedSteps: Set<string>
}
let analyticsScope = ""
let analyticsRunId = 0
let analyticsRun: OnboardingAnalyticsRun | null = null
let floatingCardExposed = false
let welcomeExposed = false

export function setHomeOnboardingAnalyticsScope(userMagicId?: string, organizationCode?: string) {
	const scope = `${userMagicId ?? ""}:${organizationCode ?? ""}`
	if (scope === analyticsScope) return
	analyticsScope = scope
	analyticsRun = null
	floatingCardExposed = false
	welcomeExposed = false
}

export function beginHomeOnboardingAnalyticsRun(task: HomeOnboardingTaskId, isReplay: boolean) {
	analyticsRun = { id: ++analyticsRunId, task, isReplay, exposedSteps: new Set() }
	return analyticsRun.id
}

export function getHomeOnboardingAnalyticsRun() {
	return analyticsRun
}

export function endHomeOnboardingAnalyticsRun() {
	analyticsRun = null
}

export function consumeHomeOnboardingStepExposure(runId: number, stepId: string) {
	if (!analyticsRun || analyticsRun.id !== runId || analyticsRun.exposedSteps.has(stepId))
		return false
	analyticsRun.exposedSteps.add(stepId)
	return true
}

export function consumeHomeOnboardingSurfaceExposure(surface: "floating_card" | "welcome") {
	if (surface === "floating_card") {
		if (floatingCardExposed) return false
		floatingCardExposed = true
		return true
	}
	if (welcomeExposed) return false
	welcomeExposed = true
	return true
}
/**
 * The account the guide belongs to, as the surface that hosts it sees it.
 *
 * Read by the entries that live too far from an account of their own to grow one: a click on a
 * file a task delivered happens inside the message list, and reaching for the user store there
 * would drag mobx and the whole admin component tree into the module graph of every message row
 * — see the note at the top of this file. The wrapper that already reads the account (`GuideTourGate`)
 * publishes it here instead, and those entries read it back.
 *
 * Not part of the runtime state above, and cleared on the way out, because a signed-out or
 * unhosted client must not keep answering as the account it last held.
 */
let currentUserMagicId: string | undefined

/** Progress is tracked per account; a signed-out visitor still gets one slot under "unknown". */
const getUserKey = (userMagicId?: string) => userMagicId || "unknown"

/**
 * Where an account's copy of the one-shot introduction flag lives.
 *
 * The introduction dialog opens the AI-work task on a first visit, and it is offered **once per
 * account** — not once per page load. Someone who declined it, or who left the run it opened, must
 * not be asked again by the next load; from there both tasks are entered on their own from the
 * benefits card. So this flag, alone among the runtime state here, is storage rather than a
 * variable: everything else describes a run in progress, which a reload is meant to reset.
 *
 * Scoped per account, because the answer belongs to the account that was shown the dialog rather
 * than to the browser: the next account to sign in on this machine still has it coming.
 */
const INTRO_SPENT_STORAGE_PREFIX = "magiHomeOnboardingIntroSpent:"

const getIntroSpentStorageKey = (userMagicId?: string) =>
	`${INTRO_SPENT_STORAGE_PREFIX}${getUserKey(userMagicId)}`

/** A status is scoped to an account *and* a task: the two flows finish independently. */
const getStatusKey = (userMagicId: string | undefined, task: HomeOnboardingTaskId) =>
	`${getUserKey(userMagicId)}:${task}`

export function getHomeOnboardingFlow() {
	return onboardingFlow
}

export function setHomeOnboardingFlow(flow: HomeOnboardingFlow | null) {
	onboardingFlow = flow
}

export function setHomeOnboardingSidebarTopMode(enabled: boolean) {
	onboardingSidebarTopMode = enabled
}

export function isHomeOnboardingSidebarTopMode() {
	return onboardingSidebarTopMode
}

/** Which highlighted step the run is on. Read on mount, written as the run moves along. */
export function getHomeOnboardingStepIndex() {
	return onboardingStepIndex
}

/**
 * Moving the run to another step, and telling the page hosting it. Only the tour ever writes the
 * position, so announcing it here is enough for a page to follow along without polling; resetting
 * stays silent, because a one-shot entry writes its own first step and the page reads that itself.
 */
export function setHomeOnboardingStepIndex(index: number) {
	onboardingStepIndex = index
	// A step nobody has prepared yet. Moving on forgets the last verdict, so the page has to give
	// one for the step it is now on rather than the tour reading a stale one as its own.
	onboardingPreparedStepIndex = null
	if (typeof window !== "undefined") {
		window.dispatchEvent(new CustomEvent<number>(HOME_ONBOARDING_STEP_EVENT, { detail: index }))
	}
}

/** A run starts at its own first step, never where an earlier one happened to stop. */
export function resetHomeOnboardingStepIndex() {
	onboardingStepIndex = 0
	onboardingPreparedStepIndex = null
}

/**
 * The region the run is framing right now, if any. Read on mount as well as followed through the
 * event above, because the page that renders it and the tour that frames it are two components
 * that may mount in either order.
 */
export function getHomeOnboardingAnchor() {
	return onboardingAnchor
}

/**
 * Moving the run's frame to another region, and telling the page that renders it. Only the tour
 * ever writes this — it is the only thing that knows which step is up — and the guard below is
 * what keeps a region the run is staying on from being announced again on every render: the page
 * acts on the announcement, so a repeat would reopen a panel the user had just closed.
 */
export function setHomeOnboardingAnchor(anchor: string | null) {
	if (anchor === onboardingAnchor) return
	onboardingAnchor = anchor
	if (typeof window !== "undefined") {
		window.dispatchEvent(
			new CustomEvent<string | null>(HOME_ONBOARDING_ANCHOR_EVENT, { detail: anchor }),
		)
	}
}

/**
 * Whether the hosting page has finished preparing a step. Read by a tour that mounts after the page
 * has already answered — an entry navigates to the page, and neither order of the two mounts is
 * guaranteed — as well as by one waiting on the answer.
 */
export function getHomeOnboardingPreparedStepIndex() {
	return onboardingPreparedStepIndex
}

/** The page is done with a step, whether that turned up something to frame or nothing at all. */
export function announceHomeOnboardingStepPrepared(index: number) {
	onboardingPreparedStepIndex = index
	if (typeof window !== "undefined") {
		window.dispatchEvent(
			new CustomEvent<number>(HOME_ONBOARDING_STEP_READY_EVENT, { detail: index }),
		)
	}
}

/** Which task a benefits-card entry asked for. Read once per run, then cleared. */
export function getHomeOnboardingEntryTask() {
	return onboardingEntryTask
}

/**
 * The requested run is over, so the next automatic one derives its entry point again. Announced as
 * a state change as well, because a page that stages what a run's steps point at — the recordings
 * page does, for the session and the result its later steps frame — has to take its staging down
 * when the run closes. Nothing else about the task's outcome is known yet at this point: the tour
 * reports that separately, and a run that ended early leaves the task exactly as it found it.
 */
export function clearHomeOnboardingEntryTask() {
	onboardingEntryTask = null
	if (typeof window !== "undefined") {
		window.dispatchEvent(new Event(HOME_ONBOARDING_STATE_EVENT))
	}
}

/**
 * Whether a guided run is up, and therefore whether the surfaces that stand aside for it should
 * still be standing aside. Read on mount as well as followed, because the card and the tour mount
 * in whichever order the page happens to take and a run may already be under way by the time the
 * card appears.
 */
export function isHomeOnboardingRunActive() {
	return onboardingRunActive
}

/** The screen is unavailable to sibling onboarding surfaces while a run is loading or active. */
export function isHomeOnboardingRunBlocking() {
	return onboardingRunPending || onboardingRunActive
}

/** Subscribe to the shared loading/active verdict without missing a change during React commit. */
export function subscribeHomeOnboardingRun(listener: () => void) {
	if (typeof window === "undefined") return () => undefined
	window.addEventListener(HOME_ONBOARDING_RUN_EVENT, listener)
	return () => window.removeEventListener(HOME_ONBOARDING_RUN_EVENT, listener)
}

/**
 * Reserve the screen for the lazy tour. The Suspense fallback releases this immediately before the
 * real tour mounts; the real tour then publishes its active verdict in the same commit.
 */
export function setHomeOnboardingRunPending(pending: boolean) {
	if (onboardingRunPending === pending) return
	onboardingRunPending = pending
	if (typeof window !== "undefined") {
		window.dispatchEvent(new Event(HOME_ONBOARDING_RUN_EVENT))
	}
}

/**
 * The tour's verdict on whether it currently holds the screen. Only ever called by the tour, and
 * only ever with what it is showing at that moment: a run that is mounted but painting nothing — a
 * dismissed tour, a mount nobody asked for, a run whose step belongs to another page — is not
 * holding anything, and the card belongs back on screen.
 *
 * Silent when nothing changes, so a re-render cannot make the listeners re-render with it.
 */
export function setHomeOnboardingRunActive(active: boolean) {
	if (onboardingRunActive === active) return
	onboardingRunActive = active
	if (typeof window !== "undefined") {
		window.dispatchEvent(new Event(HOME_ONBOARDING_RUN_EVENT))
	}
}

/**
 * Publishing the account for the entries that have none of their own, and reading it back. See
 * `currentUserMagicId`. Written by the wrapper on every account change and cleared when it goes
 * away, so an entry that fires after the guide has left the page cannot answer for the account
 * that was signed in before.
 */
export function setHomeOnboardingUserMagicId(userMagicId?: string) {
	currentUserMagicId = userMagicId
}

export function getHomeOnboardingUserMagicId() {
	return currentUserMagicId
}

/**
 * Whether the introduction dialog is still on offer for this account — the answer survives a reload,
 * which is the whole point of keeping it in storage, so it is read on every load rather than
 * remembered here. Read by the automatic run's gate as well as by the tour itself.
 */
export function isHomeOnboardingIntroSpent(userMagicId?: string) {
	try {
		return window.localStorage.getItem(getIntroSpentStorageKey(userMagicId)) === "1"
	} catch {
		// Storage can refuse to be read at all — Safari in private mode does. Nothing is remembered
		// then, so the dialog falls back to being offered once per load, which is what the feature
		// did before it remembered anything.
		return false
	}
}

/**
 * The introduction is behind us: its dialog was put in front of the user — answered, declined or
 * closed — or a benefits-card entry took over. Both tasks are entered one at a time from here on.
 *
 * Written the moment the dialog appears rather than when it is answered, because being shown it is
 * the thing that must not happen twice: someone who reloads with it still up on screen has been
 * shown it just as much as someone who clicked it away, and coming back must not re-open it.
 */
export function spendHomeOnboardingIntro(userMagicId?: string) {
	try {
		window.localStorage.setItem(getIntroSpentStorageKey(userMagicId), "1")
	} catch {
		// An unwritable store cannot remember the answer; the dialog simply comes back next load.
	}
}

/**
 * Where an account's copy of the one-shot "task deliverable" flag lives.
 *
 * The tour that frames a task's result — the file itself, and the copy the project files panel
 * keeps — is opened by the first click on one of those files, and it is offered **once per account
 * per browser**. The two halves of that are deliberate and come from the two halves of the key:
 * the account is in it, so the answer belongs to whoever was shown the tour rather than to the
 * machine; and it is kept in storage rather than beside the rest of the runtime state, which is
 * memory-only, so the same account does not sit through it again on the next page load.
 *
 * Being per browser is the point of keeping it here rather than on the backend, next to the task
 * progress: a first look at a delivered file is a moment in *this* window, and an account that
 * opens its next result on another machine is having that moment for the first time too.
 */
const DELIVERABLE_SPENT_STORAGE_PREFIX = "magiHomeOnboardingDeliverableSpent:"

const getDeliverableSpentStorageKey = (userMagicId?: string) =>
	`${DELIVERABLE_SPENT_STORAGE_PREFIX}${getUserKey(userMagicId)}`

/** Whether this browser has already shown this account the tour of a delivered file. */
export function isHomeOnboardingDeliverableSpent(userMagicId?: string) {
	try {
		return window.localStorage.getItem(getDeliverableSpentStorageKey(userMagicId)) === "1"
	} catch {
		// Storage can refuse to be read at all — Safari in private mode does. Nothing is
		// remembered then, so the tour falls back to being offered once per load.
		return false
	}
}

/** The tour of a delivered file is behind us: offered, walked or closed. */
export function spendHomeOnboardingDeliverableIntro(userMagicId?: string) {
	try {
		window.localStorage.setItem(getDeliverableSpentStorageKey(userMagicId), "1")
	} catch {
		// An unwritable store cannot remember the answer; the tour simply comes back next load.
	}
}

/**
 * Where an account's copy of the one-shot "first AI work is done" flag lives.
 *
 * The congratulation is offered the first time a topic finishes while the account is on the project
 * page, and — like the delivered-file tour beside it — it is offered **once per account per
 * browser**, which comes from the two halves of the key. The account is in it because the
 * congratulations belong to whoever earned them; storage rather than the runtime state beside it,
 * because "the first time" is a moment in a window rather than a property of the account, and the
 * same account finishing its next task on another machine is having that moment for the first time
 * there too.
 *
 * Being per browser is also why this is not the backend's task list: the list says whether the
 * account still counts as new, which is the *other* half of the trigger's precondition, and it is
 * asked separately in `hasHomeOnboardingTasks`.
 */
const FIRST_WORK_CONGRATS_SPENT_STORAGE_PREFIX = "magiHomeOnboardingFirstWorkCongratsSpent:"

const getFirstWorkCongratsSpentStorageKey = (userMagicId?: string) =>
	`${FIRST_WORK_CONGRATS_SPENT_STORAGE_PREFIX}${getUserKey(userMagicId)}`

/** Whether this browser has already congratulated this account on its first AI work. */
export function isHomeOnboardingFirstWorkCongratsSpent(userMagicId?: string) {
	try {
		return window.localStorage.getItem(getFirstWorkCongratsSpentStorageKey(userMagicId)) === "1"
	} catch {
		// Storage can refuse to be read at all — Safari in private mode does. Nothing is remembered
		// then, so the congratulation falls back to being offered once per load.
		return false
	}
}

/** The congratulation is behind us: shown — and closed, either way it can be left. */
export function spendHomeOnboardingFirstWorkCongrats(userMagicId?: string) {
	try {
		window.localStorage.setItem(getFirstWorkCongratsSpentStorageKey(userMagicId), "1")
	} catch {
		// An unwritable store cannot remember the answer; the congratulation comes back next load.
	}
}

export function getHomeOnboardingStatus(
	userMagicId: string | undefined,
	task: HomeOnboardingTaskId,
): HomeOnboardingStatus {
	return onboardingStatusByUser.get(getStatusKey(userMagicId, task)) ?? "pending"
}

export function isHomeOnboardingCompleted(
	userMagicId: string | undefined,
	task: HomeOnboardingTaskId,
) {
	return getHomeOnboardingStatus(userMagicId, task) === "completed"
}

function setHomeOnboardingStatus(
	status: HomeOnboardingStatus,
	userMagicId: string | undefined,
	task: HomeOnboardingTaskId,
) {
	onboardingStatusByUser.set(getStatusKey(userMagicId, task), status)
	if (typeof window !== "undefined") {
		window.dispatchEvent(new Event(HOME_ONBOARDING_STATE_EVENT))
	}
}

/**
 * Open a task's guided flow from the benefits card — the "开始体验" entry of an unfinished task as
 * well as the "回看" entry of a finished task that supports re-watching.
 *
 * Deliberately leaves the recorded status alone: re-watching a finished task must not claim it back
 * as unfinished, and the tour writes the real outcome itself when the run closes.
 *
 * The entry names the task, so a page whose anchors that task does not use simply ignores it. A task
 * living on another route (`super-lobster`, `hire-employee`, `create-micro-app`, `create-ai-ppt`,
 * `audio-recording`) therefore has to be navigated to by the caller before or right after this call
 * — the tour mounts on the page that owns the anchors, not on the caller's.
 *
 * The account is named because opening a task from the card spends the introduction for it, and that
 * answer is remembered per account.
 */
export const startHomeOnboarding = (
	task: HomeOnboardingTaskId = "workbench",
	userMagicId?: string,
	isReplay = false,
) => {
	beginHomeOnboardingAnalyticsRun(task, isReplay)
	onboardingEntryTask = task
	// A card entry opens its own task on its own first step, so the introduction is behind us by
	// definition — a later mount must not fall back to its dialog.
	spendHomeOnboardingIntro(userMagicId)
	// A task carried by highlighted steps has no step of its own: it opens on its first one. The
	// AI-work entry opens on the featured-case picker. Either way the stored flow is dropped, so a
	// run always starts from its own first step instead of resuming the other task's.
	setHomeOnboardingFlow(task === "first-ai-work" ? "featured-case" : null)
	setHomeOnboardingSidebarTopMode(false)
	resetHomeOnboardingStepIndex()
	if (typeof window !== "undefined") {
		window.dispatchEvent(new Event(HOME_ONBOARDING_REQUEST_EVENT))
	}
}

/**
 * Opening the tour that frames a delivered file: the two steps of the `project-result` flow — the
 * attachment block that was just opened, and the project files area the file was filed into.
 *
 * A run of its own rather than a task's flow. Nothing named it, so the tour enters it as the
 * automatic run's task — `first-ai-work` — which is also the one whose page carries these anchors:
 * the home shell hosts the project page, so its message list and project sider are served by the
 * same mount. The outcome is read as belonging to no task as well (see the tour), so walking this
 * tour neither claims a reward nor records an abort.
 *
 * The stored flow is what makes the mount visible at all: a run nobody asked for is one the tour
 * refuses to paint, and a stored flow is exactly what "somebody asked" looks like from outside.
 */
export function startHomeOnboardingDeliverableRun() {
	beginHomeOnboardingAnalyticsRun("first-ai-work", false)
	setHomeOnboardingFlow("project-result")
	// The home shell is none of this tour's business: its anchors are the project page's own.
	setHomeOnboardingSidebarTopMode(false)
	resetHomeOnboardingStepIndex()
	if (typeof window !== "undefined") {
		window.dispatchEvent(new Event(HOME_ONBOARDING_REQUEST_EVENT))
	}
}

/**
 * The entry a click on a file a task delivered takes: whether the tour is due, and — when it is —
 * opening it and remembering that it was.
 *
 * All three conditions are read here rather than at the call site, because all three are this
 * module's own business: there is an account to ask about, that account is still a new one per the
 * backend (`hasHomeOnboardingTasks`), and this browser has not shown it this tour yet. That a click
 * is the only caller is also the answer to "is this file one the task produced" — an attachment
 * block is what a task's result is rendered as, on the tool and the assistant role alike.
 *
 * Answers whether the tour was opened, which is what lets the caller mark the block it was opened
 * from: the first step points at the block that was clicked, and nothing else can tell the tour
 * which of the page's attachment blocks that is.
 */
export function startHomeOnboardingDeliverableRunIfDue(): boolean {
	const userMagicId = currentUserMagicId
	if (!userMagicId) return false
	if (isHomeOnboardingDeliverableSpent(userMagicId)) return false
	if (!hasHomeOnboardingTasks(userMagicId)) return false
	// Spent as it opens, by the thing that opened it — the rule the introduction dialog follows,
	// and for the same reason: being shown the tour is what must not happen twice, so a reload
	// with it still up must not bring it back.
	spendHomeOnboardingDeliverableIntro(userMagicId)
	startHomeOnboardingDeliverableRun()
	return true
}

/**
 * Whether an automatic run has anything left to offer on this page load.
 *
 * Unfinished covers both "never started" and "left mid-way". The statuses are memory-only and are
 * seeded from the backend's reward list (`ensureHomeOnboardingRewardList`), so this answers "does
 * the account still owe a task" rather than "has this tab seen it yet".
 *
 * Callers that gate a *visible* automatic run must pair this with `canOpenAutomaticHomeOnboarding`:
 * this function answers from the progress mirror alone, and the mirror reads "everything unfinished"
 * both before the list is in and on a deployment that does not offer the feature. `GuideTourWrapper`
 * does exactly that.
 */
export function checkIfHomeOnboardingNeeded(
	userMagicId?: string,
	isHome = false,
	isMobile = false,
) {
	if (!userMagicId || !isHome || isMobile) return false
	return HOME_ONBOARDING_TASK_IDS.some((task) => !isHomeOnboardingCompleted(userMagicId, task))
}

export function markHomeOnboardingCompleted(
	userMagicId: string | undefined,
	task: HomeOnboardingTaskId,
) {
	if (!userMagicId) return
	setHomeOnboardingStatus("completed", userMagicId, task)
}

/**
 * Record that the user left a task's flow before its last step. A finished task is never
 * downgraded: re-watching a finished flow and closing it early would otherwise take the task back,
 * contradicting the row the user already saw turn into "回看". Unfinished is the state the
 * "开始体验" entry depends on.
 */
export function markHomeOnboardingAborted(
	userMagicId: string | undefined,
	task: HomeOnboardingTaskId,
) {
	if (!userMagicId || isHomeOnboardingCompleted(userMagicId, task)) return
	setHomeOnboardingStatus("aborted", userMagicId, task)
}

/* ------------------------------------------------------------------------------------------------
 * Reward list — the backend's answer for the account, cached until it is refreshed
 * ---------------------------------------------------------------------------------------------- */

/**
 * How far the current account's reward list has got. The two "we asked and there is nothing to
 * show" answers are deliberately distinct from "we have not asked yet" and "the ask failed":
 *
 * - `unsupported` — the deployment answered `9300`/`9301`, i.e. this organization is not a personal
 *   organization on a SaaS commercial deployment, or the feature switch is off. The card and the
 *   automatic run both stay off the screen, silently. This is a supported answer, not an error.
 * - `failed` — a network or unexpected error. The card stays away rather than rendering a lie, and
 *   the next mount asks again.
 */
export type HomeOnboardingRewardListStatus = "idle" | "loading" | "ready" | "unsupported" | "failed"

export interface HomeOnboardingRewardList {
	status: HomeOnboardingRewardListStatus
	rewards: HomeOnboardingReward[]
	/** Supplied with the task list and reused by guide analytics; never inferred on the client. */
	participantType?: OnboardingParticipantType
}

/** Stable identity while nothing has been fetched, so a render never sees a brand-new object. */
const IDLE_REWARD_LIST: HomeOnboardingRewardList = { status: "idle", rewards: [] }
const rewardListByUser = new Map<string, HomeOnboardingRewardList>()
const rewardListRequests = new Map<string, Promise<void>>()

function writeHomeOnboardingRewardList(key: string, list: HomeOnboardingRewardList) {
	rewardListByUser.set(key, list)
	if (typeof window !== "undefined") {
		window.dispatchEvent(new Event(HOME_ONBOARDING_STATE_EVENT))
	}
}

/** The cached list for the account. `idle` until `ensureHomeOnboardingRewardList` has been called. */
export function getHomeOnboardingRewardList(userMagicId?: string): HomeOnboardingRewardList {
	return rewardListByUser.get(getUserKey(userMagicId)) ?? IDLE_REWARD_LIST
}

/**
 * Whether the automatic run may open at all for an account whose list is in this state.
 *
 * This is *not* the same question as "has the list arrived yet", and the difference is the whole
 * reason the predicate exists. Three of the five states leave the progress mirror reading
 * "everything unfinished", so an armed run says nothing about whether it should open — and those
 * three fall into two groups, only one of which is "not yet":
 *
 * - `idle`/`loading` — we have not asked yet, or the answer is still on its way. The mirror is
 *   memory-only and starts empty, so it cannot tell a user who has finished everything from one who
 *   has just arrived: the run would open its dialog and be torn down the moment the answer lands.
 * - `unsupported` — the deployment answered `9300`/`9301`: this organization does not have the
 *   feature. That answer seeds no progress either, because there is none to seed, so the mirror
 *   still reads "everything unfinished" and the dialog would open in an organization the feature
 *   does not exist in. The card hides itself on the same answer — its rows come back empty and it
 *   renders nothing — but the run has no rows of its own to read that from, which is why the rule
 *   lives here.
 *
 * `failed` does let the run through *here*: a list that never arrived is not the backend saying no,
 * and this predicate answers about the list's state rather than about the account. It is
 * deliberately not the last word — the run's own precondition is a task the list reports as still
 * pending (`isHomeOnboardingTaskPending`), a failed list has no such row, so an unanswered ask does
 * not put the dialog up. An account whose first request hit a bad connection is asked again on the
 * next mount rather than shown a dialog for a task nobody confirmed.
 *
 * The caller holds the status in state, so it passes the snapshot its render is based on rather
 * than asking the cache a second time.
 */
export function canOpenAutomaticHomeOnboarding(status: HomeOnboardingRewardListStatus) {
	return status === "ready" || status === "failed"
}

/**
 * Whether the backend still counts this account as a new user, which is the only thing that
 * decides whether a delivered file is worth a tour.
 *
 * The list itself is the answer: it is the account's tasks, and an account the deployment no
 * longer treats as new has none left to send. Deliberately read from `ready` alone rather than
 * through `canOpenAutomaticHomeOnboarding`, because the two states it lets through mean different
 * things — `failed` is "we could not ask", and treating that as "the backend says yes" would put
 * the tour in front of every account whose first request hit a bad connection. `unsupported`
 * answers the other way and is covered by the same test: it carries no rows either.
 */
export function hasHomeOnboardingTasks(userMagicId?: string) {
	const list = getHomeOnboardingRewardList(userMagicId)
	return list.status === "ready" && list.rewards.length > 0
}

/**
 * Whether the backend's list still has this task *waiting* for the account — the introduction
 * dialog's own precondition.
 *
 * The automatic run's only surface is the AI-work introduction, and it is offered to an account
 * that still owes that task. The progress mirror cannot answer that: it is seeded from the list's
 * `COMPLETED` rows alone, so a task the backend has `EXPIRED` — or dropped from the list
 * altogether, which is what a progress older than the task gets — still reads as unfinished, and
 * the dialog would open on an account with nothing left to do. The list carries the verdict, and
 * only its `ready` answer is read as one, exactly as `hasHomeOnboardingTasks` reads it for the
 * delivered-file tour: `failed` is "we could not ask", and taking that for a yes would put the
 * dialog in front of every account whose first request hit a bad connection. The ask is retried on
 * the next mount, so an account that really is new is asked again rather than shown a dialog for a
 * task nobody confirmed.
 */
export function isHomeOnboardingTaskPending(
	userMagicId: string | undefined,
	task: HomeOnboardingTaskId,
) {
	const list = getHomeOnboardingRewardList(userMagicId)
	return (
		list.status === "ready" &&
		list.rewards.some((reward) => reward.taskId === task && reward.status === "PENDING")
	)
}

/**
 * Ask for the account's reward list once. Concurrent callers share one request — the card and the
 * guide wrapper both ask on mount, and the guide wrapper's render path means it asks on every
 * re-render, so a shared in-flight promise is what keeps that from becoming a request per frame.
 *
 * A settled answer is never re-fetched: a completed task cannot become uncompleted, and the one
 * place a stale row matters (`9304` from a claim) refreshes explicitly.
 */
export function ensureHomeOnboardingRewardList(userMagicId?: string): Promise<void> {
	if (!userMagicId) return Promise.resolve()
	const key = getUserKey(userMagicId)
	const inFlight = rewardListRequests.get(key)
	if (inFlight) return inFlight
	const status = rewardListByUser.get(key)?.status
	if (status === "ready" || status === "unsupported") return Promise.resolve()

	const request = loadHomeOnboardingRewardList(userMagicId, key)
	rewardListRequests.set(key, request)
	return request
}

/**
 * Ask again for the account's list — for the places that know the cache went stale.
 *
 * The cached answer is **kept while the new one is on its way**, and that is the whole point of the
 * shape below. `loadHomeOnboardingRewardList` carries the rows it finds in the cache into the
 * `loading` write precisely so that the surfaces reading them keep something to render, so throwing
 * the entry away first — which is what this used to do, to get past `ensureHomeOnboardingRewardList`
 * answering `ready` with "nothing to do" — leaves the loader with no rows to carry. It then
 * publishes an empty list, and the benefits card, which renders **nothing at all** without rows,
 * takes the entry card *and* the task centre's dialog off the page until the answer lands and it
 * remounts with them. Opening the task centre is the one place this is asked for on purpose, so the
 * frame the user sees is the dialog they just opened blinking out and fading back in.
 *
 * Asking the loader directly is what lets the entry stay. The request is registered in the in-flight
 * map, so a concurrent `ensureHomeOnboardingRewardList` shares this ask rather than making a second
 * one — which is the only thing the old route through `ensure` was still buying.
 */
export function refreshHomeOnboardingRewardList(userMagicId?: string): Promise<void> {
	if (!userMagicId) return Promise.resolve()
	const key = getUserKey(userMagicId)
	const inFlight = rewardListRequests.get(key)
	if (inFlight) return inFlight

	const request = loadHomeOnboardingRewardList(userMagicId, key)
	rewardListRequests.set(key, request)
	return request
}

async function loadHomeOnboardingRewardList(userMagicId: string, key: string) {
	const knownList = rewardListByUser.get(key)
	const known = knownList?.rewards ?? []
	writeHomeOnboardingRewardList(key, {
		status: "loading",
		rewards: known,
		participantType: knownList?.participantType,
	})

	try {
		const { getOnboardingTasks } = await import("@/apis/modules/onboarding")
		const data = await getOnboardingTasks()
		const rewards = (data?.tasks ?? []).map(toHomeOnboardingReward)
		/*
		 * The backend is the authority on what is done, so its verdict seeds the guide's own mirror.
		 * Without this a reload would offer a run for a task the account has already finished — the
		 * mirror is memory-only and starts empty. Written straight into the map so the single STATE
		 * event below carries the whole answer instead of one per task.
		 */
		for (const reward of rewards) {
			if (reward.taskId && reward.status === "COMPLETED") {
				onboardingStatusByUser.set(getStatusKey(userMagicId, reward.taskId), "completed")
			}
		}
		writeHomeOnboardingRewardList(key, {
			status: "ready",
			rewards,
			participantType: data.participant_type,
		})
	} catch (error) {
		const code = readOnboardingErrorCode(error)
		if (isOnboardingUnsupportedCode(code)) {
			writeHomeOnboardingRewardList(key, { status: "unsupported", rewards: [] })
			return
		}
		// Keep whatever rows were already on screen and let the next mount try again. Nothing is
		// marked done here: an unanswered list must not turn into a fabricated progress.
		writeHomeOnboardingRewardList(key, {
			status: "failed",
			rewards: known,
			participantType: knownList?.participantType,
		})
	} finally {
		rewardListRequests.delete(key)
	}
}

/**
 * Fold a granted reward into the cached list, so the card updates without a round trip. Returns
 * whether there was a row to patch — the caller refreshes when there was not (a claim can happen
 * before the list ever loaded, e.g. a run left over from a page where the fetch failed).
 */
function applyHomeOnboardingReward(
	key: string,
	task: HomeOnboardingTaskId,
	points: number,
): boolean {
	const list = rewardListByUser.get(key)
	if (!list) return false

	const grantedAt = new Date().toISOString()
	writeHomeOnboardingRewardList(key, {
		...list,
		status: "ready",
		rewards: list.rewards.map((reward) =>
			reward.taskId === task
				? {
						...reward,
						status: "COMPLETED" as const,
						rewardStatus: "GRANTED" as const,
						points,
						completedAt: reward.completedAt ?? grantedAt,
						rewardGrantedAt: grantedAt,
					}
				: reward,
		),
	})
	return true
}

export type HomeOnboardingClaimResult =
	| { ok: true; points: number }
	| {
			ok: false
			/** Business code when the backend answered, `null` for a transport failure. */
			code: number | null
			/**
			 * Whether the failure is worth another attempt. `9306`/`9307` and a lost connection are;
			 * `9304` (expired) and `9305` (broken progress) are not — retrying those only makes the
			 * user repeat a call that cannot succeed.
			 */
			retryable: boolean
			/** The backend's own message, which it documents as safe to show as-is. */
			message: string | null
	  }

/**
 * Which copy slot spells out a failed claim.
 *
 * Deliberately **our** strings rather than the backend's `message`: the contract states the API does
 * no language negotiation (that is why it ships all languages at once for the fields the frontend
 * renders), so a `message` is in whatever language the deployment was configured with and would sit
 * in a Chinese UI in English or the other way round. The code is the part of the answer this client
 * can translate; `readOnboardingErrorMessage` is kept for diagnostics only.
 *
 * `null` for a code with nothing to say — `9300`/`9301` are the feature disappearing under the
 * user, which is a silent hide, not an error to report.
 */
export function homeOnboardingClaimFailureKey(code: number | null): string | null {
	if (isOnboardingUnsupportedCode(code)) return null
	switch (code) {
		case ONBOARDING_RESPONSE_CODE.TASK_EXPIRED:
			return "homeOnboarding.claim.expired"
		case ONBOARDING_RESPONSE_CODE.PROGRESS_BROKEN:
			return "homeOnboarding.claim.broken"
		case ONBOARDING_RESPONSE_CODE.TASK_NOT_FOUND:
		case ONBOARDING_RESPONSE_CODE.TASK_NOT_MANUALLY_COMPLETABLE:
			return "homeOnboarding.claim.unavailable"
		default:
			// `9306`/`9307`, and a request that never reached the backend at all.
			return "homeOnboarding.claim.retry"
	}
}

/**
 * Complete a task and claim its points.
 *
 * **The task is only recorded as done once the backend says the grant went through.** A failed call
 * therefore leaves the row exactly as it was — "开始体验", with the flow still enterable — which is
 * what makes a retry possible at all; marking it done locally and then discovering the grant failed
 * would leave the user with a finished-looking task and no points.
 *
 * Only ever called for a task the backend can complete on request —
 * `canManuallyCompleteHomeOnboardingTask` — because `first_ai_work` answers `9303` by design and is
 * finished by the system event instead.
 */
export async function claimHomeOnboardingReward(
	userMagicId: string | undefined,
	task: HomeOnboardingTaskId,
): Promise<HomeOnboardingClaimResult> {
	if (!userMagicId) return { ok: false, code: null, retryable: false, message: null }
	const key = getUserKey(userMagicId)

	try {
		const { completeOnboardingTask } = await import("@/apis/modules/onboarding")
		const data = await completeOnboardingTask(HOME_ONBOARDING_TASK_CODE[task])
		const points = data?.points ?? 0
		// The mirror first, so the automatic run cannot re-arm between the two writes.
		onboardingStatusByUser.set(getStatusKey(userMagicId, task), "completed")
		if (!applyHomeOnboardingReward(key, task, points)) {
			void refreshHomeOnboardingRewardList(userMagicId)
		} else if (typeof window !== "undefined") {
			window.dispatchEvent(new Event(HOME_ONBOARDING_STATE_EVENT))
		}
		return { ok: true, points }
	} catch (error) {
		const code = readOnboardingErrorCode(error)
		/*
		 * A task the deployment already considers over. Refreshing is what lets the row stop looking
		 * claimable — the flow cannot grant anything any more, so leaving the user with a "开始体验"
		 * button they can only fail on is worse than showing the truth.
		 */
		if (code === ONBOARDING_RESPONSE_CODE.TASK_EXPIRED) {
			void refreshHomeOnboardingRewardList(userMagicId)
		}
		return {
			ok: false,
			code,
			// No code at all means the request never reached the backend — always worth retrying.
			retryable: code === null || isOnboardingRetryableCode(code),
			message: readOnboardingErrorMessage(error),
		}
	}
}

/*
 * ---------------------------------------------------------------------------------------------
 * Legacy surface: kept so imports resolve, deliberately does nothing.
 * ---------------------------------------------------------------------------------------------
 */

/**
 * @deprecated **No-op. Kept only so that the import resolves.**
 *
 * This used to arm the localStorage-driven workspace/project tour: it wrote
 * `super_magic/is_need_{workspace,project}_features_guide/<magicId>` — read back by the matching
 * `checkIfGuideTourNeeded` — and published `PubSubEvents.GuideTourElementReady` to wake the tour up.
 * The rewrite above replaced that whole mechanism with the backend-driven one, and took every
 * reader with it: neither the two flags, nor `checkIfGuideTourNeeded`, nor `markGuideTourCompleted`
 * is referenced anywhere in the app any more, so there is nothing left to arm. The new flow also
 * never waits on a user's profile, which is what the call sites below were really gating.
 *
 * It outlives its implementation because `enterprise/src/layouts/BaseLayout` still calls it when the
 * "improve information" modal closes. The enterprise layer is served as-is on the enterprise build,
 * so a missing export there is a **fatal `SyntaxError` in the dev server** (`does not provide an
 * export named …`), not something a bundler can tree-shake or warn about. Its neighbour on the next
 * line, `setNeedHTMLGuideTour`, was left behind as a stub for exactly this reason.
 *
 * The signature is kept so that call site stays type-correct, while the body takes no argument at
 * all: naming one only to leave it unused would be a lint warning, and pretending to read it would
 * be a lie. Nothing here can use a `magicId` — the state it used to key on no longer exists.
 */
export const setNeedGuideTour: (userMagicId?: string) => void = () => undefined

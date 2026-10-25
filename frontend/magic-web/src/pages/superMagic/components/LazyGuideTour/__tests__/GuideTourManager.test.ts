import { beforeEach, describe, expect, it, vi } from "vitest"

// A type-only import: erased at build time, so the module is still read through `loadOnboarding`
// and the fresh instance per test is the only one this file ever touches.
import type { HomeOnboardingTaskId } from "../GuideTourManager"

/*
 * No mock of the onboarding contract is needed here: this file exercises the manager's in-memory
 * state machine and never completes a task or fetches the reward list, and the manager imports only
 * the dependency-free half of that contract statically (`@/apis/modules/onboarding-codes`). The two
 * network calls are loaded on demand inside the functions that make them, so nothing in this module
 * graph reaches an HTTP client — which is what keeps a run that re-imports the manager through
 * `vi.resetModules()` 41 times a matter of seconds instead of minutes.
 *
 * The endpoints themselves are covered where they are actually driven:
 * `HomeOnboardingClaim.test.tsx` and `NewUserBenefitsCopy.test.tsx`.
 */

const MAGIC_ID = "user-1"
const WORKBENCH = "workbench"
const FIRST_AI_WORK = "first-ai-work"
const SUPER_LOBSTER = "super-lobster"
const HIRE_EMPLOYEE = "hire-employee"
const MANAGE_SKILL = "manage-skill"
const CREATE_MICRO_APP = "create-micro-app"
const CREATE_AI_PPT = "create-ai-ppt"

/**
 * The onboarding statuses and the in-flight step live in module memory, which is exactly what the
 * app starts from on a page load. Re-importing a fresh module instance per test hands every case
 * that same clean slate — and doubles as the proof that a refresh resets the onboarding.
 */
async function loadOnboarding() {
	vi.resetModules()
	return import("../GuideTourManager")
}

/**
 * The one piece of runtime state that is not module memory: the introduction the account has already
 * been shown. jsdom keeps storage for the whole file, so without this a test that offers the dialog
 * would decide the answer every later test starts from.
 */
beforeEach(() => {
	window.localStorage.clear()
})

describe("onboarding analytics run", () => {
	it("freezes replay and deduplicates steps across remounts", async () => {
		const manager = await loadOnboarding()
		manager.setHomeOnboardingAnalyticsScope(MAGIC_ID, "org-1")
		manager.startHomeOnboarding(WORKBENCH, MAGIC_ID, true)
		const run = manager.getHomeOnboardingAnalyticsRun()
		const runId = run?.id ?? -1
		expect(run?.isReplay).toBe(true)
		expect(manager.consumeHomeOnboardingStepExposure(runId, "1")).toBe(true)
		expect(manager.consumeHomeOnboardingStepExposure(runId, "1")).toBe(false)
		manager.markHomeOnboardingAborted(MAGIC_ID, WORKBENCH)
		expect(manager.getHomeOnboardingAnalyticsRun()?.isReplay).toBe(true)
		manager.startHomeOnboarding(WORKBENCH, MAGIC_ID, false)
		expect(manager.consumeHomeOnboardingStepExposure(runId, "2")).toBe(false)
		expect(manager.getHomeOnboardingAnalyticsRun()?.isReplay).toBe(false)
	})

	it("isolates a previous account and organization's exposure records", async () => {
		const manager = await loadOnboarding()
		manager.setHomeOnboardingAnalyticsScope(MAGIC_ID, "org-1")
		expect(manager.consumeHomeOnboardingSurfaceExposure("floating_card")).toBe(true)
		expect(manager.consumeHomeOnboardingSurfaceExposure("floating_card")).toBe(false)
		manager.startHomeOnboarding(FIRST_AI_WORK, MAGIC_ID)
		manager.setHomeOnboardingAnalyticsScope(MAGIC_ID, "org-2")
		expect(manager.getHomeOnboardingAnalyticsRun()).toBeNull()
		expect(manager.consumeHomeOnboardingSurfaceExposure("floating_card")).toBe(true)
	})
})

describe("home onboarding status", () => {
	it("starts every task unfinished on every page load", async () => {
		const firstLoad = await loadOnboarding()
		firstLoad.markHomeOnboardingCompleted(MAGIC_ID, WORKBENCH)
		firstLoad.markHomeOnboardingCompleted(MAGIC_ID, FIRST_AI_WORK)
		expect(firstLoad.checkIfHomeOnboardingNeeded(MAGIC_ID, true, false)).toBe(false)

		// Nothing is persisted until the backend reports real progress, so a reload drops both
		// outcomes and the flows are offered again.
		const secondLoad = await loadOnboarding()
		expect(secondLoad.getHomeOnboardingStatus(MAGIC_ID, WORKBENCH)).toBe("pending")
		expect(secondLoad.getHomeOnboardingStatus(MAGIC_ID, FIRST_AI_WORK)).toBe("pending")
		expect(secondLoad.checkIfHomeOnboardingNeeded(MAGIC_ID, true, false)).toBe(true)
	})

	it("defaults every account and task to unfinished", async () => {
		const onboarding = await loadOnboarding()
		expect(onboarding.getHomeOnboardingStatus(undefined, WORKBENCH)).toBe("pending")
		expect(onboarding.getHomeOnboardingStatus(MAGIC_ID, FIRST_AI_WORK)).toBe("pending")
	})

	it("tracks the two tasks separately", async () => {
		const onboarding = await loadOnboarding()
		onboarding.markHomeOnboardingCompleted(MAGIC_ID, WORKBENCH)
		expect(onboarding.isHomeOnboardingCompleted(MAGIC_ID, WORKBENCH)).toBe(true)
		expect(onboarding.isHomeOnboardingCompleted(MAGIC_ID, FIRST_AI_WORK)).toBe(false)
	})

	it("keeps the tour armed while any task is still unfinished", async () => {
		const onboarding = await loadOnboarding()
		onboarding.markHomeOnboardingCompleted(MAGIC_ID, WORKBENCH)
		expect(onboarding.checkIfHomeOnboardingNeeded(MAGIC_ID, true, false)).toBe(true)

		onboarding.markHomeOnboardingCompleted(MAGIC_ID, FIRST_AI_WORK)
		expect(onboarding.checkIfHomeOnboardingNeeded(MAGIC_ID, true, false)).toBe(false)
	})

	it("only auto-opens on the home page of a signed-in desktop session", async () => {
		const onboarding = await loadOnboarding()
		expect(onboarding.checkIfHomeOnboardingNeeded(undefined, true, false)).toBe(false)
		expect(onboarding.checkIfHomeOnboardingNeeded(MAGIC_ID, false, false)).toBe(false)
		expect(onboarding.checkIfHomeOnboardingNeeded(MAGIC_ID, true, true)).toBe(false)
		expect(onboarding.checkIfHomeOnboardingNeeded(MAGIC_ID, true, false)).toBe(true)
	})

	it("keeps a task unfinished when the user leaves it mid-way", async () => {
		const onboarding = await loadOnboarding()
		onboarding.markHomeOnboardingAborted(MAGIC_ID, FIRST_AI_WORK)
		expect(onboarding.getHomeOnboardingStatus(MAGIC_ID, FIRST_AI_WORK)).toBe("aborted")
		expect(onboarding.getHomeOnboardingStatus(MAGIC_ID, WORKBENCH)).toBe("pending")
		expect(onboarding.checkIfHomeOnboardingNeeded(MAGIC_ID, true, false)).toBe(true)
	})

	it("never downgrades a finished task if it is reported as left mid-way", async () => {
		const onboarding = await loadOnboarding()
		onboarding.markHomeOnboardingCompleted(MAGIC_ID, WORKBENCH)
		// Closing a "回看" run early must not take the finished task back.
		onboarding.markHomeOnboardingAborted(MAGIC_ID, WORKBENCH)
		expect(onboarding.isHomeOnboardingCompleted(MAGIC_ID, WORKBENCH)).toBe(true)
	})

	it("scopes every status to the signed-in account", async () => {
		const onboarding = await loadOnboarding()
		onboarding.markHomeOnboardingCompleted(MAGIC_ID, WORKBENCH)
		expect(onboarding.isHomeOnboardingCompleted("user-2", WORKBENCH)).toBe(false)
		expect(onboarding.isHomeOnboardingCompleted("user-2", FIRST_AI_WORK)).toBe(false)
	})
})

describe("home onboarding entry", () => {
	it("opens the workbench on its own steps and the AI-work task on the case picker", async () => {
		const onboarding = await loadOnboarding()
		const onRequest = vi.fn()
		window.addEventListener(onboarding.HOME_ONBOARDING_REQUEST_EVENT, onRequest)

		// A workbench run has no step of its own, so it is the highlighted steps that carry it.
		onboarding.startHomeOnboarding(WORKBENCH)
		expect(onboarding.getHomeOnboardingFlow()).toBeNull()
		expect(onboarding.getHomeOnboardingEntryTask()).toBe(WORKBENCH)

		onboarding.startHomeOnboarding(FIRST_AI_WORK)
		expect(onboarding.getHomeOnboardingFlow()).toBe("featured-case")
		expect(onboarding.getHomeOnboardingEntryTask()).toBe(FIRST_AI_WORK)

		expect(onRequest).toHaveBeenCalledTimes(2)
		window.removeEventListener(onboarding.HOME_ONBOARDING_REQUEST_EVENT, onRequest)
	})

	it("drops an interrupted step so the next run starts from its own first step", async () => {
		const onboarding = await loadOnboarding()
		onboarding.setHomeOnboardingFlow("project-orientation")
		onboarding.setHomeOnboardingSidebarTopMode(true)

		onboarding.startHomeOnboarding(WORKBENCH)

		expect(onboarding.getHomeOnboardingFlow()).toBeNull()
		expect(onboarding.isHomeOnboardingSidebarTopMode()).toBe(false)
	})

	it("does not claim a finished task back as unfinished", async () => {
		const onboarding = await loadOnboarding()
		onboarding.markHomeOnboardingCompleted(MAGIC_ID, WORKBENCH)

		// "回看" re-opens a finished flow, so the row has to stay on "回看" while that run is live.
		onboarding.startHomeOnboarding(WORKBENCH)

		expect(onboarding.isHomeOnboardingCompleted(MAGIC_ID, WORKBENCH)).toBe(true)
	})

	it("forgets a served entry so the next automatic run re-derives it", async () => {
		const onboarding = await loadOnboarding()
		onboarding.startHomeOnboarding(FIRST_AI_WORK)
		onboarding.clearHomeOnboardingEntryTask()
		expect(onboarding.getHomeOnboardingEntryTask()).toBeNull()
	})
})

describe("home onboarding introduction", () => {
	it("offers the introduction dialog to an account that has not been shown it", async () => {
		const onboarding = await loadOnboarding()
		expect(onboarding.isHomeOnboardingIntroSpent(MAGIC_ID)).toBe(false)
	})

	it("keeps the introduction spent across a reload", async () => {
		const onboarding = await loadOnboarding()
		onboarding.spendHomeOnboardingIntro(MAGIC_ID)
		expect(onboarding.isHomeOnboardingIntroSpent(MAGIC_ID)).toBe(true)

		/*
		 * The point of the flag outliving the page. The dialog is offered once, so someone who has
		 * seen it — and declined it, or left the run it opened — must not be asked again by the next
		 * load: both tasks are entered from the benefits card from there on, and refreshing cannot
		 * undo that.
		 */
		const nextLoad = await loadOnboarding()
		expect(nextLoad.isHomeOnboardingIntroSpent(MAGIC_ID)).toBe(true)
	})

	it("asks each account separately", async () => {
		const onboarding = await loadOnboarding()
		onboarding.spendHomeOnboardingIntro(MAGIC_ID)

		// The dialog was shown to an account, not to the browser: the next account to sign in on
		// this machine still has its own copy coming.
		expect(onboarding.isHomeOnboardingIntroSpent("user-2")).toBe(false)
	})

	it("treats a benefits-card entry as a run of its own", async () => {
		const onboarding = await loadOnboarding()
		onboarding.startHomeOnboarding(WORKBENCH, MAGIC_ID)
		expect(onboarding.isHomeOnboardingIntroSpent(MAGIC_ID)).toBe(true)
	})
})

describe("home onboarding task pages", () => {
	it("serves every task on the page that carries its anchors", async () => {
		const onboarding = await loadOnboarding()
		expect(onboarding.isHomeOnboardingTaskOnPage(WORKBENCH, "home")).toBe(true)
		expect(onboarding.isHomeOnboardingTaskOnPage(FIRST_AI_WORK, "home")).toBe(true)
		expect(onboarding.isHomeOnboardingTaskOnPage(WORKBENCH, "magi-claw")).toBe(false)

		expect(onboarding.isHomeOnboardingTaskOnPage(SUPER_LOBSTER, "magi-claw")).toBe(true)
		expect(onboarding.isHomeOnboardingTaskOnPage(SUPER_LOBSTER, "home")).toBe(false)

		expect(onboarding.isHomeOnboardingTaskOnPage(HIRE_EMPLOYEE, "crew-market")).toBe(true)
		expect(onboarding.isHomeOnboardingTaskOnPage(HIRE_EMPLOYEE, "home")).toBe(false)
		expect(onboarding.isHomeOnboardingTaskOnPage(HIRE_EMPLOYEE, "magi-claw")).toBe(false)

		expect(onboarding.isHomeOnboardingTaskOnPage(CREATE_MICRO_APP, "micro-apps")).toBe(true)
		expect(onboarding.isHomeOnboardingTaskOnPage(CREATE_MICRO_APP, "home")).toBe(false)
		expect(onboarding.isHomeOnboardingTaskOnPage(CREATE_MICRO_APP, "skill-market")).toBe(false)

		expect(onboarding.isHomeOnboardingTaskOnPage(CREATE_AI_PPT, "slides-templates")).toBe(true)
		expect(onboarding.isHomeOnboardingTaskOnPage(CREATE_AI_PPT, "home")).toBe(false)
		expect(onboarding.isHomeOnboardingTaskOnPage(CREATE_AI_PPT, "micro-apps")).toBe(false)

		// No pending entry means no page owns the run.
		expect(onboarding.isHomeOnboardingTaskOnPage(null, "home")).toBe(false)
	})

	it("serves the skill tour on both of the pages its steps span", async () => {
		const onboarding = await loadOnboarding()
		// It opens in the skill library, steps onto "My Skills" for two of its seven steps and comes
		// back, so both mounts have to be allowed to serve the same run.
		expect(onboarding.isHomeOnboardingTaskOnPage(MANAGE_SKILL, "skill-market")).toBe(true)
		expect(onboarding.isHomeOnboardingTaskOnPage(MANAGE_SKILL, "my-skills")).toBe(true)
		expect(onboarding.isHomeOnboardingTaskOnPage(MANAGE_SKILL, "home")).toBe(false)
		expect(onboarding.isHomeOnboardingTaskOnPage(MANAGE_SKILL, "crew-market")).toBe(false)

		// And it opens on the first of them, which is where an entry has to navigate to.
		expect(onboarding.getHomeOnboardingTaskEntryPage(MANAGE_SKILL)).toBe("skill-market")
		expect(onboarding.getHomeOnboardingTaskEntryPage(SUPER_LOBSTER)).toBe("magi-claw")
		expect(onboarding.getHomeOnboardingTaskEntryPage(HIRE_EMPLOYEE)).toBe("crew-market")
		expect(onboarding.getHomeOnboardingTaskEntryPage(CREATE_MICRO_APP)).toBe("micro-apps")
		expect(onboarding.getHomeOnboardingTaskEntryPage(CREATE_AI_PPT)).toBe("slides-templates")
		expect(onboarding.getHomeOnboardingTaskEntryPage(WORKBENCH)).toBe("home")
	})

	it("keeps the MagiClaw task out of the automatic home run", async () => {
		const onboarding = await loadOnboarding()
		// The MagiClaw steps are highlighted on another route, so a page load must not start them:
		// finishing the two home tasks disarms the automatic run on its own.
		onboarding.markHomeOnboardingCompleted(MAGIC_ID, WORKBENCH)
		onboarding.markHomeOnboardingCompleted(MAGIC_ID, FIRST_AI_WORK)
		expect(onboarding.checkIfHomeOnboardingNeeded(MAGIC_ID, true, false)).toBe(false)
	})

	it("opens the MagiClaw task on its own steps and tracks it apart from the home tasks", async () => {
		const onboarding = await loadOnboarding()
		onboarding.startHomeOnboarding(SUPER_LOBSTER)

		// It has no step of its own shared with the home page; the three MagiClaw steps carry the run.
		expect(onboarding.getHomeOnboardingFlow()).toBeNull()
		expect(onboarding.getHomeOnboardingEntryTask()).toBe(SUPER_LOBSTER)

		onboarding.markHomeOnboardingCompleted(MAGIC_ID, SUPER_LOBSTER)
		expect(onboarding.isHomeOnboardingCompleted(MAGIC_ID, SUPER_LOBSTER)).toBe(true)
		expect(onboarding.isHomeOnboardingCompleted(MAGIC_ID, WORKBENCH)).toBe(false)
	})

	it("opens the crew market task on its own steps and tracks it apart from the rest", async () => {
		const onboarding = await loadOnboarding()
		onboarding.startHomeOnboarding(HIRE_EMPLOYEE)

		// It has no step of its own shared with the home page; the five crew market steps carry it.
		expect(onboarding.getHomeOnboardingFlow()).toBeNull()
		expect(onboarding.getHomeOnboardingEntryTask()).toBe(HIRE_EMPLOYEE)

		onboarding.markHomeOnboardingCompleted(MAGIC_ID, HIRE_EMPLOYEE)
		expect(onboarding.isHomeOnboardingCompleted(MAGIC_ID, HIRE_EMPLOYEE)).toBe(true)
		expect(onboarding.isHomeOnboardingCompleted(MAGIC_ID, SUPER_LOBSTER)).toBe(false)
	})

	it("keeps the crew market task out of the automatic home run", async () => {
		const onboarding = await loadOnboarding()
		// Its anchors are on the crew market route, so a page load must not start it — only the
		// benefits card enters it.
		onboarding.markHomeOnboardingCompleted(MAGIC_ID, WORKBENCH)
		onboarding.markHomeOnboardingCompleted(MAGIC_ID, FIRST_AI_WORK)
		expect(onboarding.checkIfHomeOnboardingNeeded(MAGIC_ID, true, false)).toBe(false)
	})

	it("only lets a finished tour that produces nothing be opened again", async () => {
		const onboarding = await loadOnboarding()
		/*
		 * Every tour but the AI-work one only points at parts of the product, so a second pass is a
		 * review and its row offers one. That has to hold for the MagiClaw tour too: it is a demo
		 * like the crew-market one, and the card that enters it is the same card — where its route
		 * lives has nothing to do with whether a finished run may be watched again.
		 *
		 * The list of tasks is read off the record keyed by the task id rather than restated here,
		 * so a ninth task cannot be added without this comparison seeing it — which is the shape
		 * that let MagiClaw fall out of the entry list unnoticed.
		 */
		const allTasks = Object.keys(
			onboarding.HOME_ONBOARDING_TASK_PAGES,
		) as HomeOnboardingTaskId[]
		const replayable = allTasks.filter((task) =>
			onboarding.isReplayableHomeOnboardingTask(task),
		)

		expect(replayable).toEqual([
			WORKBENCH,
			SUPER_LOBSTER,
			HIRE_EMPLOYEE,
			MANAGE_SKILL,
			CREATE_MICRO_APP,
			CREATE_AI_PPT,
			"audio-recording",
		])
		// The one task left out walks a real piece of work, so it is not a review of itself.
		expect(onboarding.isReplayableHomeOnboardingTask(FIRST_AI_WORK)).toBe(false)
	})

	it("opens the skill tour on its own steps and tracks it apart from the rest", async () => {
		const onboarding = await loadOnboarding()
		onboarding.startHomeOnboarding(MANAGE_SKILL)

		// Seven highlighted steps carry it, so it has no step of its own and no in-flight flow.
		expect(onboarding.getHomeOnboardingFlow()).toBeNull()
		expect(onboarding.getHomeOnboardingEntryTask()).toBe(MANAGE_SKILL)

		onboarding.markHomeOnboardingCompleted(MAGIC_ID, MANAGE_SKILL)
		expect(onboarding.isHomeOnboardingCompleted(MAGIC_ID, MANAGE_SKILL)).toBe(true)
		expect(onboarding.isHomeOnboardingCompleted(MAGIC_ID, HIRE_EMPLOYEE)).toBe(false)
		expect(onboarding.isHomeOnboardingCompleted(MAGIC_ID, WORKBENCH)).toBe(false)
	})

	it("keeps the skill tour out of the automatic home run", async () => {
		const onboarding = await loadOnboarding()
		// Its anchors are on the skill library and "My Skills", so a page load must not start it —
		// only the benefits card enters it.
		onboarding.markHomeOnboardingCompleted(MAGIC_ID, WORKBENCH)
		onboarding.markHomeOnboardingCompleted(MAGIC_ID, FIRST_AI_WORK)
		expect(onboarding.checkIfHomeOnboardingNeeded(MAGIC_ID, true, false)).toBe(false)
	})

	it("opens the app-space tour on its own steps and tracks it apart from the rest", async () => {
		const onboarding = await loadOnboarding()
		onboarding.startHomeOnboarding(CREATE_MICRO_APP)

		// Three highlighted steps carry it, so it has no step of its own and no in-flight flow.
		expect(onboarding.getHomeOnboardingFlow()).toBeNull()
		expect(onboarding.getHomeOnboardingEntryTask()).toBe(CREATE_MICRO_APP)
		expect(onboarding.getHomeOnboardingStepIndex()).toBe(0)

		onboarding.markHomeOnboardingCompleted(MAGIC_ID, CREATE_MICRO_APP)
		expect(onboarding.isHomeOnboardingCompleted(MAGIC_ID, CREATE_MICRO_APP)).toBe(true)
		expect(onboarding.isHomeOnboardingCompleted(MAGIC_ID, MANAGE_SKILL)).toBe(false)
		expect(onboarding.isHomeOnboardingCompleted(MAGIC_ID, WORKBENCH)).toBe(false)
	})

	it("keeps the app-space tour out of the automatic home run", async () => {
		const onboarding = await loadOnboarding()
		// Its anchors are on the app-space route, so a page load must not start it — only the
		// benefits card enters it.
		onboarding.markHomeOnboardingCompleted(MAGIC_ID, WORKBENCH)
		onboarding.markHomeOnboardingCompleted(MAGIC_ID, FIRST_AI_WORK)
		expect(onboarding.checkIfHomeOnboardingNeeded(MAGIC_ID, true, false)).toBe(false)
	})

	it("opens the slides-template tour on its own steps and tracks it apart from the rest", async () => {
		const onboarding = await loadOnboarding()
		onboarding.startHomeOnboarding(CREATE_AI_PPT)

		// Four highlighted steps carry it, so it has no step of its own and no in-flight flow.
		expect(onboarding.getHomeOnboardingFlow()).toBeNull()
		expect(onboarding.getHomeOnboardingEntryTask()).toBe(CREATE_AI_PPT)
		expect(onboarding.getHomeOnboardingStepIndex()).toBe(0)

		onboarding.markHomeOnboardingCompleted(MAGIC_ID, CREATE_AI_PPT)
		expect(onboarding.isHomeOnboardingCompleted(MAGIC_ID, CREATE_AI_PPT)).toBe(true)
		expect(onboarding.isHomeOnboardingCompleted(MAGIC_ID, CREATE_MICRO_APP)).toBe(false)
		expect(onboarding.isHomeOnboardingCompleted(MAGIC_ID, WORKBENCH)).toBe(false)
	})

	it("keeps the slides-template tour out of the automatic home run", async () => {
		const onboarding = await loadOnboarding()
		// Its anchors are on the slides-template route, so a page load must not start it — only the
		// benefits card enters it.
		onboarding.markHomeOnboardingCompleted(MAGIC_ID, WORKBENCH)
		onboarding.markHomeOnboardingCompleted(MAGIC_ID, FIRST_AI_WORK)
		expect(onboarding.checkIfHomeOnboardingNeeded(MAGIC_ID, true, false)).toBe(false)
	})
})

describe("home onboarding notifications", () => {
	it("announces every status change so mirrored surfaces refresh", async () => {
		const onboarding = await loadOnboarding()
		const onStateChange = vi.fn()
		window.addEventListener(onboarding.HOME_ONBOARDING_STATE_EVENT, onStateChange)

		onboarding.markHomeOnboardingAborted(MAGIC_ID, WORKBENCH)
		onboarding.markHomeOnboardingCompleted(MAGIC_ID, WORKBENCH)
		onboarding.markHomeOnboardingCompleted(MAGIC_ID, FIRST_AI_WORK)

		expect(onStateChange).toHaveBeenCalledTimes(3)
		window.removeEventListener(onboarding.HOME_ONBOARDING_STATE_EVENT, onStateChange)
	})

	it("stays silent when the change was ignored", async () => {
		const onboarding = await loadOnboarding()
		onboarding.markHomeOnboardingCompleted(MAGIC_ID, WORKBENCH)
		const onStateChange = vi.fn()
		window.addEventListener(onboarding.HOME_ONBOARDING_STATE_EVENT, onStateChange)

		onboarding.markHomeOnboardingAborted(MAGIC_ID, WORKBENCH)

		expect(onStateChange).not.toHaveBeenCalled()
		window.removeEventListener(onboarding.HOME_ONBOARDING_STATE_EVENT, onStateChange)
	})
})

describe("home onboarding step announcements", () => {
	it("announces the step a run moves to, so the page can prepare what it highlights", async () => {
		const onboarding = await loadOnboarding()
		const onStepChange = vi.fn()
		window.addEventListener(onboarding.HOME_ONBOARDING_STEP_EVENT, onStepChange)

		onboarding.setHomeOnboardingStepIndex(2)

		expect(onStepChange).toHaveBeenCalledTimes(1)
		expect((onStepChange.mock.calls[0][0] as CustomEvent<number>).detail).toBe(2)
		window.removeEventListener(onboarding.HOME_ONBOARDING_STEP_EVENT, onStepChange)
	})

	it("stays silent when a run starts over", async () => {
		const onboarding = await loadOnboarding()
		onboarding.setHomeOnboardingStepIndex(3)
		const onStepChange = vi.fn()
		window.addEventListener(onboarding.HOME_ONBOARDING_STEP_EVENT, onStepChange)

		// A fresh entry writes its own first step itself, and the page reads the position when it
		// mounts — announcing the reset would only describe a run that is over.
		onboarding.resetHomeOnboardingStepIndex()
		onboarding.startHomeOnboarding(CREATE_AI_PPT)

		expect(onStepChange).not.toHaveBeenCalled()
		expect(onboarding.getHomeOnboardingStepIndex()).toBe(0)
		window.removeEventListener(onboarding.HOME_ONBOARDING_STEP_EVENT, onStepChange)
	})

	it("orders the AI-PPT steps the page acts on the way the run walks them", async () => {
		const onboarding = await loadOnboarding()
		// The run centres a card first, centres another one next, and only then shows the selection
		// the second card brings with it — the page's reactions have to follow that order.
		expect(onboarding.HOME_ONBOARDING_AI_PPT_TEMPLATE_STEP_INDEXES).toEqual([0, 2])
		expect(onboarding.HOME_ONBOARDING_AI_PPT_SELECTION_STEP_INDEX).toBe(3)
		expect(Math.max(...onboarding.HOME_ONBOARDING_AI_PPT_TEMPLATE_STEP_INDEXES)).toBeLessThan(
			onboarding.HOME_ONBOARDING_AI_PPT_SELECTION_STEP_INDEX,
		)
	})
})

describe("home onboarding anchor announcements", () => {
	it("announces the region a run frames, so a page that can collapse it opens it", async () => {
		const onboarding = await loadOnboarding()
		const onAnchorChange = vi.fn()
		window.addEventListener(onboarding.HOME_ONBOARDING_ANCHOR_EVENT, onAnchorChange)

		onboarding.setHomeOnboardingAnchor(onboarding.HomeOnboardingAnchor.ProjectSider)

		expect(onboarding.getHomeOnboardingAnchor()).toBe(
			onboarding.HomeOnboardingAnchor.ProjectSider,
		)
		expect(onAnchorChange).toHaveBeenCalledTimes(1)
		expect((onAnchorChange.mock.calls[0][0] as CustomEvent<string | null>).detail).toBe(
			onboarding.HomeOnboardingAnchor.ProjectSider,
		)
		window.removeEventListener(onboarding.HOME_ONBOARDING_ANCHOR_EVENT, onAnchorChange)
	})

	it("stays silent while the run stays on the same region", async () => {
		const onboarding = await loadOnboarding()
		onboarding.setHomeOnboardingAnchor(onboarding.HomeOnboardingAnchor.ProjectSider)
		const onAnchorChange = vi.fn()
		window.addEventListener(onboarding.HOME_ONBOARDING_ANCHOR_EVENT, onAnchorChange)

		/*
		 * The page acts on the announcement rather than on the region it names — it opens the panel
		 * — so a repeat would put back what the user had just closed, once per render.
		 */
		onboarding.setHomeOnboardingAnchor(onboarding.HomeOnboardingAnchor.ProjectSider)

		expect(onAnchorChange).not.toHaveBeenCalled()
		window.removeEventListener(onboarding.HOME_ONBOARDING_ANCHOR_EVENT, onAnchorChange)
	})

	it("announces the withdrawal, so a page mounting later has nothing to open for", async () => {
		const onboarding = await loadOnboarding()
		onboarding.setHomeOnboardingAnchor(onboarding.HomeOnboardingAnchor.ProjectSider)
		const onAnchorChange = vi.fn()
		window.addEventListener(onboarding.HOME_ONBOARDING_ANCHOR_EVENT, onAnchorChange)

		onboarding.setHomeOnboardingAnchor(null)

		expect(onboarding.getHomeOnboardingAnchor()).toBeNull()
		expect(onAnchorChange).toHaveBeenCalledTimes(1)
		expect((onAnchorChange.mock.calls[0][0] as CustomEvent<string | null>).detail).toBeNull()
		window.removeEventListener(onboarding.HOME_ONBOARDING_ANCHOR_EVENT, onAnchorChange)
	})
})

describe("home onboarding step verdicts", () => {
	it("carries the hosting page's verdict on a step so the tour stops waiting on a timer", async () => {
		const onboarding = await loadOnboarding()
		const onPrepared = vi.fn()
		window.addEventListener(onboarding.HOME_ONBOARDING_STEP_READY_EVENT, onPrepared)

		// The page answers the step it was asked for, whether it found something to frame or not:
		// from here the tour judges the step on its anchor instead of on the clock.
		onboarding.announceHomeOnboardingStepPrepared(0)

		expect(onboarding.getHomeOnboardingPreparedStepIndex()).toBe(0)
		expect(onPrepared).toHaveBeenCalledTimes(1)
		expect((onPrepared.mock.calls[0][0] as CustomEvent<number>).detail).toBe(0)
		window.removeEventListener(onboarding.HOME_ONBOARDING_STEP_READY_EVENT, onPrepared)
	})

	it("starts out with no verdict, so an unasked step is never treated as answered", async () => {
		const onboarding = await loadOnboarding()
		// A step the page never answered has to keep the tour waiting rather than let it decide the
		// anchor is missing the moment it looks.
		expect(onboarding.getHomeOnboardingPreparedStepIndex()).toBeNull()
	})

	it("forgets the verdict as the run moves on", async () => {
		const onboarding = await loadOnboarding()
		onboarding.announceHomeOnboardingStepPrepared(2)

		// Stale on purpose: the next step is a different one with a job of its own, and reading the
		// previous answer as its own would let it be judged before the page had touched it.
		onboarding.setHomeOnboardingStepIndex(3)

		expect(onboarding.getHomeOnboardingPreparedStepIndex()).toBeNull()
	})

	it("forgets the verdict when a run starts over", async () => {
		const onboarding = await loadOnboarding()
		onboarding.announceHomeOnboardingStepPrepared(3)

		onboarding.resetHomeOnboardingStepIndex()

		expect(onboarding.getHomeOnboardingStepIndex()).toBe(0)
		expect(onboarding.getHomeOnboardingPreparedStepIndex()).toBeNull()
	})
})

describe("home onboarding in-flight state", () => {
	it("is memory-only, so a reload can never resume the tour mid-way", async () => {
		const firstLoad = await loadOnboarding()
		firstLoad.setHomeOnboardingFlow("project-orientation")
		firstLoad.setHomeOnboardingSidebarTopMode(true)

		// Resuming a project step on the home page would find no anchor, end the run, and hide the
		// welcome step that a fresh load is supposed to show.
		const secondLoad = await loadOnboarding()
		expect(secondLoad.getHomeOnboardingFlow()).toBeNull()
		expect(secondLoad.isHomeOnboardingSidebarTopMode()).toBe(false)
	})

	it("hands the reached step over to the next page of a run that spans routes", async () => {
		const onboarding = await loadOnboarding()
		// The skill tour is mounted by the skill library and by "My Skills" in turn. The second
		// mount reads the position back rather than starting the run over.
		onboarding.setHomeOnboardingStepIndex(4)
		expect(onboarding.getHomeOnboardingStepIndex()).toBe(4)
	})

	it("starts every run from its own first step", async () => {
		const onboarding = await loadOnboarding()
		onboarding.setHomeOnboardingStepIndex(6)

		onboarding.startHomeOnboarding(MANAGE_SKILL)

		expect(onboarding.getHomeOnboardingStepIndex()).toBe(0)
	})

	it("does not carry the step position across a reload", async () => {
		const firstLoad = await loadOnboarding()
		firstLoad.setHomeOnboardingStepIndex(5)

		const secondLoad = await loadOnboarding()
		expect(secondLoad.getHomeOnboardingStepIndex()).toBe(0)
	})
})

describe("home onboarding reward gate", () => {
	it("only lets the automatic run open on an answer that includes the feature", async () => {
		const onboarding = await loadOnboarding()

		// Three of the five states leave every task reading as unfinished, and the gate has to tell
		// them apart. `idle` and `loading` have no answer yet, so opening now would show a dialog the
		// answer takes away a moment later; `unsupported` is the backend's own "this organization does
		// not have the feature" (`9300`/`9301`), where the dialog would open in a place the feature
		// does not exist. Only the two answers that have really arrived and do include the feature
		// may let the run through.
		expect(onboarding.canOpenAutomaticHomeOnboarding("idle")).toBe(false)
		expect(onboarding.canOpenAutomaticHomeOnboarding("loading")).toBe(false)
		expect(onboarding.canOpenAutomaticHomeOnboarding("unsupported")).toBe(false)

		expect(onboarding.canOpenAutomaticHomeOnboarding("ready")).toBe(true)
		// A fetch that never arrived is not the backend saying no: it is retried on the next mount,
		// so the tour is not denied to whoever was behind a bad connection at load time.
		expect(onboarding.canOpenAutomaticHomeOnboarding("failed")).toBe(true)
	})
})

describe("legacy entry points another layer still imports", () => {
	it("keeps `setNeedGuideTour` exported, and inert", async () => {
		const onboarding = await loadOnboarding()

		// `enterprise/src/layouts/BaseLayout` imports this by name when the "improve information"
		// modal closes. That file is served as-is on the enterprise build, so losing the export is
		// not a warning there — it is a dev-server-fatal `SyntaxError: … does not provide an export
		// named 'setNeedGuideTour'`, raised while the page is loading and nothing to do with the
		// caller. No one reads the localStorage flags it used to write any more, so what has to hold
		// is only this: the name resolves, and calling it changes nothing.
		expect(typeof onboarding.setNeedGuideTour).toBe("function")
		expect(onboarding.setNeedGuideTour(MAGIC_ID)).toBeUndefined()
	})
})

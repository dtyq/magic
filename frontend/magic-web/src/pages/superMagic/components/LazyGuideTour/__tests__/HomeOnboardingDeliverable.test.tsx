import { act, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

/**
 * One `t` for the whole file, for the same reason the other tour files keep one: the tour memoises
 * its callbacks on the translation function, so a fresh one per render would rebuild them on every
 * pass and send the anchor-waiting effect into a loop.
 *
 * The values come back with the key, which is what lets the progress label be asserted as the pair
 * the tour handed over. The wording itself lives in the locale files and is not this file's
 * business; what is, is that two steps are walked and that they are numbered 1 and 2.
 */
const { translate } = vi.hoisted(() => ({
	translate: (key: string, values?: Record<string, unknown>) =>
		values === undefined ? key : `${key}:${JSON.stringify(values)}`,
}))

const { analyticsReport } = vi.hoisted(() => ({ analyticsReport: vi.fn() }))
vi.mock("@/services/analytics", () => ({
	analyticsService: { report: analyticsReport },
}))

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		i18n: { language: "en_US" },
		t: translate,
	}),
}))

vi.mock("@/routes/hooks/useNavigate", () => ({ default: () => vi.fn() }))

vi.mock("@/stores/layout", () => ({
	sidebarStore: { collapsed: false, setCollapsed: vi.fn() },
}))

vi.mock("@/components/base/MagicToaster/utils", () => ({
	default: { info: vi.fn(), success: vi.fn(), error: vi.fn() },
}))

vi.mock("@/utils/pubsub", () => ({
	default: { publish: vi.fn(), subscribe: vi.fn() },
	PubSubEvents: { Set_Input_Message: "set-input-message" },
}))

vi.mock("@/pages/superMagic/utils/clawBrand", () => ({
	getClawBrandTranslationValues: () => ({}),
}))

/**
 * The two calls the manager loads on demand. Only the list is ever asked for here — the whole point
 * of this file's closing assertions is that completing a task is *not* one of them — but both are
 * stubbed so that an accidental call would be visible rather than a module-resolution failure.
 */
const { getOnboardingTasks, completeOnboardingTask } = vi.hoisted(() => ({
	getOnboardingTasks: vi.fn(),
	completeOnboardingTask: vi.fn(),
}))

vi.mock("@/apis/modules/onboarding", () => ({ getOnboardingTasks, completeOnboardingTask }))

const MAGIC_ID = "magic-guide-deliverable"

const ATTACHMENT_TITLE = "homeOnboarding.deliverable.attachment.title"
const SAVED_TITLE = "homeOnboarding.deliverable.saved.title"
const NEXT = "homeOnboarding.project.actions.next"
const FINISH = "homeOnboarding.deliverable.actions.finish"
const PREVIOUS = "homeOnboarding.actions.previous"

const markers: HTMLElement[] = []

/** A region of the page the tour measures, as the page publishes it. */
function publishAnchor(anchorName: string) {
	const marker = document.createElement("div")
	marker.setAttribute("data-guide-anchor", anchorName)
	document.body.appendChild(marker)
	markers.push(marker)
}

/**
 * The footer's primary action, by the handle the footer carries. Position is not a contract here:
 * "上一步" comes and goes with the step, and the wording behind the button changes with the locale.
 */
function primaryAction() {
	return screen.getByTestId("guide-tour-primary-action")
}

/** Whether the primary action carries the advance arrow, which is drawn as an icon beside it. */
function hasAdvanceArrow(button: HTMLElement) {
	return button.querySelector("svg") !== null
}

/** The progress label, as the tour reads it out of the locale file. */
function progressLabel(current: number, total: number) {
	return `homeOnboarding.stepLabel:${JSON.stringify({ current, total })}`
}

/** An account the backend still treats as new: its task list comes back with something in it. */
function backendStillListsTasks() {
	getOnboardingTasks.mockResolvedValue({
		tasks: [
			{
				code: "super_magic_intro",
				points: 50,
				validity_days: 7,
				status: "PENDING",
				reward_status: "PENDING",
				completed_at: null,
				reward_granted_at: null,
				expires_at: "2026-12-31T00:00:00Z",
			},
		],
	})
}

describe("home onboarding: the entry a click on a file a task delivered takes", () => {
	beforeEach(() => {
		vi.useFakeTimers()
		// The one-shot answer lives in storage, which jsdom keeps for the whole file.
		window.localStorage.clear()
		getOnboardingTasks.mockReset()
		completeOnboardingTask.mockReset()
	})

	afterEach(() => {
		vi.useRealTimers()
		markers.splice(0).forEach((marker) => marker.remove())
	})

	it("has nothing to offer until the backend has said the account is still new", async () => {
		vi.resetModules()
		const onboarding = await import("../GuideTourManager")
		onboarding.setHomeOnboardingUserMagicId(MAGIC_ID)
		backendStillListsTasks()

		/*
		 * The reward list is what answers "is this account still new", and it is asked for by the
		 * wrapper rather than by the click. A click that arrives before the answer must not open a
		 * tour on a guess — and, just as importantly, must not spend the one-shot flag on one.
		 */
		expect(onboarding.startHomeOnboardingDeliverableRunIfDue()).toBe(false)
		expect(onboarding.getHomeOnboardingFlow()).toBeNull()
		expect(onboarding.isHomeOnboardingDeliverableSpent(MAGIC_ID)).toBe(false)
	})

	it("opens the tour once the list is in, and remembers that it did — per account, per browser", async () => {
		vi.resetModules()
		const onboarding = await import("../GuideTourManager")
		onboarding.setHomeOnboardingUserMagicId(MAGIC_ID)
		backendStillListsTasks()
		await act(async () => {
			await onboarding.ensureHomeOnboardingRewardList(MAGIC_ID)
		})

		expect(onboarding.hasHomeOnboardingTasks(MAGIC_ID)).toBe(true)
		expect(onboarding.startHomeOnboardingDeliverableRunIfDue()).toBe(true)
		// The run is entered by a stored flow, which is what makes a mount nobody asked for visible.
		expect(onboarding.getHomeOnboardingFlow()).toBe("project-result")
		expect(onboarding.isHomeOnboardingDeliverableSpent(MAGIC_ID)).toBe(true)

		// A second click is not a second first look.
		expect(onboarding.startHomeOnboardingDeliverableRunIfDue()).toBe(false)

		/*
		 * Nor is a reload: the answer is in storage rather than beside the runtime state, which is
		 * memory-only. A fresh module registry is what a page load looks like from here.
		 */
		vi.resetModules()
		const reloaded = await import("../GuideTourManager")
		reloaded.setHomeOnboardingUserMagicId(MAGIC_ID)
		await act(async () => {
			await reloaded.ensureHomeOnboardingRewardList(MAGIC_ID)
		})
		expect(reloaded.hasHomeOnboardingTasks(MAGIC_ID)).toBe(true)
		expect(reloaded.startHomeOnboardingDeliverableRunIfDue()).toBe(false)
	})

	it("leaves alone an account whose list came back empty, and one whose list never came back", async () => {
		vi.resetModules()
		const onboarding = await import("../GuideTourManager")
		onboarding.setHomeOnboardingUserMagicId(MAGIC_ID)

		// The backend answered, and its answer is that this account has no tasks left.
		getOnboardingTasks.mockResolvedValue({ tasks: [] })
		await act(async () => {
			await onboarding.ensureHomeOnboardingRewardList(MAGIC_ID)
		})
		expect(onboarding.hasHomeOnboardingTasks(MAGIC_ID)).toBe(false)
		expect(onboarding.startHomeOnboardingDeliverableRunIfDue()).toBe(false)

		/*
		 * A list that never arrived is not the backend saying yes. The card can afford to be lenient
		 * about a failed fetch because a wrong answer there is a row that is missing; here it would
		 * be a tour in front of an account nobody asked about.
		 */
		vi.resetModules()
		const offline = await import("../GuideTourManager")
		offline.setHomeOnboardingUserMagicId("magic-guide-deliverable-offline")
		getOnboardingTasks.mockRejectedValue(new Error("offline"))
		await act(async () => {
			await offline.ensureHomeOnboardingRewardList("magic-guide-deliverable-offline")
		})
		expect(offline.hasHomeOnboardingTasks("magic-guide-deliverable-offline")).toBe(false)
		expect(offline.startHomeOnboardingDeliverableRunIfDue()).toBe(false)
	})

	it("does not answer for an account the hosting wrapper was never told about", async () => {
		vi.resetModules()
		const onboarding = await import("../GuideTourManager")
		backendStillListsTasks()
		await act(async () => {
			await onboarding.ensureHomeOnboardingRewardList(MAGIC_ID)
		})

		// The account is read from the wrapper, which has not published one here.
		expect(onboarding.getHomeOnboardingUserMagicId()).toBeUndefined()
		expect(onboarding.startHomeOnboardingDeliverableRunIfDue()).toBe(false)
		expect(onboarding.getHomeOnboardingFlow()).toBeNull()
	})
})

describe("home onboarding: the two steps a delivered file is framed by", () => {
	beforeEach(() => {
		vi.useFakeTimers()
		window.localStorage.clear()
		analyticsReport.mockClear()
	})

	afterEach(() => {
		vi.useRealTimers()
		markers.splice(0).forEach((marker) => marker.remove())
	})

	/**
	 * Both anchors are on the page: the block that was opened, and the project files area that
	 * block's file is filed under. Nothing here marks the file's own row in that area — the file is
	 * opened by the click *after* the tour's first step, so on the way through there usually is no
	 * such row, and the second step is not supposed to need one.
	 */
	async function startDeliverableRun() {
		vi.resetModules()
		const onboarding = await import("../GuideTourManager")
		const tour = await import("../HomeOnboardingTour")
		publishAnchor(onboarding.HomeOnboardingAnchor.DeliverableAttachment)
		publishAnchor(onboarding.HomeOnboardingAnchor.ProjectSider)
		onboarding.startHomeOnboardingDeliverableRun()
		render(<tour.default page="home" userMagicId={MAGIC_ID} />)
		return { onboarding, tour }
	}

	it("exposes each actually rendered result card once per run", async () => {
		const observations: Array<{
			callback: IntersectionObserverCallback
			target: Element | null
		}> = []
		vi.stubGlobal(
			"IntersectionObserver",
			vi.fn((callback: IntersectionObserverCallback) => {
				const observation = { callback, target: null as Element | null }
				observations.push(observation)
				return {
					disconnect: vi.fn(),
					observe: vi.fn((target: Element) => {
						observation.target = target
					}),
				}
			}),
		)
		const exposeLatest = () => {
			const observation = observations.at(-1)
			if (!observation?.target) throw new Error("Expected an observed onboarding step card")
			observation.callback(
				[
					{
						intersectionRatio: 1,
						isIntersecting: true,
						target: observation.target,
					} as IntersectionObserverEntry,
				],
				{} as IntersectionObserver,
			)
		}
		try {
			await startDeliverableRun()
			await act(async () => vi.advanceTimersByTime(32))
			act(exposeLatest)
			expect(analyticsReport).toHaveBeenCalledWith("onboarding_guide_step_exposure", {
				taskId: "first-ai-work",
				stepIndex: 9,
				isReplay: false,
			})
			await act(async () => fireEvent.click(primaryAction()))
			await act(async () => vi.advanceTimersByTime(32))
			act(exposeLatest)
			expect(analyticsReport).toHaveBeenCalledWith("onboarding_guide_step_exposure", {
				taskId: "first-ai-work",
				stepIndex: 10,
				isReplay: false,
			})
			fireEvent.click(screen.getByText(PREVIOUS))
			await act(async () => vi.advanceTimersByTime(32))
			act(exposeLatest)
			const step9Exposures = analyticsReport.mock.calls.filter(
				([event, payload]) =>
					event === "onboarding_guide_step_exposure" && payload.stepIndex === 9,
			)
			expect(step9Exposures).toHaveLength(1)
		} finally {
			vi.unstubAllGlobals()
		}
	})

	it("frames the file that was opened, then the copy the project keeps, over two numbered steps", async () => {
		const { onboarding } = await startDeliverableRun()

		/*
		 * The file first. It is what the click opened, so the copy gives it no wording of its own and
		 * it hands over with the plain advance action — arrow and all, because the two steps read as
		 * a pair and the first one says out loud that it is moving on.
		 */
		expect(screen.getByText(ATTACHMENT_TITLE)).toBeInTheDocument()
		expect(screen.getByText(progressLabel(1, 2))).toBeInTheDocument()
		expect(primaryAction().textContent).toBe(NEXT)
		expect(hasAdvanceArrow(primaryAction())).toBe(true)
		// The first step has nothing to go back to.
		expect(screen.queryByText(PREVIOUS)).not.toBeInTheDocument()

		await act(async () => {
			fireEvent.click(primaryAction())
		})
		expect(analyticsReport).toHaveBeenCalledWith("onboarding_guide_step_click", {
			taskId: "first-ai-work",
			stepIndex: 9,
			isReplay: false,
			action: "next",
			caseId: undefined,
		})

		/*
		 * Then where the project files it. It is the last step, so it closes the run — and the label
		 * says so in this tour's own words rather than the in-project tour's, which is part of a task
		 * and ends by naming that.
		 */
		expect(screen.getByText(SAVED_TITLE)).toBeInTheDocument()
		expect(screen.getByText(progressLabel(2, 2))).toBeInTheDocument()
		expect(primaryAction().textContent).toBe(FINISH)
		expect(hasAdvanceArrow(primaryAction())).toBe(false)
		expect(screen.getByText(PREVIOUS)).toBeInTheDocument()

		await act(async () => {
			fireEvent.click(primaryAction())
		})
		expect(analyticsReport).toHaveBeenCalledWith("onboarding_guide_step_click", {
			taskId: "first-ai-work",
			stepIndex: 10,
			isReplay: false,
			action: "complete",
			caseId: undefined,
		})

		// The run is over, and — unlike a task's flow — it reported nothing on the way out.
		expect(onboarding.getHomeOnboardingFlow()).toBeNull()
		expect(completeOnboardingTask).not.toHaveBeenCalled()
		expect(onboarding.getHomeOnboardingStatus(MAGIC_ID, "first-ai-work")).toBe("pending")
	})

	it("ends, recording nothing against a task, when the project files area itself is not there", async () => {
		vi.resetModules()
		const onboarding = await import("../GuideTourManager")
		const tour = await import("../HomeOnboardingTour")

		/*
		 * Only the block that was opened is marked. The files area is a region the project page
		 * always renders, so a page without it is a page the tour cannot be shown on rather than a
		 * step to walk past — and the run ends instead of waiting for something that is not coming.
		 *
		 * It is the second step, though, so the run has already been read by the time it ends: what
		 * this case is really about is that ending it costs nothing. This tour belongs to no task,
		 * so leaving it early must not record an abort against the task whose result was clicked.
		 */
		publishAnchor(onboarding.HomeOnboardingAnchor.DeliverableAttachment)
		onboarding.startHomeOnboardingDeliverableRun()
		render(<tour.default page="home" userMagicId={MAGIC_ID} />)

		expect(screen.getByText(ATTACHMENT_TITLE)).toBeInTheDocument()

		await act(async () => {
			fireEvent.click(primaryAction())
		})

		// Nothing to frame, so the step is held only for its grace period and then the run ends.
		await act(async () => {
			vi.advanceTimersByTime(3000)
		})

		expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
		expect(onboarding.getHomeOnboardingFlow()).toBeNull()
		expect(onboarding.getHomeOnboardingStatus(MAGIC_ID, "first-ai-work")).toBe("pending")
		expect(completeOnboardingTask).not.toHaveBeenCalled()
	})
})

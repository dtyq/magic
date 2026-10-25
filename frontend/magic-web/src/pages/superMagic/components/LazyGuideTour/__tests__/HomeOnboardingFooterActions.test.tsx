import { act, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

/**
 * The footer every run ends on, the handles it carries, and the move it names.
 *
 * The tour reads as seven flows of different lengths, but every step of them ends on one card with
 * one footer: the tasks' steps and the two in-project tours all close on "上一步" / "退出引导" / the
 * primary action, so a step never varies the control, only what it means. That is what makes the
 * handles worth having — and worth pinning. A spec that reached the primary action as "the last
 * button of the dialog", which is what these specs used to do, was reading a layout accident:
 * "上一步" is not on the first step at all. One that read the label was reading a translation.
 *
 * Three stages of a run are cards of their own and carry no footer — the case picker, the card shown
 * while the project is built, and the hand-over to the composer. The last of the three is pinned
 * below, because it is the reason `data-guide-action` has no reading for a send: the hand-over is
 * the page's own button to press, not a move the tour performs.
 *
 * `data-guide-action` is the other half, and the half the wording cannot supply. The label changes
 * with the locale and with the task, and the difference between closing a first pass and closing a
 * re-watch shows in the label *alone*. It is resolved beside that label and the arrow rather than
 * written out a third time (see `resolvePrimaryAction`), which is what keeps the three from drifting.
 * Its readings are the moves this footer makes: `next`, `finish` and `replay-finish`.
 *
 * One `t` for the whole file, as the other tour specs keep one: the tour memoises its callbacks on
 * the translation function, and a fresh one per render would send the anchor-waiting effect into a
 * loop.
 */
const { translate } = vi.hoisted(() => ({ translate: (key: string) => key }))

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		i18n: { language: "en_US" },
		t: translate,
	}),
}))

vi.mock("@/routes/hooks/useNavigate", () => ({ default: () => vi.fn() }))

vi.mock("@/services/analytics", () => ({ analyticsService: { report: vi.fn() } }))

vi.mock("@/stores/layout", () => ({
	sidebarStore: { collapsed: false, setCollapsed: vi.fn() },
}))

vi.mock("@/components/base/MagicToaster/utils", () => ({ default: { info: vi.fn() } }))

vi.mock("@/utils/pubsub", () => ({
	default: { publish: vi.fn(), subscribe: vi.fn() },
	PubSubEvents: { Set_Input_Message: "set-input-message" },
}))

vi.mock("@/pages/superMagic/utils/clawBrand", () => ({
	getClawBrandTranslationValues: () => ({}),
}))

const MAGIC_ID = "magic-guide-footer-actions"
const WORKBENCH = "workbench"

/** Where the footer keeps the three handles, and the attribute that names the primary action's move. */
const PREVIOUS = "guide-tour-previous"
const EXIT = "guide-tour-exit"
const PRIMARY = "guide-tour-primary-action"
const ACTION = "data-guide-action"

const markers: HTMLElement[] = []

/** A region of the page the tour measures, as the page publishes it. */
function publishAnchor(anchorName: string) {
	const marker = document.createElement("div")
	marker.setAttribute("data-guide-anchor", anchorName)
	document.body.appendChild(marker)
	markers.push(marker)
}

/** A fresh manager and tour, so one test's run cannot decide what the next one starts from. */
async function loadTour() {
	vi.resetModules()
	const onboarding = await import("../GuideTourManager")
	const tour = await import("../HomeOnboardingTour")
	return { onboarding, tour }
}

/** The move the primary action says it makes — the one reading of it that is not prose. */
function guideAction() {
	return screen.getByTestId(PRIMARY).getAttribute(ACTION)
}

/** The four anchors the workbench run walks, so every step finds its target on the frame it opens. */
function publishWorkbenchAnchors(onboarding: Awaited<ReturnType<typeof loadTour>>["onboarding"]) {
	publishAnchor(onboarding.HomeOnboardingAnchor.WorkspaceSidebar)
	publishAnchor(onboarding.HomeOnboardingAnchor.WorkspaceList)
	publishAnchor(onboarding.HomeOnboardingAnchor.RoleSwitcher)
	publishAnchor(onboarding.HomeOnboardingAnchor.MessageComposer)
}

/** Advances the primary action three times, which is the whole of a four-step run bar its close. */
async function advanceToTheLastStep() {
	for (let step = 0; step < 3; step += 1) {
		await act(async () => {
			fireEvent.click(screen.getByTestId(PRIMARY))
		})
	}
}

beforeEach(() => {
	vi.useFakeTimers()
})

afterEach(() => {
	vi.useRealTimers()
	markers.splice(0).forEach((marker) => marker.remove())
})

describe("home onboarding: the footer's handles", () => {
	it("hands every step of a run the same three handles", async () => {
		const { onboarding, tour } = await loadTour()
		publishWorkbenchAnchors(onboarding)

		onboarding.startHomeOnboarding(WORKBENCH, MAGIC_ID)
		render(<tour.default page="home" userMagicId={MAGIC_ID} />)

		/*
		 * The opening step has nowhere to go back to, so "上一步" is not on screen. That is precisely
		 * why the primary action cannot be located by position among the card's buttons.
		 */
		expect(screen.queryByTestId(PREVIOUS)).toBeNull()
		expect(screen.getByTestId(EXIT)).toBeInTheDocument()
		expect(screen.getByTestId(PRIMARY)).toBeInTheDocument()

		for (let step = 0; step < 3; step += 1) {
			await act(async () => {
				fireEvent.click(screen.getByTestId(PRIMARY))
			})

			// From the second step on the whole footer is present, and it is the same footer.
			expect(screen.getByTestId(PREVIOUS)).toBeInTheDocument()
			expect(screen.getByTestId(EXIT)).toBeInTheDocument()
			expect(screen.getByTestId(PRIMARY)).toBeInTheDocument()
		}
	})

	it("is the same footer inside a project, where the tour belongs to no task", async () => {
		const { onboarding, tour } = await loadTour()

		/*
		 * The in-project tour is opened where a task handed over, and its steps live on the project
		 * page — a different run, on a different page, reaching the user through the same footer.
		 */
		onboarding.startHomeOnboarding("first-ai-work", MAGIC_ID)
		onboarding.setHomeOnboardingFlow("project-file")
		publishAnchor(onboarding.HomeOnboardingAnchor.ProjectSider)

		render(<tour.default page="home" userMagicId={MAGIC_ID} />)

		expect(screen.queryByTestId(PREVIOUS)).toBeNull()
		expect(screen.getByTestId(EXIT)).toBeInTheDocument()
		expect(guideAction()).toBe("next")
	})

	it("is not the card that hands a run over to the composer", async () => {
		const { onboarding, tour } = await loadTour()

		/*
		 * The AI-work run ends by filling the prompt into the composer and pointing at the composer's
		 * own send button — the page presses it, not the tour. That stage is therefore a card of its
		 * own and wears no footer, which is why the attribute has no reading for a send to assert.
		 *
		 * The card is named rather than its screen merely searched, because a step still waiting for
		 * its anchor draws the one other dialog with no footer in it: a case that only asked for the
		 * three handles to be missing would pass on the waiting state as well.
		 */
		onboarding.startHomeOnboarding("first-ai-work", MAGIC_ID)
		onboarding.setHomeOnboardingFlow("prompt-ready")
		publishAnchor("message-editor-send-button")

		render(<tour.default page="home" userMagicId={MAGIC_ID} />)

		expect(
			screen.getByRole("dialog", { name: "homeOnboarding.featured.send.title" }),
		).toBeInTheDocument()
		expect(screen.queryByTestId(PREVIOUS)).toBeNull()
		expect(screen.queryByTestId(EXIT)).toBeNull()
		expect(screen.queryByTestId(PRIMARY)).toBeNull()
	})
})

describe("home onboarding: the move the primary action names", () => {
	it("reads as an advance while steps are left, and as the close on the last one", async () => {
		const { onboarding, tour } = await loadTour()
		publishWorkbenchAnchors(onboarding)

		onboarding.startHomeOnboarding(WORKBENCH, MAGIC_ID)
		render(<tour.default page="home" userMagicId={MAGIC_ID} />)

		expect(guideAction()).toBe("next")
		await advanceToTheLastStep()
		// The closing step pays the task's reward: a different move from the three that led to it.
		expect(guideAction()).toBe("finish")
	})

	it("reads a re-watch as a review rather than a first pass", async () => {
		const { onboarding, tour } = await loadTour()
		publishWorkbenchAnchors(onboarding)

		/*
		 * Same task, same steps, same footer — all that differs is that this account has already been
		 * paid for the task. Until the attribute existed that difference lived in the label alone, so
		 * nothing could assert it without asserting a translation.
		 */
		onboarding.startHomeOnboarding(WORKBENCH, MAGIC_ID, true)
		render(<tour.default page="home" userMagicId={MAGIC_ID} />)

		await advanceToTheLastStep()
		expect(guideAction()).toBe("replay-finish")
	})

	it("names the advance even where the step hands over with wording of its own", async () => {
		const { onboarding, tour } = await loadTour()

		/*
		 * The attribute reads the move and not the wording, and this is the flow where the two part
		 * company: the AI-PPT steps the copy gives a hand-over to say something else than "next" —
		 * and lose the arrow with it. The move they make is still the same one, which is the reading
		 * a test can hold on to where the label is both long and translated.
		 */
		publishAnchor(onboarding.HomeOnboardingAnchor.SlidesTemplateFeaturedCard)
		publishAnchor(onboarding.HomeOnboardingAnchor.SlidesTemplatesToolbar)
		publishAnchor(onboarding.HomeOnboardingAnchor.SlidesTemplatesPrompt)

		onboarding.startHomeOnboarding("create-ai-ppt")
		render(<tour.default page="slides-templates" userMagicId={MAGIC_ID} />)

		// The opening step is the one the copy leaves generic, so its label and the move agree.
		expect(screen.getByTestId(PRIMARY).textContent).toBe("homeOnboarding.actions.next")
		expect(guideAction()).toBe("next")

		// "使用搜索和分类缩小范围" walks the user on to the picks it has just named.
		await act(async () => {
			fireEvent.click(screen.getByTestId(PRIMARY))
		})
		expect(screen.getByTestId(PRIMARY).textContent).toBe(
			"homeOnboarding.aiPpt.steps.search.action",
		)
		expect(guideAction()).toBe("next")
	})
})

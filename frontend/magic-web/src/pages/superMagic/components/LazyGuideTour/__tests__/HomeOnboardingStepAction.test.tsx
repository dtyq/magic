import { act, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

/**
 * One `t` for the whole file, for the same reason `HomeOnboardingAnchorWait` keeps one: the tour
 * memoises its callbacks on the translation function, so a fresh one per render would rebuild them
 * on every pass and send the anchor-waiting effect into a loop. Handing back the key also lets the
 * assertions below be written as the keys the steps ask for, which is what this file is about — the
 * wording a step hands over with lives in the locale files, and only the wiring lives here.
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

const MAGIC_ID = "magic-guide-step-action"

const NEXT = "homeOnboarding.actions.next"
const FINISH = "homeOnboarding.aiPpt.actions.finish"
const FEATURED_TITLE = "homeOnboarding.aiPpt.steps.featured.title"
const SEARCH_TITLE = "homeOnboarding.aiPpt.steps.search.title"
const SEARCH_ACTION = "homeOnboarding.aiPpt.steps.search.action"
const PICK_TITLE = "homeOnboarding.aiPpt.steps.pick.title"
const PICK_ACTION = "homeOnboarding.aiPpt.steps.pick.action"
const PROMPT_TITLE = "homeOnboarding.aiPpt.steps.prompt.title"

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

/**
 * Whether the primary action carries the advance arrow. It is drawn as an icon beside the label, so
 * the label itself reads the same either way — the two have to be checked separately.
 */
function hasAdvanceArrow(button: HTMLElement) {
	return button.querySelector("svg") !== null
}

describe("home onboarding: the wording and the arrow each AI-PPT step hands over with", () => {
	beforeEach(() => {
		vi.useFakeTimers()
	})

	afterEach(() => {
		vi.useRealTimers()
		markers.splice(0).forEach((marker) => marker.remove())
	})

	it("lets the steps the copy gives their own wording name the hand-over, and only those", async () => {
		vi.resetModules()
		const onboarding = await import("../GuideTourManager")
		const tour = await import("../HomeOnboardingTour")

		/*
		 * The page has already done its part: a featured card is centred and marked, and the toolbar
		 * band and the panel below it are on screen. Every step therefore finds its anchor on the
		 * frame it opens, so what this walk exercises is the wording and nothing else.
		 */
		publishAnchor(onboarding.HomeOnboardingAnchor.SlidesTemplateFeaturedCard)
		publishAnchor(onboarding.HomeOnboardingAnchor.SlidesTemplatesToolbar)
		publishAnchor(onboarding.HomeOnboardingAnchor.SlidesTemplatesPrompt)

		onboarding.startHomeOnboarding("create-ai-ppt")
		render(<tour.default page="slides-templates" userMagicId={MAGIC_ID} />)

		// The opening step is the one the copy leaves generic — it hands over to the tour itself.
		expect(screen.getByText(FEATURED_TITLE)).toBeInTheDocument()
		expect(primaryAction().textContent).toBe(NEXT)
		/*
		 * The arrow is drawn beside the label, not inside it: it marks the plain advance action,
		 * so the generic step carries one and none of the three that follow do.
		 */
		expect(hasAdvanceArrow(primaryAction())).toBe(true)

		// "使用搜索和分类缩小范围" walks the user on to the picks it just talked about.
		await act(async () => {
			fireEvent.click(primaryAction())
		})
		expect(screen.getByText(SEARCH_TITLE)).toBeInTheDocument()
		expect(primaryAction().textContent).toBe(SEARCH_ACTION)
		expect(hasAdvanceArrow(primaryAction())).toBe(false)

		// "选择喜欢的模板开始制作" walks the user on to the request box.
		await act(async () => {
			fireEvent.click(primaryAction())
		})
		expect(screen.getByText(PICK_TITLE)).toBeInTheDocument()
		expect(primaryAction().textContent).toBe(PICK_ACTION)
		expect(hasAdvanceArrow(primaryAction())).toBe(false)

		/*
		 * The closing step takes the label the run's own state calls for rather than one of its own:
		 * a first pass names the reward. On a re-watch it reads as a review instead, which is why
		 * this one is asserted against the finish key and not a step key.
		 */
		await act(async () => {
			fireEvent.click(primaryAction())
		})
		expect(screen.getByText(PROMPT_TITLE)).toBeInTheDocument()
		expect(primaryAction().textContent).toBe(FINISH)
		expect(hasAdvanceArrow(primaryAction())).toBe(false)
	})
})

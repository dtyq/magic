import { act, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

/**
 * One `t` for the whole file: the tour's callbacks are memoised on it, exactly as they are on the
 * real translation function, so a fresh one per render would rebuild them on every pass and send
 * the anchor-waiting effect into a loop.
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

const MAGIC_ID = "magic-guide-anchor-wait"

const WAITING = "homeOnboarding.waiting"
const FEATURED_TITLE = "homeOnboarding.aiPpt.steps.featured.title"

let marker: HTMLElement | null = null

/**
 * The AI-PPT tour is the one run whose steps point at something the page builds while the step is
 * already up: the canvas is asked for a featured card, picks one, moves to it, and only marks it
 * once the move has finished. So its first step is the case where the anchor is not there when the
 * step begins and turns up a moment later.
 */
async function startAiPptRun() {
	vi.resetModules()
	const onboarding = await import("../GuideTourManager")
	const tour = await import("../HomeOnboardingTour")
	onboarding.startHomeOnboarding("create-ai-ppt")
	return { onboarding, tour }
}

/** The marker the canvas publishes over the card it centred, as the tour finds it. */
function publishFeaturedCardMarker(anchorName: string) {
	marker = document.createElement("div")
	marker.setAttribute("data-guide-anchor", anchorName)
	document.body.appendChild(marker)
}

describe("home onboarding: a step that waits for its anchor", () => {
	beforeEach(() => {
		vi.useFakeTimers()
	})

	afterEach(() => {
		vi.useRealTimers()
		marker?.remove()
		marker = null
	})

	it("keeps the step up once the anchor has arrived instead of stepping over it when the deadline comes due", async () => {
		const { onboarding, tour } = await startAiPptRun()

		render(<tour.default page="slides-templates" userMagicId={MAGIC_ID} />)

		// The step has nothing to frame yet, so the tour holds the user with the waiting overlay.
		expect(screen.getByText(WAITING)).toBeInTheDocument()

		// The page answers: it has found a card to centre and the move is under way.
		await act(async () => {
			onboarding.announceHomeOnboardingStepPrepared(0)
		})
		await act(async () => {
			vi.advanceTimersByTime(300)
		})

		// The marker appears over the card, a fraction of a second into the move.
		await act(async () => {
			publishFeaturedCardMarker(onboarding.HomeOnboardingAnchor.SlidesTemplateFeaturedCard)
		})

		expect(screen.getByText(FEATURED_TITLE)).toBeInTheDocument()

		// Well past the deadline the step was armed with while it waited.
		await act(async () => {
			vi.advanceTimersByTime(5000)
		})

		expect(screen.getByText(FEATURED_TITLE)).toBeInTheDocument()
		expect(onboarding.getHomeOnboardingStepIndex()).toBe(0)
	})
})

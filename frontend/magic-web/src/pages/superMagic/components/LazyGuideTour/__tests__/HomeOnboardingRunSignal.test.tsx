import { act, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

/**
 * A run's claim on the screen, which the benefits entry card stands aside for.
 *
 * Every card entry — 开始体验 as much as 回看 — opens a run, and so does a first visit on its own,
 * which is the half the card could never work out for itself: the introduction dialog belongs to a
 * run nobody asked the card for. So the tour reports, and what it has to report correctly is both
 * ends of the claim. A run that takes the screen and never gives it back hides the card for the
 * rest of the session; a run that never takes it leaves the card sitting behind an overlay.
 *
 * One `t` for the whole file, for the reason the other tour specs keep one: the tour memoises its
 * callbacks on the translation function, and a fresh one per render would send the anchor-waiting
 * effect into a loop.
 */
const { translate } = vi.hoisted(() => ({ translate: (key: string) => key }))

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

vi.mock("@/components/base/MagicToaster/utils", () => ({ default: { info: vi.fn() } }))

vi.mock("@/utils/pubsub", () => ({
	default: { publish: vi.fn(), subscribe: vi.fn() },
	PubSubEvents: { Set_Input_Message: "set-input-message" },
}))

vi.mock("@/pages/superMagic/utils/clawBrand", () => ({
	getClawBrandTranslationValues: () => ({}),
}))

const MAGIC_ID = "magic-guide-run-signal"

const WELCOME_TITLE = "homeOnboarding.welcome.title"
const WELCOME_CLOSE = "homeOnboarding.welcome.close"

/** A fresh manager and tour, so one test's run cannot decide what the next one starts from. */
async function loadTour() {
	vi.resetModules()
	const onboarding = await import("../GuideTourManager")
	const tour = await import("../HomeOnboardingTour")
	return { onboarding, tour }
}

describe("home onboarding: the screen a run claims", () => {
	beforeEach(() => {
		vi.useFakeTimers()
		analyticsReport.mockClear()
		/*
		 * The introduction is the one piece of state that outlives a page load, so it is storage
		 * rather than module memory — and jsdom keeps storage for the whole file. Clearing it is
		 * what makes each case here start from an account that has not been shown the dialog.
		 */
		window.localStorage.clear()
	})

	it("reports the introduction only after its dialog is visibly rendered", async () => {
		const { tour } = await loadTour()
		let callback: IntersectionObserverCallback | undefined
		let target: Element | undefined
		vi.stubGlobal(
			"IntersectionObserver",
			vi.fn((nextCallback: IntersectionObserverCallback) => {
				callback = nextCallback
				return {
					disconnect: vi.fn(),
					observe: vi.fn((nextTarget: Element) => {
						target = nextTarget
					}),
				}
			}),
		)

		render(<tour.default page="home" userMagicId={MAGIC_ID} />)
		await act(async () => vi.advanceTimersByTime(32))
		expect(analyticsReport).not.toHaveBeenCalled()
		if (!callback || !target) throw new Error("Expected the welcome dialog to be observed")
		const observedTarget = target
		act(() => {
			callback?.(
				[
					{
						intersectionRatio: 1,
						isIntersecting: true,
						target: observedTarget,
					} as IntersectionObserverEntry,
				],
				{} as IntersectionObserver,
			)
		})

		expect(analyticsReport).toHaveBeenCalledTimes(1)
		expect(analyticsReport).toHaveBeenCalledWith("onboarding_guide_popup_exposure", {
			participantType: undefined,
		})
	})

	afterEach(() => {
		vi.useRealTimers()
		vi.unstubAllGlobals()
	})

	it("claims the screen for the introduction dialog and gives it back when declined", async () => {
		const { onboarding, tour } = await loadTour()

		// Nothing is up before a tour is, and nothing has claimed anything either: the flag follows
		// a run that is painting, not a run that might.
		expect(onboarding.isHomeOnboardingRunActive()).toBe(false)

		// A first visit: no card entry, no stored step — the run is the automatic one, and it is its
		// dialog.
		render(<tour.default page="home" userMagicId={MAGIC_ID} />)

		expect(screen.getByText(WELCOME_TITLE)).toBeInTheDocument()
		expect(onboarding.isHomeOnboardingRunActive()).toBe(true)

		/*
		 * Being on screen is what spends it, before anything is clicked. A user who reloads with the
		 * dialog still up, or who walks off to another route and comes back, has been shown it just
		 * the same, and neither may be met with it again.
		 */
		expect(onboarding.isHomeOnboardingIntroSpent(MAGIC_ID)).toBe(true)

		await act(async () => {
			fireEvent.click(screen.getByLabelText(WELCOME_CLOSE))
		})

		expect(screen.queryByText(WELCOME_TITLE)).toBeNull()
		expect(onboarding.isHomeOnboardingRunActive()).toBe(false)
	})

	it("claims the screen for a run entered from the card, and releases it when the run goes", async () => {
		const { onboarding, tour } = await loadTour()

		// Asking for a run is not the same as one being up: the tour is what paints, and it is what
		// speaks for it.
		onboarding.startHomeOnboarding("workbench", MAGIC_ID)
		expect(onboarding.isHomeOnboardingRunActive()).toBe(false)

		const { unmount } = render(<tour.default page="home" userMagicId={MAGIC_ID} />)
		expect(onboarding.isHomeOnboardingRunActive()).toBe(true)

		/*
		 * A run left by unmounting rather than by closing — the tour is re-mounted on each route of
		 * a run that spans pages, and a wrapper that unmounts with its route leaves no overlay
		 * behind. The card has to come back for that, or the session loses it.
		 */
		unmount()
		expect(onboarding.isHomeOnboardingRunActive()).toBe(false)
	})

	it("claims nothing on a mount that asked for nothing and has nothing to show", async () => {
		const { onboarding, tour } = await loadTour()

		// The introduction has already been shown to this account: from here the tasks are entered
		// from the card, and a later remount — a route change back to the home page — must neither
		// start one nor claim the screen for it. A claim left standing here would keep the card
		// hidden for good.
		onboarding.spendHomeOnboardingIntro(MAGIC_ID)
		render(<tour.default page="home" userMagicId={MAGIC_ID} />)

		expect(screen.queryByText(WELCOME_TITLE)).toBeNull()
		expect(onboarding.isHomeOnboardingRunActive()).toBe(false)
	})
})

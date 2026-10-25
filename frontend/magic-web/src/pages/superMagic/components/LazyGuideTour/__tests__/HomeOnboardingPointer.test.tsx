import { act, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

/**
 * The pointer that joins the step card to the control a step is about.
 *
 * It is drawn as a `::before` triangle on the card, so where it sits lives in the card's own style
 * as `--guide-arrow-x` / `--guide-arrow-y` and the `before:` rules read it from there. What this
 * file pins is that the pointer names the anchor: it used to sit at the card's middle, which only
 * coincides with the anchor while the window has room to centre the card on it — and the two
 * entries of the recordings list sit at the left of a toolbar, where it never does.
 *
 * One `t` for the whole file, for the reason the other tour specs keep one: the tour memoises its
 * callbacks on the translation function, and a fresh one per render would send the anchor-waiting
 * effect into a loop.
 */
const { translate } = vi.hoisted(() => ({ translate: (key: string) => key }))

vi.mock("react-i18next", () => ({
	useTranslation: () => ({ i18n: { language: "en_US" }, t: translate }),
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

const MAGIC_ID = "magic-guide-pointer"

/** How far the pointer keeps clear of the card's corners, as the tour defines it. */
const ARROW_INSET = 24

/** A box as the page's own layout would report it. */
interface AnchorBox {
	left: number
	top: number
	width: number
	height: number
}

const markers: HTMLElement[] = []

/**
 * A control of the page, as the page publishes it. jsdom lays nothing out — every box reads as
 * zeroes — so a test that cares where the anchor is hands the tour its box directly, which is what
 * the tour measures anyway.
 */
function publishAnchor(anchorName: string, box: AnchorBox) {
	const marker = document.createElement("div")
	marker.setAttribute("data-guide-anchor", anchorName)
	marker.getBoundingClientRect = () =>
		({
			...box,
			right: box.left + box.width,
			bottom: box.top + box.height,
			x: box.left,
			y: box.top,
			toJSON: () => box,
		}) as DOMRect
	document.body.appendChild(marker)
	markers.push(marker)
}

/** The step card, found by the title it carries rather than by a positional selector. */
function cardFor(titleKey: string) {
	const card = screen.getByText(titleKey).closest("section")
	if (!card) throw new Error("the step card was not rendered")
	return card as HTMLElement
}

/** Where along the card's edge the pointer is drawn, in the card's own coordinates. */
function pointerOffset(card: HTMLElement, axis: "x" | "y") {
	return Number.parseFloat(card.style.getPropertyValue(`--guide-arrow-${axis}`))
}

function cardGeometry(card: HTMLElement) {
	return {
		left: Number.parseFloat(card.style.left),
		top: Number.parseFloat(card.style.top),
		width: Number.parseFloat(card.style.width),
	}
}

/** The footer's primary action, by the handle the footer carries, as in the other tour specs. */
function primaryAction() {
	return screen.getByTestId("guide-tour-primary-action")
}

describe("home onboarding: the step pointer names the anchor, not the card", () => {
	beforeEach(() => {
		vi.useFakeTimers()
	})

	afterEach(() => {
		vi.useRealTimers()
		markers.splice(0).forEach((marker) => marker.remove())
	})

	it("follows an anchor the card could not be centred on", async () => {
		vi.resetModules()
		const onboarding = await import("../GuideTourManager")
		const tour = await import("../HomeOnboardingTour")

		/*
		 * The recordings list's first entry sits at the left of its toolbar — the real one starts
		 * about 40px in. A 400px card centred on it would hang off the window, so it is pulled back
		 * to the margin instead, and a pointer left at the card's middle lands on the gap beside
		 * the button rather than on the button.
		 */
		const ANCHOR: AnchorBox = { left: 40, top: 36, width: 245, height: 44 }
		publishAnchor(onboarding.HomeOnboardingAnchor.AudioRecordingsStart, ANCHOR)

		onboarding.startHomeOnboarding("audio-recording")
		render(<tour.default page="recordings" userMagicId={MAGIC_ID} />)

		const card = cardFor("homeOnboarding.audioRecording.steps.start.title")
		const { left, width } = cardGeometry(card)
		const anchorCentreX = ANCHOR.left + ANCHOR.width / 2

		// The card really did end up somewhere other than on its anchor — which is the situation
		// the pointer has to cope with, and the one the card's middle gets wrong.
		expect(left).not.toBeCloseTo(anchorCentreX - width / 2)

		// The pointer is over the anchor, not over the card's middle.
		expect(pointerOffset(card, "x")).toBeCloseTo(anchorCentreX - left)
		expect(pointerOffset(card, "x")).not.toBeCloseTo(width / 2)

		// The wiring the offset travels along: the rule reads the property and falls back to the
		// card's middle for the narrow window where the card is pinned to the bottom of the screen.
		expect(card.className).toContain("before:left-[var(--guide-arrow-x,50%)]")
	})

	it("keeps the pointer on the card's straight edge when the anchor hugs a corner", async () => {
		vi.resetModules()
		const onboarding = await import("../GuideTourManager")
		const tour = await import("../HomeOnboardingTour")

		// An anchor at the very left edge would put the pointer inside the card's rounded corner,
		// where it stops reading as part of the card at all.
		publishAnchor(onboarding.HomeOnboardingAnchor.AudioRecordingsStart, {
			left: 0,
			top: 20,
			width: 44,
			height: 40,
		})

		onboarding.startHomeOnboarding("audio-recording")
		render(<tour.default page="recordings" userMagicId={MAGIC_ID} />)

		const card = cardFor("homeOnboarding.audioRecording.steps.start.title")
		const { left } = cardGeometry(card)

		// The projection really is inside the corner — otherwise this would only re-test the case above.
		expect(44 / 2 - left).toBeLessThan(ARROW_INSET)
		expect(pointerOffset(card, "x")).toBe(ARROW_INSET)
	})

	it("follows the anchor on the vertical edge too, for a step that opens beside it", async () => {
		vi.resetModules()
		const onboarding = await import("../GuideTourManager")
		const tour = await import("../HomeOnboardingTour")

		/*
		 * The skill library's fourth step opens to the left of the "我的技能" entry — a side
		 * placement, so its pointer runs along the card's vertical edge and has to name the entry
		 * the same way. The entry is placed low enough that the card is clamped against the bottom
		 * margin rather than centred on it, which is when the two disagree.
		 */
		publishAnchor(onboarding.HomeOnboardingAnchor.SkillMarketSearch, {
			left: 40,
			top: 36,
			width: 240,
			height: 40,
		})
		publishAnchor(onboarding.HomeOnboardingAnchor.SkillMarketCard, {
			left: 60,
			top: 140,
			width: 320,
			height: 260,
		})
		publishAnchor(onboarding.HomeOnboardingAnchor.SkillMarketCardAdd, {
			left: 340,
			top: 152,
			width: 28,
			height: 28,
		})
		const MY_SKILLS: AnchorBox = { left: 700, top: 630, width: 120, height: 100 }
		publishAnchor(onboarding.HomeOnboardingAnchor.SkillMarketMySkills, MY_SKILLS)

		onboarding.startHomeOnboarding("manage-skill")
		render(<tour.default page="skill-market" userMagicId={MAGIC_ID} />)

		for (let step = 0; step < 3; step += 1) {
			await act(async () => {
				fireEvent.click(primaryAction())
			})
		}

		const card = cardFor("homeOnboarding.skill.steps.mySkills.title")
		const { top } = cardGeometry(card)
		const anchorCentreY = MY_SKILLS.top + MY_SKILLS.height / 2

		/*
		 * The entry sits 168px down the card while the card's own middle is about 120px — the two
		 * are only equal when the card is centred on its anchor, which the bottom margin did not
		 * leave room for. So this fails if the pointer goes back to the card's middle.
		 */
		expect(pointerOffset(card, "y")).toBeCloseTo(anchorCentreY - top)
		expect(card.className).toContain("before:top-[var(--guide-arrow-y,50%)]")
	})
})

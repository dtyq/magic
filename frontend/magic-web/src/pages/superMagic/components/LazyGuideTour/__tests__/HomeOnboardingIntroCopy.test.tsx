import { render, screen, within } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

/**
 * What the two dialogs of the guided run say, and what they have stopped saying.
 *
 * Both of these are subtractions, and a subtraction is invisible to every other kind of test: the
 * flow is unchanged, the run still starts, the card still appears — one line of explanation and one
 * badge are simply no longer drawn, and nothing in the suite would notice them coming back.
 *
 * So what is pinned here is the absence itself, and pinned to the structure rather than to the
 * words. The introduction's three rows are titles and nothing else — each row is checked to hold
 * its title and to hold no explanation at all, which is stronger than checking one string is gone:
 * a re-added description under any key fails the same way. The "prompt ready" card is checked to
 * have its title as a direct child of the card, because the badge was never a stray line — it was a
 * second column, and the row that held it is the thing that had to go.
 *
 * One `t` for the whole file, as the other tour specs keep one: the tour memoises its callbacks on
 * the translation function, and a fresh one per render would send the anchor-waiting effect into a
 * loop.
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

const MAGIC_ID = "magic-guide-intro-copy"

const WELCOME_TITLE = "homeOnboarding.welcome.title"
const WELCOME_SUBTITLE = "homeOnboarding.welcome.subtitle"

/** The three promises of the introduction, in the order the task walks them. */
const GOAL_TITLES = [
	"homeOnboarding.welcome.goals.task.title",
	"homeOnboarding.welcome.goals.send.title",
	"homeOnboarding.welcome.goals.result.title",
]

const SEND_TITLE = "homeOnboarding.featured.send.title"
const SEND_BADGE = "homeOnboarding.featured.send.badge"

interface Box {
	left: number
	top: number
	width: number
	height: number
}

/** The composer and the send button, as the page lays them out. */
const COMPOSER: Box = { left: 60, top: 300, width: 820, height: 100 }
const SEND: Box = { left: 950, top: 420, width: 44, height: 44 }

const markers: HTMLElement[] = []

/** A region of the page the tour measures, handed its box — jsdom lays nothing out. */
function publishAnchor(anchorName: string, box: Box) {
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

/**
 * A fresh first visit: nothing asked for the run, no step to resume, and an account that has not
 * been shown the introduction. That is exactly the state the dialog opens in — and only that one.
 */
async function openIntroduction() {
	vi.resetModules()
	const tour = await import("../HomeOnboardingTour")
	render(<tour.default page="home" userMagicId={MAGIC_ID} />)
	expect(screen.getByText(WELCOME_TITLE)).toBeInTheDocument()
	return screen.getByRole("dialog")
}

/**
 * Puts the run on the prompt-ready step — the card that carries the badge — with both of its
 * anchors on screen, so the step is the one being painted rather than the overlay that waits.
 */
async function openPromptReadyStep() {
	vi.resetModules()
	const onboarding = await import("../GuideTourManager")
	const tour = await import("../HomeOnboardingTour")
	onboarding.startHomeOnboarding("first-ai-work", MAGIC_ID)
	onboarding.setHomeOnboardingFlow("prompt-ready")
	publishAnchor(onboarding.HomeOnboardingAnchor.MessageEditorContent, COMPOSER)
	// The send button's anchor is a literal in the step rather than a member of the enum.
	publishAnchor("message-editor-send-button", SEND)
	render(<tour.default page="home" userMagicId={MAGIC_ID} />)
	const dialog = screen.getByRole("dialog")
	expect(within(dialog).getByText(SEND_TITLE)).toBeInTheDocument()
	return dialog
}

describe("home onboarding: what the introduction and the send card stopped saying", () => {
	beforeEach(() => {
		vi.useFakeTimers()
		window.localStorage.clear()
	})

	afterEach(() => {
		vi.useRealTimers()
		markers.splice(0).forEach((marker) => marker.remove())
	})

	it("lists the three promises of the introduction as titles, with no explanation under them", async () => {
		const dialog = await openIntroduction()

		/*
		 * The dialog's own subtitle stays — it is the one line that says what the run is for, and
		 * the rows below it read as the three steps of it. What is gone is the explanation each row
		 * carried, which made three scannable items into three paragraphs.
		 */
		expect(within(dialog).getByText(WELCOME_SUBTITLE)).toBeInTheDocument()

		const rows = within(dialog).getAllByRole("listitem")
		expect(rows).toHaveLength(GOAL_TITLES.length)

		for (const [index, row] of rows.entries()) {
			// The title, and the title alone: no `small`, no description, no second line at all.
			expect(row.querySelector("strong")?.textContent).toBe(GOAL_TITLES[index])
			expect(row.querySelector("small")).toBeNull()
			expect(row.textContent).not.toContain("description")
		}

		// And the keys the rows used to ask for are not asked for anywhere in the dialog.
		expect(dialog.textContent).not.toContain("homeOnboarding.welcome.goals.task.description")
		expect(dialog.textContent).not.toContain("homeOnboarding.welcome.goals.send.description")
		expect(dialog.textContent).not.toContain("homeOnboarding.welcome.goals.result.description")
	})

	it("draws the send card's title on its own, with no badge beside it", async () => {
		const dialog = await openPromptReadyStep()

		const heading = within(dialog).getByText(SEND_TITLE)
		/*
		 * The badge was not a stray line beside the heading — it was a second column of a two-column
		 * header row, and the heading was inside that row. Now the heading is a direct child of the
		 * card, which is what says the row itself is gone rather than merely emptied.
		 */
		expect(heading.tagName).toBe("H3")
		expect(heading.parentElement?.tagName).toBe("SECTION")

		expect(within(dialog).queryByText(SEND_BADGE)).toBeNull()
		expect(dialog.textContent).not.toContain("homeOnboarding.featured.send.badge")
	})
})

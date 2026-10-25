import { act, render, screen, within } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

/**
 * The step that frames an anchor the page is still animating in.
 *
 * An anchor being on screen is not the same as an anchor being in place. The micro-app page brings
 * its composer in with a transform — the card rises its last 20px over the second after it mounts —
 * so the one measurement the tour used to take when the anchor turned up left the mask and its card
 * sitting where the composer started, a fifth of a card's height below where it ended.
 *
 * What this file pins is that the box is followed frame by frame until it holds still, that the
 * highlight is then exactly on the anchor rather than easing after it, and — the other half of the
 * same promise — that the follow is bounded, so a page that animates its anchor on purpose cannot
 * make the guide chase it forever.
 *
 * And, with more care than either of those, that the page's own delay is waited out. The entrance
 * is armed with a fifth of a second of stillness before it moves at all, and a follow that ends on
 * stillness alone lets go of the anchor inside it and keeps the position it happened to catch —
 * which is why the first attempt at following the anchor changed nothing on the page it was written
 * for, and why the animation here is modelled with its delay, its length and its decelerating curve
 * rather than as something that starts moving on the first frame.
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

const MAGIC_ID = "magic-guide-anchor-follow"

const STEP_TITLE = "homeOnboarding.microApp.steps.prompt.title"

/** How long the tour follows an anchor of its own accord, as it defines it. */
const FOLLOW_TIMEOUT_MS = 2000

/** The frame length the follow is measured in, and the step the fake clock takes with it. */
const FRAME_MS = 16

/**
 * The composer's entrance, as the page really runs it: 20px over 800ms — 48 frames — behind a
 * fifth of a second of delay, in which the page is perfectly still. The delay is the part worth
 * writing down: it is what a follow that ends on stillness alone mistakes for an anchor in place.
 */
const RISE_TOP = 400
const RISE_PX = 20
const RISE_DELAY_FRAMES = 12
const RISE_FRAMES = 48

/**
 * How far the composer has risen `elapsed` frames into its move, on the hard decelerating curve
 * the page asks for. Most of the distance goes in the first third and the rest creeps in deltas
 * of a fraction of a pixel — which is why a still test with any tolerance in it hears the curve
 * stop moving long before it has.
 */
function riseSize(elapsed: number) {
	return RISE_PX * (1 - Math.pow(1 - elapsed / RISE_FRAMES, 5))
}

interface Box {
	left: number
	top: number
	width: number
	height: number
}

/**
 * The page's frames, held rather than run.
 *
 * The follow is a frame loop, and `vi.useFakeTimers` does not take `requestAnimationFrame` with it
 * by default — so a test that advanced the clock would leave the loop it is testing unrun. Holding
 * the callbacks lets a test take one frame at a time, in step with the clock the follow's deadline
 * is measured on.
 */
const frames: FrameRequestCallback[] = []
const nativeFrames = {
	request: window.requestAnimationFrame.bind(window),
	cancel: window.cancelAnimationFrame.bind(window),
}

/** One frame of the follow, with the clock moving as a frame would move it. */
async function frame() {
	const queued = frames.splice(0)
	await act(async () => {
		vi.advanceTimersByTime(FRAME_MS)
		queued.forEach((callback) => callback(0))
	})
}

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
	return marker
}

/**
 * The box the step draws around its anchor — the highlight itself. It is the overlay's own ring:
 * the one element the tour positions from the measured box rather than from the card's geometry.
 */
function highlight(dialog: HTMLElement) {
	const ring = dialog.querySelector<HTMLElement>(".z-\\[1201\\]")
	if (!ring) throw new Error("the highlight was not rendered")
	return ring
}

/** Where the highlight's top edge is, which is four pixels above the anchor's own. */
function highlightTop(dialog: HTMLElement) {
	return Number.parseFloat(highlight(dialog).style.top)
}

/** Whether the highlight is still easing towards its anchor rather than sitting on it. */
function highlightEases(dialog: HTMLElement) {
	return highlight(dialog).className.includes("transition-[left,top,width,height]")
}

/**
 * The micro-app run, on the step that frames the composer. The composer is the page's own: what it
 * does with it after mount is what this file is about.
 */
async function startComposerStep(box: Box) {
	vi.resetModules()
	const onboarding = await import("../GuideTourManager")
	const tour = await import("../HomeOnboardingTour")
	onboarding.startHomeOnboarding("create-micro-app", MAGIC_ID)
	const marker = publishAnchor(onboarding.HomeOnboardingAnchor.MessageEditorContent, box)
	render(<tour.default page="micro-apps" userMagicId={MAGIC_ID} />)
	return { dialog: screen.getByRole("dialog"), marker }
}

describe("home onboarding: a step whose anchor is still on its way in", () => {
	beforeEach(() => {
		vi.useFakeTimers()
		window.localStorage.clear()
		window.requestAnimationFrame = (callback) => frames.push(callback)
		window.cancelAnimationFrame = vi.fn()
	})

	afterEach(() => {
		vi.useRealTimers()
		frames.splice(0)
		window.requestAnimationFrame = nativeFrames.request
		window.cancelAnimationFrame = nativeFrames.cancel
		document
			.querySelectorAll('[data-guide-anchor="message-editor-content"]')
			.forEach((anchor) => anchor.remove())
	})

	it("follows the anchor the page is still bringing in, and stops when it holds still", async () => {
		// The composer as the entrance animation starts: 20px low, on its way up over the next
		// second — 4px a frame at this test's scale, which is what makes the moves observable.
		const box: Box = { left: 300, top: 400, width: 640, height: 120 }
		const { dialog } = await startComposerStep(box)

		expect(within(dialog).getByText(STEP_TITLE)).toBeInTheDocument()
		// The highlight is on the composer as it is now, four pixels of ring included.
		expect(highlightTop(dialog)).toBe(396)

		/*
		 * And it holds no easing while it follows: a transition against a moving target is a second
		 * animation on the same pixels, and the lag it leaves is the misalignment this fixes.
		 */
		expect(highlightEases(dialog)).toBe(false)

		for (let moved = 0; moved < 5; moved += 1) {
			box.top -= 4
			await frame()
			expect(highlightTop(dialog)).toBe(box.top - 4)
		}

		// The page's animation is over. Three frames later the follow has ended — and the highlight
		// has its easing back, which is what a step change moves along.
		await frame()
		expect(highlightEases(dialog)).toBe(false)
		await frame()
		await frame()
		expect(highlightEases(dialog)).toBe(true)
		expect(highlightTop(dialog)).toBe(376)
	})

	it("waits out an anchor's delay instead of settling it where the wait found it", async () => {
		const box: Box = { left: 300, top: RISE_TOP, width: 640, height: 120 }
		const { dialog } = await startComposerStep(box)

		/*
		 * The page is still for the whole of the entrance's delay — twelve frames in which the
		 * anchor has not moved and never will be seen to have moved if the follow lets go of it
		 * here. It does not: the wait is a fifth of a second, and a fifth of a second of stillness
		 * is not news.
		 */
		for (let idle = 0; idle < RISE_DELAY_FRAMES; idle += 1) await frame()
		expect(highlightTop(dialog)).toBe(RISE_TOP - 4)

		// Then the composer rises. The highlight rides it frame for frame...
		for (let elapsed = 1; elapsed <= RISE_FRAMES; elapsed += 1) {
			box.top = RISE_TOP - riseSize(elapsed)
			await frame()
			if (elapsed === 12 || elapsed === 24) {
				expect(highlightTop(dialog)).toBe(box.top - 4)
			}
		}

		/*
		 * ...and the curve's own tail, which arrives in deltas too small for a tolerance-based
		 * still test to hear, is followed to within a fraction of a pixel. The bug this replaces
		 * ends 20px below here, and a still test with half a pixel of tolerance in it two or three
		 * — both of them a visible edge of the composer's card outside the frame around it.
		 */
		expect(highlightTop(dialog)).toBeCloseTo(RISE_TOP - RISE_PX - 4, 0)
		expect(highlightEases(dialog)).toBe(true)
	})

	it("stops following an anchor that never holds still", async () => {
		const box: Box = { left: 300, top: 400, width: 640, height: 120 }
		const { dialog } = await startComposerStep(box)

		// A page animating its anchor on purpose. The guide keeps up while it may...
		const framesWithinDeadline = Math.ceil(FOLLOW_TIMEOUT_MS / FRAME_MS) - 1
		for (let moved = 0; moved < framesWithinDeadline; moved += 1) {
			box.top += 1
			await frame()
		}
		expect(highlightTop(dialog)).toBe(box.top - 4)

		/*
		 * The frame that brings the deadline due is the last one it follows: the move is taken, and
		 * the loop ends there...
		 */
		box.top += 40
		await frame()
		const givenUpAt = highlightTop(dialog)

		/*
		 * ...so well past the deadline the anchor moves on and the highlight does not. This is what
		 * keeps the guide from becoming a long-lived frame poll of a page it cannot keep up with.
		 */
		for (let moved = 0; moved < 10; moved += 1) {
			box.top += 40
			await frame()
		}
		expect(highlightTop(dialog)).toBe(givenUpAt)
		expect(highlightEases(dialog)).toBe(true)
	})
})

import { act, render, screen, within } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

/**
 * The cut-out over the composer, and the margin the prompt is read from inside it.
 *
 * The anchor this step measures wraps the editable area and nothing else — the padding that keeps
 * the prompt off the card's edge belongs to the element around it. A cut-out drawn on the anchor
 * alone therefore clips the text flush to its own edge: on screen the first character of the
 * prefilled prompt begins exactly where the highlight begins, which reads as the highlight having
 * eaten the margin the composer was drawn with.
 *
 * What this file pins is the shape of the box that fixes that: the prompt's own box grown by the
 * composer's padding, and the growth is real rather than cosmetic — the band it adds is reachable,
 * so it is the mask and the cover moving together and not one of them drawn a size the other
 * disagrees with.
 *
 * The box is taken from two places, and the fixtures are built so that mixing them up cannot pass.
 * The sides come from the editor's viewport, which spans the card; the top and bottom come from the
 * prompt itself, which does not. The viewport in the fixtures is much taller than the prompt and
 * sits below the composer's top padding, so a cut-out grown from the viewport on both axes is a
 * visibly different rectangle — and the one that would land on the toolbar.
 *
 * The padding is expected to be read from the composer, not written down: the three sizes the
 * composer is drawn at pad themselves differently, so a number baked into the tour would be right
 * at one size and wrong at the others. The case below pads the composer with two different values
 * on the two axes for that reason — a single value would pass a hard-coded one too.
 *
 * And, as much as either of those, that the growth is conditional. A page with no composer, or one
 * whose composer does not hold this editor, gets the plain box back: the anchor is what the step is
 * really about, and a missing composer is not a failed step.
 *
 * Last, that the box is taken again when the prompt is edited. The step arrived with a frame for the
 * prompt as it was, and the user is free to change that prompt before sending — which they are told
 * to do, since the copy asks them to look at what was filled in. The frame has to be re-taken for
 * the new text, and the honest way to test that is with the one signal such an edit really sends:
 * the document. Nothing else in the fixture moves, because nothing else in the page does either —
 * the editor keeps the room of the lines a prompt may still grow into, so the wrap of one more line
 * changes the text and no box at all.
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

const MAGIC_ID = "magic-guide-composer-hole"

const SEND_TITLE = "homeOnboarding.featured.send.title"

/** The step the flow would already be on, so the mount lands straight in it. */
const PROMPT_READY = "prompt-ready"

/**
 * The composer's padding, as the card declares it — and deliberately different on the two axes, so
 * that a tour which grew the box by one number instead of by the four it read cannot pass.
 */
const PAD_X = 12
const PAD_Y = 10

interface Box {
	left: number
	top: number
	width: number
	height: number
}

/** The card. Its own box is wider and taller than the cut-out, which is the point of the case. */
const COMPOSER: Box = { left: 60, top: 300, width: 820, height: 120 }

/**
 * The editable area's viewport: the anchor the step measures. It spans the card's width, which is
 * where the cut-out's sides come from, and it is far taller than the prompt inside it, which is the
 * shape a cut-out grown from the viewport on both axes would wear.
 */
const EDITOR: Box = { left: 60 + PAD_X, top: 300 + PAD_Y, width: 820 - PAD_X * 2, height: 90 }

/**
 * The prompt itself: one line at the top of the viewport. Its own box is what the cut-out's top and
 * bottom are taken from, so it is deliberately nothing like the viewport's.
 */
const PROMPT: Box = { left: EDITOR.left, top: EDITOR.top + 2, width: EDITOR.width, height: 20 }

/** The send button in the toolbar below: the step's other cut-out. */
const SEND: Box = { left: 950, top: 440, width: 44, height: 44 }

const markers: HTMLElement[] = []

/** jsdom lays nothing out, so a box is whatever the fixture says it is — and the fixture can change. */
function setBox(element: HTMLElement, box: Box) {
	element.getBoundingClientRect = () =>
		({
			...box,
			right: box.left + box.width,
			bottom: box.top + box.height,
			x: box.left,
			y: box.top,
			toJSON: () => box,
		}) as DOMRect
}

/** A region of the page the tour measures, handed its box — jsdom lays nothing out. */
function boxedWith(box: Box, className?: string) {
	const marker = document.createElement("div")
	if (className) marker.className = className
	setBox(marker, box)
	markers.push(marker)
	return marker
}

/** The same, published under a guide anchor — what the tour goes looking for. */
const boxed = (anchorName: string, box: Box) => {
	const marker = boxedWith(box)
	marker.setAttribute("data-guide-anchor", anchorName)
	return marker
}

/**
 * The composer as the page builds it: the card with its padding declared, the editable viewport
 * inside it, the editor's surface inside that, and the prompt's blocks inside the surface.
 *
 * The padding is inline so that it is what `getComputedStyle` reports — jsdom loads no stylesheets,
 * and a class would come back as no padding at all.
 */
function publishComposer(promptBlocks: Box[] = [PROMPT]) {
	const card = boxed("message-editor-container", COMPOSER)
	card.style.padding = `${PAD_Y}px ${PAD_X}px`
	document.body.appendChild(card)

	const editor = boxed("message-editor-content", EDITOR)
	card.appendChild(editor)

	const surface = boxedWith({ ...EDITOR, top: EDITOR.top, height: EDITOR.height }, "ProseMirror")
	editor.appendChild(surface)
	for (const block of promptBlocks) surface.appendChild(boxedWith(block, "prompt-block"))

	return { card, editor, surface }
}

/** The cut-out the mask cuts for the composer, read off the overlay rather than out of its state. */
function editorHole(): Box {
	const hole = screen
		.getByRole("dialog")
		.querySelector<SVGRectElement>("mask rect:nth-child(2)") as SVGRectElement | null
	if (!hole) throw new Error("Expected the composer's cut-out in the mask")
	return {
		left: Number.parseFloat(hole.getAttribute("x") ?? ""),
		top: Number.parseFloat(hole.getAttribute("y") ?? ""),
		width: Number.parseFloat(hole.getAttribute("width") ?? ""),
		height: Number.parseFloat(hole.getAttribute("height") ?? ""),
	}
}

/**
 * The parts of the cover, which are the boxes the mask's complement is drawn as and the only places
 * the dimmed page can still be reached from.
 */
function coverBoxes(): Box[] {
	return Array.from(
		screen.getByRole("dialog").querySelectorAll<HTMLElement>("div.pointer-events-auto"),
	).map((node) => ({
		left: Number.parseFloat(node.style.left),
		top: Number.parseFloat(node.style.top),
		width: Number.parseFloat(node.style.width),
		height: Number.parseFloat(node.style.height),
	}))
}

/** Whether a point falls in a box, edges on the low side and off on the high one. */
function holdsPoint(box: Box, x: number, y: number) {
	return x >= box.left && x < box.left + box.width && y >= box.top && y < box.top + box.height
}

const bottomOf = (box: Box) => box.top + box.height

/** The cut-out as it is built: the viewport across, the prompt down, both grown by the padding. */
function expectedHole(prompt: Box = PROMPT): Box {
	return {
		left: EDITOR.left - PAD_X,
		top: prompt.top - PAD_Y,
		width: EDITOR.width + PAD_X * 2,
		height: prompt.height + PAD_Y * 2,
	}
}

/** Puts the run on the prompt-ready step with every cut-out and the composer on screen. */
async function startPromptReadyStep() {
	vi.resetModules()
	const onboarding = await import("../GuideTourManager")
	const tour = await import("../HomeOnboardingTour")
	onboarding.startHomeOnboarding("first-ai-work", MAGIC_ID)
	onboarding.setHomeOnboardingFlow(PROMPT_READY)
	document.body.appendChild(boxed("message-editor-send-button", SEND))
	render(<tour.default page="home" userMagicId={MAGIC_ID} />)
	// The step itself, rather than the overlay it waits behind until its anchors are measured.
	expect(within(screen.getByRole("dialog")).getByText(SEND_TITLE)).toBeInTheDocument()
}

describe("home onboarding: the cut-out over the composer, and its margin", () => {
	beforeEach(() => {
		vi.useFakeTimers()
		window.localStorage.clear()
	})

	afterEach(() => {
		vi.useRealTimers()
		markers.splice(0).forEach((marker) => marker.remove())
	})

	it("frames the prompt with the composer's padding rather than clipping it", async () => {
		publishComposer()
		await startPromptReadyStep()

		expect(editorHole()).toEqual(expectedHole())
		// And the two boxes are not the same box: growing by the padding is not the same as taking
		// the whole card, which would swallow the header above the text and the toolbar below it.
		expect(editorHole()).not.toEqual(COMPOSER)
	})

	it("hugs the prompt rather than the viewport it sits in, and stops clear of the toolbar", async () => {
		publishComposer()
		await startPromptReadyStep()

		const hole = editorHole()
		const grownFromTheViewport = {
			left: EDITOR.left - PAD_X,
			top: EDITOR.top - PAD_Y,
			width: EDITOR.width + PAD_X * 2,
			height: EDITOR.height + PAD_Y * 2,
		}

		/*
		 * The frame is the prompt's height, not the viewport's. The viewport is stretched to the card
		 * and the prompt is one line at the top of it, so the two differ by the empty room the
		 * viewport keeps for lines the prompt does not have — and a frame of the viewport's height is
		 * the one whose lower edge lands on the toolbar.
		 */
		expect(hole).not.toEqual(grownFromTheViewport)
		expect(hole.height).toBeLessThan(grownFromTheViewport.height)
		/*
		 * Both vertical edges follow the prompt. The upper one is where the prompt's own top is, not
		 * the viewport's — the two only coincide when the prompt starts at the very top of the
		 * viewport, and the fixture keeps two pixels between them so that a cut-out taken from the
		 * viewport cannot pass this case.
		 */
		expect(hole.top).toBe(PROMPT.top - PAD_Y)
		expect(bottomOf(hole)).toBeLessThanOrEqual(SEND.top)
	})

	it("keeps the band it adds reachable, so the margin is on the page and not only drawn", async () => {
		publishComposer()
		await startPromptReadyStep()

		const cover = coverBoxes()

		/*
		 * A point in the band the growth added — inside the cut-out, below the prompt's own box.
		 * Dimming it while the mask shows it lit is the two halves disagreeing, and the pointer
		 * would be stopped exactly where the highlight says it is not.
		 */
		const bandX = EDITOR.left - PAD_X / 2
		const bandY = bottomOf(PROMPT) + PAD_Y / 2
		expect(holdsPoint(expectedHole(), bandX, bandY)).toBe(true)
		expect(cover.some((box) => holdsPoint(box, bandX, bandY))).toBe(false)

		// One pixel outside it, the page is covered again — the growth stops at the card's edge.
		expect(cover.some((box) => holdsPoint(box, bandX, PROMPT.top - PAD_Y - 1))).toBe(true)
	})

	it("takes every block of the prompt, so a longer prompt is framed whole", async () => {
		const second = { ...PROMPT, top: PROMPT.top + 30 }
		publishComposer([PROMPT, second])
		await startPromptReadyStep()

		const hole = editorHole()
		expect(hole.top).toBe(PROMPT.top - PAD_Y)
		expect(bottomOf(hole)).toBe(bottomOf(second) + PAD_Y)
	})

	it("follows the prompt as it is typed into, though nothing on the page changes size", async () => {
		const { surface } = publishComposer()
		await startPromptReadyStep()

		const block = surface.lastElementChild as HTMLElement
		expect(editorHole()).toEqual(expectedHole())

		/*
		 * The same prompt, now three lines of it. The block is what the cut-out is taken from and it
		 * is the only thing that grew: the viewport is given the room of the lines a prompt may
		 * still grow into, and the card is sized around the viewport, so neither of the two boxes
		 * the step watches reports a change of size. A step that watches for size alone therefore
		 * never looks again, and holds the one-line frame it took on arrival while the text runs to
		 * three — the highlight not following, with nothing on the page to tell it to.
		 *
		 * The edit is the whole of the signal there is, so the fixture changes nothing but the
		 * document: the measurement that follows the wrap is the one it has to make itself.
		 */
		const wrapped = { ...PROMPT, height: PROMPT.height * 3 }
		setBox(block, wrapped)
		await act(async () => {
			block.appendChild(document.createTextNode(" typed on"))
		})

		expect(editorHole()).toEqual(expectedHole(wrapped))
		expect(bottomOf(editorHole())).toBe(bottomOf(wrapped) + PAD_Y)

		// And back again: deleting the text contracts the frame by the same rule, so the box
		// follows the prompt in both directions rather than only ever growing.
		setBox(block, PROMPT)
		await act(async () => {
			block.removeChild(block.lastChild as Node)
		})

		expect(editorHole()).toEqual(expectedHole())
	})

	it("stops at the editor's own viewport when the prompt is too long to fit", async () => {
		/*
		 * A prompt taller than the box it scrolls in: its own box runs past the viewport's bottom,
		 * and a cut-out that followed it there would be cut over the toolbar. The lower edge gives
		 * way to the viewport instead.
		 */
		const long = { ...PROMPT, height: EDITOR.height * 2 }
		publishComposer([long])
		await startPromptReadyStep()

		const hole = editorHole()
		expect(bottomOf(hole)).toBe(bottomOf(EDITOR))
		expect(bottomOf(hole)).toBeLessThan(SEND.top)
	})

	it("leaves the cut-out as the anchor measured it when the page has no composer", async () => {
		// Only the editor itself: a page that publishes the anchor without the card around it.
		document.body.appendChild(boxed("message-editor-content", EDITOR))
		await startPromptReadyStep()

		expect(editorHole()).toEqual(EDITOR)
	})

	it("ignores a composer that does not hold this editor", async () => {
		/*
		 * A card left over from a composer the page has swapped out: it is on screen and padded, and
		 * the editor being measured is not inside it. Reading its padding would take the margin from
		 * a box the step is not pointing at, so the editor's own box is what is framed.
		 */
		const stale = boxed("message-editor-container", {
			left: 0,
			top: 0,
			width: 400,
			height: 200,
		})
		stale.style.padding = "40px"
		document.body.appendChild(stale)
		document.body.appendChild(boxed("message-editor-content", EDITOR))

		await startPromptReadyStep()

		expect(editorHole()).toEqual(EDITOR)
	})
})

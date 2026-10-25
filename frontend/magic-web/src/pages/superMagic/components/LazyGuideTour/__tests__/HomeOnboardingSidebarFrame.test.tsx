import { render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

/**
 * The sidebar step's frame, and the two entries it has to reach.
 *
 * The step introduces the whole left navigation, but the anchor it carries is only the capability
 * list — the part the navigation scrolls in. The two entries above it, "新建任务" and "新建对话",
 * are published by the layout rather than by that list, so a frame built from the anchor alone
 * lands under them and leaves them dimmed while the copy beside it talks about the whole sidebar.
 *
 * What this file pins is that the frame is the bounding box of the anchor and the companion the
 * step names, and — just as much — that the union is a fallback and not a requirement: a companion
 * that is not on the page, or one that is mounted with no box, leaves the frame on the anchor
 * alone instead of dragging it up to the origin.
 *
 * The companion mechanism exists because of the DOM split: `SidebarContent` publishes the anchor
 * and `SidebarContentLayout` publishes the pair, and the two are siblings. No single element holds
 * both, so the union is the only honest frame.
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

const MAGIC_ID = "magic-guide-sidebar-frame"

const SIDEBAR_TITLE = "homeOnboarding.steps.sidebar.title"

/** How far outside its target the overlay strokes the ring, on every side. */
const RING_INSET = 4

interface Box {
	left: number
	top: number
	width: number
	height: number
}

/**
 * The two blocks of the navigation as the page lays them out: the capability list the anchor names,
 * and the pair of entries above it that the step frames with it.
 *
 * They are the shape the split actually produces — the same width, stacked, the pair one short row
 * and the list most of the sidebar's height — because that is what makes the union observably
 * different from either box on its own: the list's top edge is 56px below the pair's, so a frame
 * that misses the companion misses the two rows the step is talking about.
 */
const LIST: Box = { left: 8, top: 120, width: 232, height: 520 }
const ENTRIES: Box = { left: 8, top: 64, width: 232, height: 48 }

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
	return marker
}

/** The ring the step draws: the overlay's one element at `z-[1201]`. */
function ringBox(): Box {
	const ring = screen.getByRole("dialog").querySelector<HTMLElement>('[class*="z-[1201]"]')
	if (!ring) throw new Error("Expected the step's highlight ring")
	return {
		left: Number.parseFloat(ring.style.left),
		top: Number.parseFloat(ring.style.top),
		width: Number.parseFloat(ring.style.width),
		height: Number.parseFloat(ring.style.height),
	}
}

/** The ring a step draws around one box — stroked a few pixels outside it. */
function ringAround(box: Box): Box {
	return {
		left: box.left - RING_INSET,
		top: box.top - RING_INSET,
		width: box.width + RING_INSET * 2,
		height: box.height + RING_INSET * 2,
	}
}

/** The ring a step draws around the bounding box of everything it frames together. */
function ringAroundAll(boxes: Box[]): Box {
	const left = Math.min(...boxes.map((box) => box.left))
	const top = Math.min(...boxes.map((box) => box.top))
	const right = Math.max(...boxes.map((box) => box.left + box.width))
	const bottom = Math.max(...boxes.map((box) => box.top + box.height))
	return ringAround({ left, top, width: right - left, height: bottom - top })
}

/** Puts the run on the sidebar step and renders it, with the page's two blocks already published. */
async function startSidebarStep(blocks: { list: Box | null; entries: Box | null }) {
	vi.resetModules()
	const onboarding = await import("../GuideTourManager")
	const tour = await import("../HomeOnboardingTour")
	onboarding.startHomeOnboarding("workbench", MAGIC_ID)
	if (blocks.list) publishAnchor(onboarding.HomeOnboardingAnchor.WorkspaceSidebar, blocks.list)
	if (blocks.entries) {
		publishAnchor(onboarding.HomeOnboardingAnchor.SidebarHomeActions, blocks.entries)
	}
	render(<tour.default page="home" userMagicId={MAGIC_ID} />)
	// The step itself, rather than the overlay it waits behind until its anchor is measured.
	expect(screen.getByText(SIDEBAR_TITLE)).toBeInTheDocument()
}

describe("home onboarding: the sidebar step's frame and the entries above its anchor", () => {
	beforeEach(() => {
		vi.useFakeTimers()
		window.localStorage.clear()
	})

	afterEach(() => {
		vi.useRealTimers()
		markers.splice(0).forEach((marker) => marker.remove())
	})

	it("frames the entries together with the capability list, not the list alone", async () => {
		await startSidebarStep({ list: LIST, entries: ENTRIES })

		/*
		 * The union — and pointedly not the anchor's own box. The anchor alone would start the frame
		 * at y=116, leaving the two entries and the gap above them outside it: dimmed, while the
		 * card beside them explains the whole navigation.
		 */
		expect(ringBox()).toEqual(ringAroundAll([LIST, ENTRIES]))
		expect(ringBox()).not.toEqual(ringAround(LIST))
	})

	it("leaves the frame on the anchor when the page publishes no such entries", async () => {
		// A shell that does not have the pair at all — the anchor is what the step is really about,
		// and a companion that is missing is not a failed step.
		await startSidebarStep({ list: LIST, entries: null })

		expect(ringBox()).toEqual(ringAround(LIST))
	})

	it("ignores a companion that is mounted but has no box", async () => {
		/*
		 * A collapsed container: the element is in the DOM and answers with an empty box. Counting
		 * it would put the frame's top edge at zero and stretch it over the whole viewport, so it is
		 * skipped and the frame falls back to the anchor — the same answer as no companion at all.
		 */
		await startSidebarStep({ list: LIST, entries: { left: 0, top: 0, width: 0, height: 0 } })

		expect(ringBox()).toEqual(ringAround(LIST))
	})
})

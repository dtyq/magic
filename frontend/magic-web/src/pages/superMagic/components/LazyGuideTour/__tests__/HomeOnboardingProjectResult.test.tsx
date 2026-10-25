import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { act, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

/**
 * The in-project tour's third step, which frames the conversation.
 *
 * It used to be anchored on the message list's scroll container. That element is full-bleed — it is
 * the whole panel the conversation scrolls in — so the step drew its ring as wide as the content
 * area while the messages it is talking about fill a centred column 768px across, and the step read
 * as pointing at the screen rather than at the conversation. The column inside it is the thing the
 * sentence is about, and this file holds the two halves together: the page publishes the column,
 * the step names it, and the ring lands on it.
 *
 * One `t` for the whole file, as the other tour specs keep one: the tour memoises its callbacks on
 * the translation function, and a fresh one per render would send the anchor-waiting effect into a
 * loop. Handing back the key is what lets the steps be identified by what they hand over.
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

const dirname = path.dirname(fileURLToPath(import.meta.url))

const MAGIC_ID = "magic-guide-project-result"

const RESULT_TITLE = "homeOnboarding.project.result.title"

/**
 * The anchor the step is supposed to name. Written out here rather than imported, because the point
 * of the closing case is that the name the tour asks for is the name the page publishes — reading
 * it from either side would assume the answer.
 */
const RESULT_ANCHOR = "message-list-column"

/** The step before it, which frames the topic's own group in the header. */
const TOPIC_ANCHOR = "message-header-topic-group"

/** The scroll container around the column. It keeps its own anchor; see `CONTAINER`. */
const LIST_CONTAINER_ANCHOR = "message-list-container"

interface Box {
	left: number
	top: number
	width: number
	height: number
}

/** The centred column the messages live in: what the step is about. */
const COLUMN: Box = { left: 180, top: 60, width: 768, height: 900 }

/**
 * The scroll container around it, published with a box as wide as the panel because that is what it
 * really is. The step must not be drawn on it — which is exactly what the ring assertion below
 * would catch, since the two boxes cannot both be the answer.
 */
const CONTAINER: Box = { left: 60, top: 60, width: 1010, height: 900 }

/** The project files area, which the tour opens on. */
const SIDER: Box = { left: 0, top: 96, width: 236, height: 720 }

/** The topic's name and its controls, which the second step frames. */
const TOPIC_GROUP: Box = { left: 300, top: 8, width: 420, height: 32 }

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
 * The footer's primary action, by the handle the footer carries. Position is not a contract here:
 * "上一步" comes and goes with the step, and the wording behind the button changes with the locale.
 */
function primaryAction() {
	return screen.getByTestId("guide-tour-primary-action")
}

/**
 * The ring a step draws over what it frames, read off the overlay rather than out of the component's
 * state. It is the overlay's one element at `z-[1201]` — the card sits a step above it, and the
 * dimming plane belongs to its own shadow rather than being an element.
 */
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

/**
 * Puts the run on the in-project tour. The flow is written after the entry, which is also what a
 * reload mid-flow finds: the benefits-card entry drops the stored flow on its way in, so a flow set
 * first would be thrown away.
 */
async function startProjectRun() {
	vi.resetModules()
	const onboarding = await import("../GuideTourManager")
	const tour = await import("../HomeOnboardingTour")

	onboarding.startHomeOnboarding("first-ai-work", MAGIC_ID)
	onboarding.setHomeOnboardingFlow("project-file")

	publishAnchor(onboarding.HomeOnboardingAnchor.ProjectSider, SIDER)
	publishAnchor(TOPIC_ANCHOR, TOPIC_GROUP)
	publishAnchor(RESULT_ANCHOR, COLUMN)
	// The page really carries both, so the tour is given both: a step that keeps framing the
	// container would be framing an anchor that is right there.
	publishAnchor(LIST_CONTAINER_ANCHOR, CONTAINER)

	render(<tour.default page="home" userMagicId={MAGIC_ID} />)
}

describe("home onboarding: the in-project step that frames the conversation", () => {
	beforeEach(() => {
		vi.useFakeTimers()
		// The one-shot answers live in storage, which jsdom keeps for the whole file.
		window.localStorage.clear()
	})

	afterEach(() => {
		vi.useRealTimers()
		markers.splice(0).forEach((marker) => marker.remove())
	})

	it("frames the message column rather than the container it scrolls in", async () => {
		await startProjectRun()

		// The two steps before it: the files panel, then the topic's own group in the header.
		await act(async () => vi.advanceTimersByTime(32))
		await act(async () => fireEvent.click(primaryAction()))
		await act(async () => vi.advanceTimersByTime(32))
		await act(async () => fireEvent.click(primaryAction()))

		expect(screen.getByText(RESULT_TITLE)).toBeInTheDocument()

		/*
		 * The ring is stroked a few pixels outside what it frames, so the column's own box is the
		 * answer plus the border it is drawn with.
		 */
		expect(ringBox()).toEqual({
			left: COLUMN.left - 4,
			top: COLUMN.top - 4,
			width: COLUMN.width + 8,
			height: COLUMN.height + 8,
		})
	})

	it("names an anchor the message list really publishes", () => {
		/*
		 * The page hands the tour its boxes over an attribute, so the two halves have to agree on
		 * the name: one side renamed alone is a step that waits for something that will never turn
		 * up, and then gives up on a page that was there all along.
		 */
		const columnSource = fs.readFileSync(
			path.resolve(dirname, "../../MessageList/index.tsx"),
			"utf8",
		)
		const tourSource = fs.readFileSync(
			path.resolve(dirname, "../HomeOnboardingTour.tsx"),
			"utf8",
		)

		expect(columnSource).toContain(`data-guide-anchor="${RESULT_ANCHOR}"`)
		expect(tourSource).toContain(`anchor: "${RESULT_ANCHOR}"`)
	})
})

import { act, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// Type-only, and therefore erased: the manager itself is loaded through `startProjectRun`, which
// hands every case a module instance of its own.
import type { HomeOnboardingFlow, HomeOnboardingTaskPage } from "../GuideTourManager"

/**
 * The region the in-project tour announces as it frames the project files panel.
 *
 * The panel is collapsible and its collapsed state is the user's own: it is written to storage by
 * the layout store and read back on the next load, so an account that has closed the panel once
 * meets every later visit with it closed. That is a state the tour cannot see and cannot undo — the
 * collapse lives in the page's layout, which keeps one instance per mount — while both steps that
 * point at the panel frame the panel itself, and a closed panel answers with a zero-width box at
 * the left edge. The step would then draw its highlight on a sliver and its copy would describe a
 * file tree that is not on screen.
 *
 * So the region is announced and the page opens it: see `HOME_ONBOARDING_ANCHOR_EVENT`. What this
 * file pins is the half the tour owns — that the first in-project step really announces the files
 * panel, that the announcement follows the run as it moves on, and that the two states which frame
 * nothing on this page announce nothing: a run another page hosts, and the processing dialog, which
 * carries a step position the run has not reached yet.
 *
 * One `t` for the whole file, as the other tour specs keep one: the tour memoises its callbacks on
 * the translation function, and a fresh one per render would send the anchor-waiting effect into a
 * loop. Handing back the key is also what lets the steps be identified by what they hand over.
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

const MAGIC_ID = "magic-guide-project-sider-frame"

/** The run's first in-project step, which frames the files panel: "项目文件，一目了然". */
const FILES_TITLE = "homeOnboarding.project.file.title"

/** The step after it, which frames the topic's own group in the header. */
const TOPIC_TITLE = "homeOnboarding.project.topic.title"

const TOPIC_ANCHOR = "message-header-topic-group"

/** The message list's scroll container: what the run waits on before it enters the project. */
const MESSAGE_LIST_CONTAINER_ANCHOR = "message-list-container"

interface Box {
	left: number
	top: number
	width: number
	height: number
}

/**
 * The files panel as the page lays it out when it is open — which is the box the step is meant to
 * frame. The collapsed one is its counterpart and is not published here: what the panel answers
 * with is the layout's business, and this file is about the region being named, not measured.
 */
const SIDER: Box = { left: 0, top: 96, width: 236, height: 720 }

/** A box for the regions the run only checks the presence of. */
const PAGE: Box = { left: 60, top: 60, width: 1010, height: 900 }

/** The topic's name and its controls, which the second step frames. */
const TOPIC_GROUP: Box = { left: 300, top: 8, width: 420, height: 32 }

const markers: HTMLElement[] = []
const listeners: (() => void)[] = []

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
 * Puts the run on the in-project tour and collects every region it announces. The flow is written
 * after the entry, which is also what a reload mid-flow finds: the benefits-card entry drops the
 * stored flow on its way in, so a flow set first would be thrown away.
 *
 * The listener is registered on the module instance this call just loaded — `vi.resetModules()`
 * hands every case a manager of its own, and only that one has the run on it.
 */
async function startProjectRun({
	page = "home",
	flow = "project-file",
	extraAnchors = [],
}: {
	page?: HomeOnboardingTaskPage
	flow?: HomeOnboardingFlow
	/** Regions the tour looks for itself rather than as the step it is framing. */
	extraAnchors?: string[]
} = {}) {
	vi.resetModules()
	const onboarding = await import("../GuideTourManager")
	const tour = await import("../HomeOnboardingTour")

	const announced: (string | null)[] = []
	const onAnchorChange = (event: Event) =>
		announced.push((event as CustomEvent<string | null>).detail)
	window.addEventListener(onboarding.HOME_ONBOARDING_ANCHOR_EVENT, onAnchorChange)
	listeners.push(() =>
		window.removeEventListener(onboarding.HOME_ONBOARDING_ANCHOR_EVENT, onAnchorChange),
	)

	onboarding.startHomeOnboarding("first-ai-work", MAGIC_ID)
	onboarding.setHomeOnboardingFlow(flow)

	publishAnchor(onboarding.HomeOnboardingAnchor.ProjectSider, SIDER)
	publishAnchor(TOPIC_ANCHOR, TOPIC_GROUP)
	extraAnchors.forEach((anchor) => publishAnchor(anchor, PAGE))

	render(<tour.default page={page} userMagicId={MAGIC_ID} />)
	return { onboarding, announced }
}

describe("home onboarding: the in-project step that frames the project files panel", () => {
	beforeEach(() => {
		vi.useFakeTimers()
		// The one-shot answers live in storage, which jsdom keeps for the whole file.
		window.localStorage.clear()
	})

	afterEach(() => {
		vi.useRealTimers()
		listeners.splice(0).forEach((stop) => stop())
		markers.splice(0).forEach((marker) => marker.remove())
	})

	it("announces the files panel, so the page can open a panel the user had closed", async () => {
		const { onboarding, announced } = await startProjectRun()

		// The run opens on it, so the announcement is out before the first frame is painted: the page
		// has opened the panel by the time the step's ring is drawn, and the ring follows the panel
		// open rather than settling on the sliver a closed one would have given it.
		expect(screen.getByText(FILES_TITLE)).toBeInTheDocument()
		expect(onboarding.getHomeOnboardingAnchor()).toBe(
			onboarding.HomeOnboardingAnchor.ProjectSider,
		)
		expect(announced).toEqual([onboarding.HomeOnboardingAnchor.ProjectSider])
	})

	it("moves the announcement on with the run, so the panel is opened for the step that needs it", async () => {
		const { onboarding, announced } = await startProjectRun()

		await act(async () => vi.advanceTimersByTime(32))
		await act(async () => fireEvent.click(primaryAction()))
		await act(async () => vi.advanceTimersByTime(32))

		/*
		 * The next step frames the header, and the panel is not what it is about. A page that read
		 * the region late — or a step that forgot to withdraw it — would reopen the panel over a
		 * step that never asked for it.
		 */
		expect(screen.getByText(TOPIC_TITLE)).toBeInTheDocument()
		expect(onboarding.getHomeOnboardingAnchor()).toBe(TOPIC_ANCHOR)
		expect(announced).toEqual([onboarding.HomeOnboardingAnchor.ProjectSider, TOPIC_ANCHOR])
	})

	it("announces nothing to a page that does not host the run", async () => {
		/*
		 * The manager keeps the in-flight step, so a page that mounts while the run is somewhere
		 * else still finds it — and must not act on it: the project files panel of *this* page has
		 * nothing to do with a step the run is showing elsewhere.
		 */
		const { onboarding, announced } = await startProjectRun({ page: "my-skills" })

		expect(onboarding.getHomeOnboardingAnchor()).toBeNull()
		expect(announced).toEqual([])
	})

	it("announces nothing while the run is still generating", async () => {
		/*
		 * The processing dialog is not a step. It is up while the work is being done — before the
		 * tour has moved to the files panel at all — and the step position it carries is just where
		 * the flow was left, so the region it would name is one this run has not reached. Acting on
		 * it would reopen a panel the user closed for a screen that has nothing to do with the
		 * panel, and would write that over their stored preference.
		 */
		const { onboarding, announced } = await startProjectRun({
			flow: "task-processing",
			// The dialog only goes up once the run has arrived on the project page, which the tour
			// watches for itself while it waits on the task.
			extraAnchors: [MESSAGE_LIST_CONTAINER_ANCHOR],
		})

		// The poll the tour keeps while it waits on the task runs every 250ms.
		await act(async () => vi.advanceTimersByTime(300))

		expect(screen.getByText("homeOnboarding.processing.title")).toBeInTheDocument()
		expect(onboarding.getHomeOnboardingAnchor()).toBeNull()
		expect(announced).toEqual([])
	})
})

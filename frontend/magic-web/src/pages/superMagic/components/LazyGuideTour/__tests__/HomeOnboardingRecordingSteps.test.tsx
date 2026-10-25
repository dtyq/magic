import { act, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

/**
 * One `t` for the whole file, for the reason the other tour specs keep one: the tour memoises its
 * callbacks on the translation function, so a fresh one per render would rebuild them on every pass
 * and send the anchor-waiting effect into a loop. Handing back the key also lets the walk below be
 * written as the keys the steps ask for — the wording lives in the locale files, and what this file
 * checks is that the run walks the seven steps it says it does over the anchors the page publishes.
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

/*
 * The staged view asks, before it mounts, whether this deployment and this organization are ones
 * the new-user onboarding exists in — see `onboardingAvailability`. The answer here is the one that
 * gets it on screen, because this file is about which anchors the walk publishes.
 *
 * Mocking it is also what keeps `@/models/user/hooks` — and, behind it, the service container and
 * the i18n setup it pulls in — out of this file's module graph: the `react-i18next` mock above only
 * provides `useTranslation`, so loading the real chain would fail on its `initReactI18next` import.
 */
vi.mock("@/models/user/hooks", () => ({
	useOrganization: () => ({ organizationListReady: true, isPersonalOrganization: true }),
}))

const MAGIC_ID = "magic-guide-recording"

const NEXT = "homeOnboarding.actions.next"
const FINISH = "homeOnboarding.audioRecording.actions.finish"

/** The title and the hand-over label of each of the run's seven steps, in the order it walks them. */
const STEPS = [
	{
		title: "homeOnboarding.audioRecording.steps.start.title",
		action: "homeOnboarding.audioRecording.steps.start.action",
	},
	{
		title: "homeOnboarding.audioRecording.steps.import.title",
		action: "homeOnboarding.audioRecording.steps.import.action",
	},
	{
		title: "homeOnboarding.audioRecording.steps.status.title",
		action: "homeOnboarding.audioRecording.steps.status.action",
	},
	{
		title: "homeOnboarding.audioRecording.steps.transcript.title",
		action: "homeOnboarding.audioRecording.steps.transcript.action",
	},
	{
		title: "homeOnboarding.audioRecording.steps.finish.title",
		action: "homeOnboarding.audioRecording.steps.finish.action",
	},
	{
		title: "homeOnboarding.audioRecording.steps.export.title",
		action: "homeOnboarding.audioRecording.steps.export.action",
	},
] as const

const SHARE_TITLE = "homeOnboarding.audioRecording.steps.share.title"

const markers: HTMLElement[] = []

/** A control of the list itself, as the page publishes it to the tour. */
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
 * the label reads the same either way — the two have to be checked separately.
 */
function hasAdvanceArrow(button: HTMLElement) {
	return button.querySelector("svg") !== null
}

describe("home onboarding: walking the recording tour", () => {
	beforeEach(() => {
		vi.useFakeTimers()
	})

	afterEach(() => {
		vi.useRealTimers()
		markers.splice(0).forEach((marker) => marker.remove())
	})

	it("walks the seven steps over the list's own entries and then over the session the page stages", async () => {
		vi.resetModules()
		const onboarding = await import("../GuideTourManager")
		const tour = await import("../HomeOnboardingTour")
		const { default: RecordingGuideDemo } =
			await import("@/pages/superMagic/pages/AudioRecordings/components/recording-guide/RecordingGuideDemo")

		/*
		 * The list is the page's own, so its two entries are published here as the page publishes
		 * them; everything from the third step on is staged by the demo, mounted beside the tour
		 * exactly as the recordings page mounts it.
		 */
		publishAnchor(onboarding.HomeOnboardingAnchor.AudioRecordingsStart)
		publishAnchor(onboarding.HomeOnboardingAnchor.AudioRecordingsImport)

		onboarding.startHomeOnboarding("audio-recording")
		render(
			<>
				<RecordingGuideDemo />
				<tour.default page="recordings" userMagicId={MAGIC_ID} />
			</>,
		)

		for (const [index, step] of STEPS.entries()) {
			if (index > 0) {
				await act(async () => {
					fireEvent.click(primaryAction())
				})
			}
			/*
			 * A step whose anchor the page never published would be abandoned after its grace period
			 * instead of framed, so reaching the next title at all is what proves the staged view
			 * arrived in time.
			 */
			expect(screen.getByText(step.title)).toBeInTheDocument()
			expect(primaryAction().textContent).toBe(step.action)
			// The copy gives every one of these steps its own hand-over, so none carries the arrow.
			expect(hasAdvanceArrow(primaryAction())).toBe(false)
		}

		/*
		 * The closing step takes the label the run's own state calls for rather than one of its own:
		 * a first pass names the reward the task pays.
		 */
		await act(async () => {
			fireEvent.click(primaryAction())
		})
		expect(screen.getByText(SHARE_TITLE)).toBeInTheDocument()
		expect(primaryAction().textContent).toBe(FINISH)
		expect(hasAdvanceArrow(primaryAction())).toBe(false)
	})

	it("keeps the generic advance wording — and its arrow — on a walk that has no copy of its own", async () => {
		vi.resetModules()
		const onboarding = await import("../GuideTourManager")
		const tour = await import("../HomeOnboardingTour")

		publishAnchor(onboarding.HomeOnboardingAnchor.WorkspaceSidebar)
		publishAnchor(onboarding.HomeOnboardingAnchor.WorkspaceList)

		onboarding.startHomeOnboarding("workbench")
		render(<tour.default page="home" userMagicId={MAGIC_ID} />)

		/*
		 * The workbench steps are the counter-example the arrow rule is built on: they name nothing
		 * to hand over to, so they advance generically and carry the arrow.
		 */
		expect(screen.getByText("homeOnboarding.steps.sidebar.title")).toBeInTheDocument()
		expect(primaryAction().textContent).toBe(NEXT)
		expect(hasAdvanceArrow(primaryAction())).toBe(true)
	})
})

import { act, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

/**
 * One `t` for the whole file, for the same reason the tour's own specs keep one: it is handed back
 * unchanged so the assertions can be written as the keys the staged view asks for. The wording lives
 * in the locale files; what this file is about is which anchors the page publishes for which step.
 */
const { translate } = vi.hoisted(() => ({ translate: (key: string) => key }))

vi.mock("react-i18next", () => ({
	useTranslation: () => ({ i18n: { language: "en_US" }, t: translate }),
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

/*
 * The stage belongs to the new-user onboarding and asks, before mounting, whether this deployment
 * and this organization are ones the feature exists in — see `onboardingAvailability`. This file is
 * about which anchors the stage publishes for which step, so the answer here is the one that gets
 * it on screen; the "no" answers are covered where the gate lives.
 */
vi.mock("@/models/user/hooks", () => ({
	useOrganization: () => ({ organizationListReady: true, isPersonalOrganization: true }),
}))

vi.mock("@/utils/env", async (importOriginal) => ({
	...(await importOriginal<typeof import("@/utils/env")>()),
	isPrivateDeployment: () => false,
}))

/** The tour's own layer reads the current step from the manager; that is the only clock here. */

/** Mounts the run and returns the manager it was opened through. */
async function openRun() {
	vi.resetModules()
	const onboarding = await import("@/pages/superMagic/components/LazyGuideTour/GuideTourManager")
	const { default: RecordingGuideDemo } = await import("../RecordingGuideDemo")
	onboarding.startHomeOnboarding("audio-recording")
	render(<RecordingGuideDemo />)
	return { onboarding }
}

function moveToStep(
	index: number,
	onboarding: {
		setHomeOnboardingStepIndex: (index: number) => void
	},
) {
	act(() => {
		onboarding.setHomeOnboardingStepIndex(index)
	})
}

function demo() {
	return screen.queryByTestId("recording-guide-demo")
}

function hasAnchor(anchorName: string) {
	return document.querySelector(`[data-guide-anchor="${anchorName}"]`) !== null
}

describe("the staged recording the recording tour points at", () => {
	afterEach(() => {
		vi.resetModules()
	})

	it("is not there for the steps that frame the list's own entries", async () => {
		const { onboarding } = await openRun()

		expect(demo()).toBeNull()
		expect(
			screen.queryByText("super/guideTour:homeOnboarding.audioRecording.demo.recordingTitle"),
		).toBeNull()

		moveToStep(1, onboarding)
		expect(demo()).toBeNull()
	})

	it("stages a session with its status bar and live transcript for the third and fourth steps", async () => {
		const { onboarding } = await openRun()
		moveToStep(2, onboarding)

		expect(demo()?.getAttribute("data-stage")).toBe("session")
		expect(hasAnchor(onboarding.HomeOnboardingAnchor.AudioRecordingStatusBar)).toBe(true)
		expect(hasAnchor(onboarding.HomeOnboardingAnchor.AudioRecordingLiveTranscript)).toBe(true)
		// The sheet belongs to the step that is about ending the recording, and to no other.
		expect(hasAnchor(onboarding.HomeOnboardingAnchor.AudioRecordingFinishSheet)).toBe(false)
		// The transcript is shown as the product shows it before anything has been said.
		expect(
			screen.getByText("super:recordingSummary.ui.emptyState.description"),
		).toBeInTheDocument()

		// The fourth step reads the same session: moving to it must not take the page apart.
		moveToStep(3, onboarding)
		expect(demo()?.getAttribute("data-stage")).toBe("session")
		expect(hasAnchor(onboarding.HomeOnboardingAnchor.AudioRecordingLiveTranscript)).toBe(true)
	})

	it("adds the finish sheet for the step about ending the recording", async () => {
		const { onboarding } = await openRun()
		moveToStep(4, onboarding)

		expect(demo()?.getAttribute("data-stage")).toBe("finishing")
		expect(hasAnchor(onboarding.HomeOnboardingAnchor.AudioRecordingFinishSheet)).toBe(true)
		// The frame that stands behind the sheet is the same session, not a second one.
		expect(hasAnchor(onboarding.HomeOnboardingAnchor.AudioRecordingStatusBar)).toBe(true)
	})

	it("shows the finished recording for the last two steps, opening the menu each of them talks about", async () => {
		const { onboarding } = await openRun()

		moveToStep(5, onboarding)
		expect(demo()?.getAttribute("data-stage")).toBe("result")
		expect(hasAnchor(onboarding.HomeOnboardingAnchor.AudioRecordingHeaderActions)).toBe(true)
		// The export step names what can be taken out of the recording.
		expect(screen.getByText("detail.exportAudio")).toBeInTheDocument()
		expect(screen.queryByText("detail.shareCreate")).toBeNull()

		// The closing step frames the very same header; only the menu it opens differs.
		moveToStep(6, onboarding)
		expect(hasAnchor(onboarding.HomeOnboardingAnchor.AudioRecordingHeaderActions)).toBe(true)
		expect(screen.getByText("detail.shareCreate")).toBeInTheDocument()
		expect(screen.queryByText("detail.exportAudio")).toBeNull()
	})

	it("takes itself down when the run closes, so nothing of the mock is left behind", async () => {
		const { onboarding } = await openRun()
		moveToStep(5, onboarding)
		expect(demo()).not.toBeNull()

		/*
		 * The tour withdraws its request as it closes, before it reports how the run ended — and a
		 * run that is abandoned on an already-finished task reports nothing at all. The staged view
		 * therefore follows the request going away rather than the outcome, which is what this pins
		 * down: the page cannot be left holding a fake recording no run is standing on.
		 */
		act(() => {
			onboarding.clearHomeOnboardingEntryTask()
		})

		expect(demo()).toBeNull()
		expect(hasAnchor(onboarding.HomeOnboardingAnchor.AudioRecordingHeaderActions)).toBe(false)
	})

	it("stages nothing for a run opened for another task", async () => {
		vi.resetModules()
		const onboarding =
			await import("@/pages/superMagic/components/LazyGuideTour/GuideTourManager")
		const { default: RecordingGuideDemo } = await import("../RecordingGuideDemo")

		onboarding.startHomeOnboarding("create-ai-ppt")
		render(<RecordingGuideDemo />)

		expect(demo()).toBeNull()
		// The run is still the AI-PPT one, so the recording view has stayed out of its way.
		expect(onboarding.getHomeOnboardingEntryTask()).toBe("create-ai-ppt")
	})
})

import { describe, expect, it } from "vitest"
import { RECORDING_GUIDE_STEP_COUNT, resolveRecordingGuideStage } from "../recording-guide-mock"

/**
 * The staged view each step asks the page for. This is the contract between the tour's step list and
 * the demo that serves it: a step pointing at the status bar while the page is showing the list
 * would leave the tour waiting on an anchor nothing publishes, and the run would be abandoned
 * rather than walked. The mapping is a pure function precisely so it can be pinned down here.
 */
describe("the staged view the recording tour asks the page for", () => {
	it("opens on the list's own entries and stages nothing for them", () => {
		expect(resolveRecordingGuideStage(0)).toEqual({ stage: "none", menu: null })
		expect(resolveRecordingGuideStage(1)).toEqual({ stage: "none", menu: null })
	})

	it("stages one session for the two steps that read it, so advancing between them moves nothing", () => {
		expect(resolveRecordingGuideStage(2)).toEqual({ stage: "session", menu: null })
		expect(resolveRecordingGuideStage(3)).toEqual({ stage: "session", menu: null })
	})

	it("adds the finish sheet to the session for the step that frames it", () => {
		expect(resolveRecordingGuideStage(4)).toEqual({ stage: "finishing", menu: null })
	})

	it("shows the finished recording for the last two steps, each with its own menu", () => {
		expect(resolveRecordingGuideStage(5)).toEqual({ stage: "result", menu: "export" })
		expect(resolveRecordingGuideStage(6)).toEqual({ stage: "result", menu: "share" })
	})

	it("covers every step of the run and nothing past it", () => {
		expect(RECORDING_GUIDE_STEP_COUNT).toBe(7)
		// Every step of the run has a view of its own rather than falling back to the default.
		for (let stepIndex = 0; stepIndex < RECORDING_GUIDE_STEP_COUNT; stepIndex += 1) {
			expect(resolveRecordingGuideStage(stepIndex)).not.toBeUndefined()
		}
		/*
		 * A position outside the run — another task's step list, or one left over from an earlier
		 * run — stages nothing rather than guessing at a view.
		 */
		expect(resolveRecordingGuideStage(-1)).toEqual({ stage: "none", menu: null })
		expect(resolveRecordingGuideStage(RECORDING_GUIDE_STEP_COUNT)).toEqual({
			stage: "none",
			menu: null,
		})
	})
})

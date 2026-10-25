import { describe, expect, it } from "vitest"
import {
	clampSpeakerNotesHeight,
	getSpeakerNotesInFlowHeight,
	isSpeakerNotesOverlay,
	SPEAKER_NOTES_IN_FLOW_MAX_RATIO,
	SPEAKER_NOTES_MIN_HEIGHT,
	SPEAKER_NOTES_OVERLAY_MAX_RATIO,
} from "../speakerNotesLayout"

describe("speakerNotesLayout", () => {
	it("keeps notes in the document flow until they exceed 40% of the parent", () => {
		expect(isSpeakerNotesOverlay(200, 500)).toBe(false)
		expect(isSpeakerNotesOverlay(201, 500)).toBe(true)
		expect(getSpeakerNotesInFlowHeight(300, 500)).toBe(500 * SPEAKER_NOTES_IN_FLOW_MAX_RATIO)
	})

	it("lets notes grow past the in-flow cap and overlay the slide", () => {
		expect(clampSpeakerNotesHeight(300, 500)).toBe(300)
		expect(isSpeakerNotesOverlay(300, 500)).toBe(true)
	})

	it("clamps overlay height so a sliver of the slide remains visible", () => {
		expect(clampSpeakerNotesHeight(80, 500)).toBe(SPEAKER_NOTES_MIN_HEIGHT)
		expect(clampSpeakerNotesHeight(490, 500)).toBe(500 * SPEAKER_NOTES_OVERLAY_MAX_RATIO)
	})
})

import { describe, expect, it } from "vitest"
import { AUDIO_PROJECT_MODE, isAudioProjectMode } from "../is-audio-project-mode"

describe("isAudioProjectMode", () => {
	it("returns true for audio project_mode", () => {
		expect(isAudioProjectMode(AUDIO_PROJECT_MODE)).toBe(true)
	})

	it("returns false for other modes and empty values", () => {
		expect(isAudioProjectMode("summary")).toBe(false)
		expect(isAudioProjectMode("general")).toBe(false)
		expect(isAudioProjectMode("")).toBe(false)
		expect(isAudioProjectMode(null)).toBe(false)
		expect(isAudioProjectMode(undefined)).toBe(false)
	})
})

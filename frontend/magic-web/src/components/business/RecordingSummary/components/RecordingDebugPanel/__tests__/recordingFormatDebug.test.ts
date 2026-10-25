import { beforeEach, describe, expect, it } from "vitest"
import {
	RECORDING_DEBUG_FORMAT_STORAGE_KEY,
	normalizeRecordingDebugFormat,
	readRecordingDebugFormat,
	toRecordingDebugConfig,
	writeRecordingDebugFormat,
} from "../recordingFormatDebug"

describe("recordingFormatDebug", () => {
	beforeEach(() => {
		localStorage.clear()
	})

	it("falls back to auto for missing or unsupported persisted values", () => {
		expect(readRecordingDebugFormat()).toBe("auto")
		localStorage.setItem(RECORDING_DEBUG_FORMAT_STORAGE_KEY, "unsupported-format")
		expect(readRecordingDebugFormat()).toBe("auto")
		expect(normalizeRecordingDebugFormat(null)).toBe("auto")
	})

	it("persists and restores a validated format", () => {
		writeRecordingDebugFormat("ogg-opus")

		expect(localStorage.getItem(RECORDING_DEBUG_FORMAT_STORAGE_KEY)).toBe("ogg-opus")
		expect(readRecordingDebugFormat()).toBe("ogg-opus")
	})

	it("maps auto to the default Ogg mime type without overriding the policy", () => {
		expect(toRecordingDebugConfig("auto")).toEqual({
			mimeType: "audio/ogg; codecs=opus",
			encodingPolicy: undefined,
		})
	})

	it("maps WAV to an explicit forced policy", () => {
		expect(toRecordingDebugConfig("wav")).toEqual({
			mimeType: "audio/wav",
			encodingPolicy: {
				policyVersion: "debug-format-wav-v1",
				candidates: ["wav"],
				forceWav: true,
				allowWavFallback: true,
			},
		})
	})

	it("maps Ogg/Opus to WebCodecs and WASM candidates with the existing fallback", () => {
		expect(toRecordingDebugConfig("ogg-opus")).toEqual({
			mimeType: "audio/ogg; codecs=opus",
			encodingPolicy: {
				policyVersion: "debug-format-ogg-opus-v1",
				candidates: ["webcodecs-opus", "wasm-opus"],
				allowWavFallback: true,
			},
		})
	})
})

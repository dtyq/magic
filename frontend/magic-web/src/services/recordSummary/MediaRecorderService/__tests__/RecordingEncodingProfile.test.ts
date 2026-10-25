import { describe, expect, it } from "vitest"
import {
	DEFAULT_RECORDING_BITS_PER_SAMPLE,
	DEFAULT_RECORDING_CHANNELS,
	DEFAULT_RECORDING_SAMPLE_RATE,
	LEGACY_RECORDER_SAMPLE_RATE,
	createRecordingEncodingSnapshot,
	inferLegacyRecordingAudioProfile,
	normalizeRecordingEncodingSnapshot,
	resolveRecordingAudioProfile,
	withRecordingAudioProfile,
} from "../utils/RecordingEncodingProfile"

describe("RecordingEncodingProfile", () => {
	it("uses the default normalized profile for new sessions", () => {
		expect(resolveRecordingAudioProfile()).toEqual({
			sampleRate: DEFAULT_RECORDING_SAMPLE_RATE,
			channels: DEFAULT_RECORDING_CHANNELS,
			bitsPerSample: DEFAULT_RECORDING_BITS_PER_SAMPLE,
		})
	})

	it("preserves a complete persisted profile when a fallback is provided", () => {
		const snapshot = createRecordingEncodingSnapshot("wav", {
			sampleRate: 48_000,
			channels: 1,
			bitsPerSample: 16,
		})

		expect(
			withRecordingAudioProfile(snapshot, {
				sampleRate: 16_000,
				channels: 1,
				bitsPerSample: 16,
			}),
		).toEqual(snapshot)
	})

	it("fills format-only legacy WAV snapshots with 48 kHz", () => {
		expect(normalizeRecordingEncodingSnapshot({ format: "wav" })).toMatchObject({
			format: "wav",
			sampleRate: LEGACY_RECORDER_SAMPLE_RATE,
			channels: 1,
			bitsPerSample: 16,
		})
	})

	it("keeps Ogg/Opus legacy sessions at the normalized 16 kHz profile", () => {
		expect(inferLegacyRecordingAudioProfile("ogg-opus").sampleRate).toBe(
			DEFAULT_RECORDING_SAMPLE_RATE,
		)
		expect(
			createRecordingEncodingSnapshot("ogg-opus", {
				sampleRate: 48_000,
				channels: 1,
				bitsPerSample: 16,
			}).sampleRate,
		).toBe(DEFAULT_RECORDING_SAMPLE_RATE)
	})
})

import { describe, expect, it } from "vitest"
import { WAVEncoder } from "../encoders/WAVEncoder"
import { normalizeAudioChunk, normalizePcm } from "../utils/PcmNormalizer"

describe("PcmNormalizer", () => {
	it("converts one second of 48 kHz PCM to 16 kHz without changing duration", () => {
		const source = new Int16Array(48_000)
		const normalized = normalizePcm(source, 48_000, 16_000)

		expect(normalized).toHaveLength(16_000)
	})

	it("marks normalized chunks at the target rate for WAV encoding", () => {
		const chunk = normalizeAudioChunk(
			{
				pcmData: new Int16Array(48_000),
				sampleRate: 48_000,
				bitRate: 16,
				duration: 1,
			},
			16_000,
		)
		const encoded = new WAVEncoder().encode(chunk)
		const header = new DataView(encoded.data)

		expect(chunk.sampleRate).toBe(16_000)
		expect(chunk.duration).toBe(1)
		expect(header.getUint32(24, true)).toBe(16_000)
		expect(header.getUint32(40, true)).toBe(32_000)
	})
})

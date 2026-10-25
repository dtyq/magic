import { describe, expect, it } from "vitest"
import { RecordingEncoderResolver } from "../encoders/RecordingEncoderResolver"

describe("RecordingEncoderResolver", () => {
	it("honors forceWav before probing compressed encoders", async () => {
		const result = await new RecordingEncoderResolver().resolve({
			type: "opus",
			encodingPolicy: {
				policyVersion: "test-policy",
				candidates: ["webcodecs-opus", "wasm-opus"],
				forceWav: true,
				allowWavFallback: true,
			},
		})

		expect(result.format).toBe("wav")
		expect(result.policyVersion).toBe("test-policy")
		await result.encoder.close()
	})

	it("keeps an explicitly locked WAV session on WAV", async () => {
		const result = await new RecordingEncoderResolver().resolve({
			type: "opus",
			lockedEncoding: { format: "wav", policyVersion: "old-policy" },
		})

		expect(result.format).toBe("wav")
		expect(result.policyVersion).toBe("old-policy")
		await result.encoder.close()
	})

	it("keeps an explicitly locked PCM session on PCM", async () => {
		const result = await new RecordingEncoderResolver().resolve({
			type: "opus",
			lockedEncoding: { format: "pcm", policyVersion: "old-policy" },
		})

		expect(result.format).toBe("pcm")
		expect(result.policyVersion).toBe("old-policy")
		await result.encoder.close()
	})

	it("uses WASM when WebCodecs is unavailable while keeping Ogg/Opus format", async () => {
		const result = await new RecordingEncoderResolver().resolve({
			type: "opus",
			encodingPolicy: {
				policyVersion: "fallback-policy",
				candidates: ["webcodecs-opus", "wasm-opus"],
				allowWavFallback: true,
			},
		})

		expect(result.format).toBe("ogg-opus")
		await result.encoder.close()
	})

	it("keeps a locked Ogg/Opus session on Ogg/Opus while falling back to WASM", async () => {
		const result = await new RecordingEncoderResolver().resolve({
			type: "opus",
			lockedEncoding: { format: "ogg-opus", policyVersion: "old-policy" },
		})

		expect(result.format).toBe("ogg-opus")
		expect(result.policyVersion).toBe("old-policy")
		await result.encoder.close()
	})

	it("falls back safely when the policy shape is invalid", async () => {
		const result = await new RecordingEncoderResolver().resolve({
			type: "opus",
			encodingPolicy: null as never,
		})

		expect(result.format).toBe("wav")
		await result.encoder.close()
	})
})

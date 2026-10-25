import { describe, expect, it } from "vitest"
import { WasmOpusEncoder } from "../encoders/WasmOpusEncoder"

describe("WasmOpusEncoder", () => {
	it("produces a complete Ogg/Opus file for synthetic PCM", async () => {
		const encoder = new WasmOpusEncoder()
		await encoder.initialize()
		const result = await encoder.encode({
			pcmData: new Int16Array(1600),
			sampleRate: 16000,
			bitRate: 16,
			duration: 0.1,
		})

		expect(result.mimeType).toBe("audio/ogg; codecs=opus")
		expect(new Uint8Array(result.data).slice(0, 4)).toEqual(
			new Uint8Array([0x4f, 0x67, 0x67, 0x53]),
		)
		expect(result.size).toBeGreaterThan(0)
		await encoder.close()
	})

	it("uses the configured bitrate for CBR packet generation", async () => {
		const pcmData = new Int16Array(16_000)
		const lowBitrateEncoder = new WasmOpusEncoder(24_000)
		const highBitrateEncoder = new WasmOpusEncoder(32_000)
		await lowBitrateEncoder.initialize()
		await highBitrateEncoder.initialize()

		const lowBitrateResult = await lowBitrateEncoder.encode({
			pcmData,
			sampleRate: 16000,
			bitRate: 16,
			duration: 1,
		})
		const highBitrateResult = await highBitrateEncoder.encode({
			pcmData,
			sampleRate: 16000,
			bitRate: 16,
			duration: 1,
		})

		expect(lowBitrateResult.size).toBeLessThan(highBitrateResult.size)
		await lowBitrateEncoder.close()
		await highBitrateEncoder.close()
	})
})

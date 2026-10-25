import { afterEach, describe, expect, it, vi } from "vitest"
import { WebCodecsOpusEncoder } from "../encoders/WebCodecsOpusEncoder"

const opusHead = (() => {
	const header = new Uint8Array(19)
	new TextEncoder().encodeInto("OpusHead", header)
	const view = new DataView(header.buffer)
	view.setUint8(8, 1)
	view.setUint8(9, 1)
	view.setUint16(10, 312, true)
	view.setUint32(12, 16000, true)
	return header
})()

class MockAudioData {
	close = vi.fn()
	constructor(init: Record<string, unknown>) {
		void init
	}
}

class MockAudioEncoder {
	static isConfigSupported = vi.fn(async () => ({ supported: true }))
	static configuredBitrates: number[] = []
	private readonly output: (
		chunk: {
			timestamp: number
			duration: number
			byteLength: number
			copyTo: (target: ArrayBuffer) => void
		},
		metadata: { decoderConfig: { description: Uint8Array } },
	) => void

	constructor(callbacks: { output: typeof this.output; error: (error: DOMException) => void }) {
		this.output = callbacks.output
	}

	configure(config: Record<string, unknown>): void {
		MockAudioEncoder.configuredBitrates.push(config.bitrate as number)
	}

	encode(data: unknown): void {
		void data
		const bytes = new Uint8Array([0x11, 0x22, 0x33])
		this.output(
			{
				timestamp: 0,
				duration: 20_000,
				byteLength: bytes.byteLength,
				copyTo: (target) => new Uint8Array(target).set(bytes),
			},
			{ decoderConfig: { description: opusHead } },
		)
	}

	flush(): Promise<void> {
		return Promise.resolve()
	}

	close(): void {
		return
	}
}

describe("WebCodecsOpusEncoder", () => {
	afterEach(() => {
		MockAudioEncoder.configuredBitrates = []
		Reflect.deleteProperty(globalThis, "AudioEncoder")
		Reflect.deleteProperty(globalThis, "AudioData")
	})

	it("uses metadata OpusHead and emits an Ogg file", async () => {
		Object.assign(globalThis, { AudioEncoder: MockAudioEncoder, AudioData: MockAudioData })
		const encoder = new WebCodecsOpusEncoder()
		await encoder.initialize()
		const result = await encoder.encode({
			pcmData: new Int16Array(320),
			sampleRate: 16000,
			bitRate: 16,
			duration: 0.02,
		})

		expect(result.mimeType).toBe("audio/ogg; codecs=opus")
		expect(new Uint8Array(result.data).slice(0, 4)).toEqual(
			new Uint8Array([0x4f, 0x67, 0x67, 0x53]),
		)
		await encoder.close()
	})

	it("passes the configured audio bitrate to WebCodecs", async () => {
		Object.assign(globalThis, { AudioEncoder: MockAudioEncoder, AudioData: MockAudioData })
		const encoder = new WebCodecsOpusEncoder(28_000)
		await encoder.initialize()

		expect(MockAudioEncoder.configuredBitrates).not.toHaveLength(0)
		expect(MockAudioEncoder.configuredBitrates.every((bitrate) => bitrate === 28_000)).toBe(
			true,
		)
		await encoder.close()
	})
})

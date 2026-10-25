import { AudioEncodingError } from "../types/RecorderErrors"
import type {
	AudioChunkData,
	EncodedAudioChunk,
	OpusPacket,
	RecordingEncodingFormat,
} from "../types/RecorderTypes"
import type { AudioEncoder } from "./AudioEncoder"
import {
	calculateOpusEndTrim48k,
	OGG_OPUS_MIME_TYPE,
	OggOpusMuxer,
	isValidOpusHead,
	readOpusPreSkip,
} from "./OggOpusMuxer"
import { normalizePcm } from "../utils/PcmNormalizer"

const TARGET_SAMPLE_RATE = 16000
const TARGET_CHANNELS = 1
const FRAME_SAMPLES = 320
const FRAME_DURATION_US = 20_000
const DEFAULT_TARGET_BITRATE = 32_000
const OPUS_CODEC = "opus"

interface WebCodecsOutputChunk {
	timestamp: number
	duration?: number
	byteLength: number
	copyTo(target: ArrayBuffer): void
}

interface WebCodecsEncoder {
	configure(config: Record<string, unknown>): void
	encode(data: unknown): void
	flush(): Promise<void>
	close(): void
}

type WebCodecsConstructor = {
	new (callbacks: {
		output: (
			chunk: WebCodecsOutputChunk,
			metadata?: { decoderConfig?: { description?: unknown } },
		) => void
		error: (error: DOMException) => void
	}): WebCodecsEncoder
	isConfigSupported?(config: Record<string, unknown>): Promise<{ supported?: boolean }>
}

/** Encode PCM through WebCodecs and pass only raw packets to the shared Ogg muxer. */
export class WebCodecsOpusEncoder implements AudioEncoder {
	private encoder: WebCodecsEncoder | null = null
	private opusHead: Uint8Array | null = null
	private pendingPackets: OpusPacket[] = []
	private pendingError: Error | null = null
	private outputMetadataReceived = false

	constructor(private readonly targetBitrate: number = DEFAULT_TARGET_BITRATE) {}

	/** Validate browser support and perform a real packet smoke encode. */
	async initialize(): Promise<void> {
		const constructor = getWebCodecsConstructor()
		if (!constructor) throw new Error("WebCodecs AudioEncoder is unavailable")

		const config = createWebCodecsConfig(this.targetBitrate)
		if (constructor.isConfigSupported) {
			const support = await constructor.isConfigSupported(config)
			if (!support.supported)
				throw new Error("WebCodecs does not support the Opus configuration")
		}

		this.createEncoder(constructor, config)
		await this.encodeFrames(new Int16Array(FRAME_SAMPLES), true)
		if (!this.opusHead || !isValidOpusHead(this.opusHead)) {
			await this.close()
			throw new Error("WebCodecs did not provide a valid OpusHead")
		}
	}

	/** Encode one PCM chunk into a complete independent Ogg/Opus file. */
	async encode(chunkData: AudioChunkData): Promise<EncodedAudioChunk> {
		if (!this.opusHead) {
			throw new AudioEncodingError("WebCodecs Opus encoder is not initialized", new Error())
		}

		try {
			const normalizedPcm = normalizePcm(
				chunkData.pcmData,
				chunkData.sampleRate,
				TARGET_SAMPLE_RATE,
			)
			const packets = await this.encodeFrames(normalizedPcm, false)
			const endTrim48k = calculateOpusEndTrim48k(normalizedPcm.length, FRAME_SAMPLES)
			const muxer = new OggOpusMuxer({
				inputSampleRate: TARGET_SAMPLE_RATE,
				channels: TARGET_CHANNELS,
				preSkip48k: readOpusPreSkip(this.opusHead),
				endTrim48k,
				opusHead: this.opusHead,
			})
			packets.forEach((packet) => muxer.addPacket(packet))
			const data = muxer.finalize()
			return { data, mimeType: OGG_OPUS_MIME_TYPE, size: data.byteLength }
		} catch (error) {
			throw new AudioEncodingError(
				"Failed to encode audio to Ogg Opus with WebCodecs",
				error as Error,
			)
		}
	}

	/** Wait for the current WebCodecs queue to drain. */
	async flush(): Promise<void> {
		if (this.encoder) await this.encoder.flush()
	}

	/** Close the browser encoder and clear packet state. */
	async close(): Promise<void> {
		this.encoder?.close()
		this.encoder = null
		this.opusHead = null
		this.pendingPackets = []
		this.pendingError = null
	}

	/** Return the MIME type used by the upload contract. */
	getMimeType(): string {
		return OGG_OPUS_MIME_TYPE
	}

	/** Return the stable format identifier stored with each chunk. */
	getFormat(): RecordingEncodingFormat {
		return "ogg-opus"
	}

	/** Create a fresh WebCodecs queue for one business chunk and collect its packets. */
	private async encodeFrames(pcmData: Int16Array, smokeTest: boolean): Promise<OpusPacket[]> {
		const constructor = getWebCodecsConstructor()
		if (!constructor) throw new Error("WebCodecs AudioEncoder is unavailable")
		const shouldCreateFreshEncoder = !this.encoder || smokeTest
		if (shouldCreateFreshEncoder) {
			this.encoder?.close()
			this.encoder = null
			this.createEncoder(constructor, createWebCodecsConfig(this.targetBitrate))
		}
		const encoder = this.encoder
		if (!encoder) throw new Error("WebCodecs encoder failed to initialize")

		this.pendingPackets = []
		this.pendingError = null
		const frameCount = Math.max(1, Math.ceil(pcmData.length / FRAME_SAMPLES))
		try {
			for (let frameIndex = 0; frameIndex < frameCount; frameIndex++) {
				const frame = new Int16Array(FRAME_SAMPLES)
				frame.set(
					pcmData.subarray(frameIndex * FRAME_SAMPLES, (frameIndex + 1) * FRAME_SAMPLES),
				)
				const audioData = createAudioData(frame, frameIndex * FRAME_DURATION_US)
				encoder.encode(audioData)
				closeAudioData(audioData)
			}
			await encoder.flush()
			if (this.pendingError) throw this.pendingError
			if (this.pendingPackets.length === 0)
				throw new Error("WebCodecs returned no Opus packets")
			if (smokeTest && !this.outputMetadataReceived) {
				throw new Error("WebCodecs returned no decoder metadata")
			}
			return this.pendingPackets
		} finally {
			if (shouldCreateFreshEncoder && this.encoder === encoder) {
				encoder.close()
				this.encoder = null
			}
		}
	}

	/** Build the encoder callback bridge and configure the fixed Opus profile. */
	private createEncoder(
		constructor: WebCodecsConstructor,
		config: Record<string, unknown>,
	): void {
		this.outputMetadataReceived = false
		this.encoder = new constructor({
			output: (chunk, metadata) => {
				const data = new ArrayBuffer(chunk.byteLength)
				chunk.copyTo(data)
				const description = metadata?.decoderConfig?.description
				if (description && !this.opusHead) {
					const candidate = toUint8Array(description)
					if (candidate && isValidOpusHead(candidate)) this.opusHead = candidate
				}
				this.outputMetadataReceived ||= Boolean(description)
				this.pendingPackets.push({
					data: new Uint8Array(data),
					timestampUs: chunk.timestamp,
					durationUs: chunk.duration || FRAME_DURATION_US,
				})
			},
			error: (error) => {
				this.pendingError = error
			},
		})
		this.encoder.configure(config)
	}
}

/** Return the browser constructor without touching unsupported environments. */
function getWebCodecsConstructor(): WebCodecsConstructor | null {
	return (
		(globalThis as typeof globalThis & { AudioEncoder?: WebCodecsConstructor }).AudioEncoder ??
		null
	)
}

/** Return the fixed WebCodecs configuration used by the resolver smoke test. */
function createWebCodecsConfig(targetBitrate: number): Record<string, unknown> {
	return {
		codec: OPUS_CODEC,
		sampleRate: TARGET_SAMPLE_RATE,
		numberOfChannels: TARGET_CHANNELS,
		bitrate: targetBitrate,
		opus: { frameDuration: FRAME_DURATION_US },
	}
}

/** Construct AudioData while keeping the DOM type surface optional in unit tests. */
function createAudioData(frame: Int16Array, timestamp: number): unknown {
	const AudioDataConstructor = (
		globalThis as typeof globalThis & {
			AudioData?: new (init: Record<string, unknown>) => unknown
		}
	).AudioData
	if (!AudioDataConstructor) throw new Error("WebCodecs AudioData is unavailable")
	return new AudioDataConstructor({
		format: "s16",
		sampleRate: TARGET_SAMPLE_RATE,
		numberOfFrames: frame.length,
		numberOfChannels: TARGET_CHANNELS,
		timestamp,
		data: frame,
	})
}

/** Close AudioData immediately after encode to avoid retaining frame memory. */
function closeAudioData(audioData: unknown): void {
	if (typeof audioData === "object" && audioData !== null && "close" in audioData) {
		;(audioData as { close: () => void }).close()
	}
}

/** Convert a metadata description into an independent byte array. */
function toUint8Array(value: unknown): Uint8Array | null {
	if (value instanceof Uint8Array) return new Uint8Array(value)
	if (value instanceof ArrayBuffer) return new Uint8Array(value.slice(0))
	return null
}

import type {
	RecorderCoreConfig,
	RecordingEncoderKind,
	RecordingEncodingFormat,
	RecordingEncodingPolicy,
	RecordingEncodingSnapshot,
} from "../types/RecorderTypes"
import type { AudioEncoder } from "./AudioEncoder"
import { PCMEncoder } from "./PCMEncoder"
import { WAVEncoder } from "./WAVEncoder"
import { WasmOpusEncoder } from "./WasmOpusEncoder"
import { WebCodecsOpusEncoder } from "./WebCodecsOpusEncoder"

export const DEFAULT_RECORDING_ENCODING_POLICY: RecordingEncodingPolicy = {
	policyVersion: "ogg-opus-policy-v1",
	candidates: ["webcodecs-opus", "wasm-opus", "wav"],
	allowWavFallback: true,
}

export interface ResolvedRecordingEncoder {
	encoder: AudioEncoder
	format: RecordingEncodingFormat
	policyVersion?: string
}

/** Select and initialize exactly one encoder before the first recorded chunk exists. */
export class RecordingEncoderResolver {
	constructor(
		private readonly defaultPolicy: RecordingEncodingPolicy = DEFAULT_RECORDING_ENCODING_POLICY,
	) {}

	/** Resolve a locked session, explicit legacy format, or startup candidate list. */
	async resolve(config: Partial<RecorderCoreConfig>): Promise<ResolvedRecordingEncoder> {
		const targetBitrate = normalizeTargetBitrate(config.audioBitsPerSecond)
		if (config.lockedEncoding) return this.resolveLocked(config.lockedEncoding, targetBitrate)
		if (config.type === "wav")
			return this.initializeExact(new WAVEncoder(), "wav", "legacy-wav")
		if (config.type === "pcm")
			return this.initializeExact(new PCMEncoder(), "pcm", "legacy-pcm")

		const policy = normalizePolicy(
			config.encodingPolicy === undefined ? this.defaultPolicy : config.encodingPolicy,
		)
		if (policy.forceWav)
			return this.initializeExact(new WAVEncoder(), "wav", policy.policyVersion)

		const candidates: RecordingEncoderKind[] =
			policy.candidates.length > 0 ? policy.candidates : ["wav"]
		const failures: Error[] = []
		for (const candidate of candidates) {
			try {
				const resolved = await this.initializeCandidate(
					candidate,
					policy.policyVersion,
					targetBitrate,
				)
				if (resolved) return resolved
			} catch (error) {
				failures.push(error as Error)
			}
		}

		if (policy.allowWavFallback && !candidates.includes("wav")) {
			return this.initializeExact(new WAVEncoder(), "wav", policy.policyVersion)
		}
		throw new Error(
			`No recording encoder is available${failures.length ? `: ${failures.map((error) => error.message).join("; ")}` : ""}`,
		)
	}

	/** Restore a session's artifact format while allowing Ogg/Opus implementation fallback. */
	private async resolveLocked(
		snapshot: RecordingEncodingSnapshot,
		targetBitrate: number,
	): Promise<ResolvedRecordingEncoder> {
		switch (snapshot.format) {
			case "wav":
				return this.initializeExact(new WAVEncoder(), "wav", snapshot.policyVersion)
			case "pcm":
				return this.initializeExact(new PCMEncoder(), "pcm", snapshot.policyVersion)
			case "ogg-opus":
				return this.resolveLockedOggOpus(targetBitrate, snapshot.policyVersion)
			default:
				throw new Error(`Unsupported locked recording format: ${String(snapshot.format)}`)
		}
	}

	/** Try WebCodecs first and WASM second without changing the persisted Ogg/Opus format. */
	private async resolveLockedOggOpus(
		targetBitrate: number,
		policyVersion?: string,
	): Promise<ResolvedRecordingEncoder> {
		const failures: Error[] = []
		for (const createEncoder of [
			() => new WebCodecsOpusEncoder(targetBitrate),
			() => new WasmOpusEncoder(targetBitrate),
		]) {
			const encoder = createEncoder()
			try {
				await encoder.initialize()
				return { encoder, format: "ogg-opus", policyVersion }
			} catch (error) {
				failures.push(error as Error)
				await encoder.close()
			}
		}

		throw new Error(
			`No Ogg/Opus encoder is available: ${failures.map((error) => error.message).join("; ")}`,
		)
	}

	/** Try one candidate and return null for unknown future policy values. */
	private async initializeCandidate(
		candidate: RecordingEncoderKind,
		policyVersion: string,
		targetBitrate: number,
	): Promise<ResolvedRecordingEncoder | null> {
		switch (candidate) {
			case "webcodecs-opus":
				return this.initializeExact(
					new WebCodecsOpusEncoder(targetBitrate),
					"ogg-opus",
					policyVersion,
				)
			case "wasm-opus":
				return this.initializeExact(
					new WasmOpusEncoder(targetBitrate),
					"ogg-opus",
					policyVersion,
				)
			case "wav":
				return this.initializeExact(new WAVEncoder(), "wav", policyVersion)
			default:
				return null
		}
	}

	/** Initialize one concrete encoder and close it if startup validation fails. */
	private async initializeExact(
		encoder: AudioEncoder,
		format: RecordingEncodingFormat,
		policyVersion?: string,
	): Promise<ResolvedRecordingEncoder> {
		try {
			await encoder.initialize()
			return { encoder, format, policyVersion }
		} catch (error) {
			await encoder.close()
			throw error
		}
	}
}

/** Use the configured positive bitrate or retain the validated 32 kbps recording default. */
function normalizeTargetBitrate(value: number | undefined): number {
	return Number.isFinite(value) && Number(value) > 0 ? Math.round(Number(value)) : 32_000
}

/** Validate policy shape and choose a safe WAV policy for malformed runtime configuration. */
function normalizePolicy(policy: RecordingEncodingPolicy): RecordingEncodingPolicy {
	if (
		!policy ||
		typeof policy.policyVersion !== "string" ||
		!Array.isArray(policy.candidates) ||
		typeof policy.allowWavFallback !== "boolean"
	) {
		return { ...DEFAULT_RECORDING_ENCODING_POLICY, forceWav: true }
	}

	return {
		policyVersion: policy.policyVersion,
		candidates: policy.candidates.filter((candidate): candidate is RecordingEncoderKind =>
			["webcodecs-opus", "wasm-opus", "wav"].includes(candidate),
		),
		forceWav: policy.forceWav === true,
		allowWavFallback: policy.allowWavFallback,
	}
}

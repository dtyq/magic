import type { RecordingEncodingFormat, RecordingEncodingSnapshot } from "../types/RecorderTypes"

export const DEFAULT_RECORDING_SAMPLE_RATE = 16_000
export const DEFAULT_RECORDING_CHANNELS = 1
export const DEFAULT_RECORDING_BITS_PER_SAMPLE = 16

/** Sample rate emitted by the pre-normalization recorder-core WAV path. */
export const LEGACY_RECORDER_SAMPLE_RATE = 48_000

export interface RecordingAudioProfile {
	sampleRate: number
	channels: number
	bitsPerSample: number
}

/** Resolve a persisted profile while keeping old format-only snapshots readable. */
export function resolveRecordingAudioProfile(
	snapshot?: Partial<RecordingEncodingSnapshot>,
	defaultProfile: RecordingAudioProfile = {
		sampleRate: DEFAULT_RECORDING_SAMPLE_RATE,
		channels: DEFAULT_RECORDING_CHANNELS,
		bitsPerSample: DEFAULT_RECORDING_BITS_PER_SAMPLE,
	},
): RecordingAudioProfile {
	return {
		sampleRate: positiveIntegerOr(snapshot?.sampleRate, defaultProfile.sampleRate),
		channels: positiveIntegerOr(snapshot?.channels, defaultProfile.channels),
		bitsPerSample: positiveIntegerOr(snapshot?.bitsPerSample, defaultProfile.bitsPerSample),
	}
}

/** Normalize a snapshot so resumed sessions carry the complete output profile. */
export function withRecordingAudioProfile(
	snapshot: RecordingEncodingSnapshot,
	profile?: Partial<RecordingAudioProfile>,
): RecordingEncodingSnapshot {
	const fallback = resolveRecordingAudioProfile(profile)
	const resolved = {
		sampleRate: positiveIntegerOr(snapshot.sampleRate, fallback.sampleRate),
		channels: positiveIntegerOr(snapshot.channels, fallback.channels),
		bitsPerSample: positiveIntegerOr(snapshot.bitsPerSample, fallback.bitsPerSample),
	}
	const outputProfile = normalizeOutputProfile(snapshot.format, resolved)
	return {
		...snapshot,
		...outputProfile,
	}
}

/** Normalize a persisted snapshot using its format and optional legacy metadata. */
export function normalizeRecordingEncodingSnapshot(
	snapshot: RecordingEncodingSnapshot,
	metadataSampleRate?: number,
): RecordingEncodingSnapshot {
	return withRecordingAudioProfile(
		snapshot,
		inferLegacyRecordingAudioProfile(snapshot.format, metadataSampleRate),
	)
}

/** Infer the output profile used by sessions created before profile persistence existed. */
export function inferLegacyRecordingAudioProfile(
	audioFormat?: string,
	metadataSampleRate?: number,
): RecordingAudioProfile {
	const explicitSampleRate = positiveIntegerOr(metadataSampleRate, 0)
	if (explicitSampleRate > 0) {
		return {
			sampleRate: explicitSampleRate,
			channels: DEFAULT_RECORDING_CHANNELS,
			bitsPerSample: DEFAULT_RECORDING_BITS_PER_SAMPLE,
		}
	}

	const legacyFormat = audioFormat?.toLowerCase()
	if (legacyFormat === "webm" || legacyFormat === "wav" || legacyFormat === "pcm") {
		return {
			sampleRate: LEGACY_RECORDER_SAMPLE_RATE,
			channels: DEFAULT_RECORDING_CHANNELS,
			bitsPerSample: DEFAULT_RECORDING_BITS_PER_SAMPLE,
		}
	}

	return resolveRecordingAudioProfile()
}

export function createRecordingEncodingSnapshot(
	format: RecordingEncodingFormat,
	profile: RecordingAudioProfile,
	policyVersion?: string,
): RecordingEncodingSnapshot {
	return {
		format,
		policyVersion,
		...normalizeOutputProfile(format, profile),
	}
}

function normalizeOutputProfile(
	format: RecordingEncodingFormat,
	profile: RecordingAudioProfile,
): RecordingAudioProfile {
	if (format !== "ogg-opus") return profile
	return {
		sampleRate: DEFAULT_RECORDING_SAMPLE_RATE,
		channels: DEFAULT_RECORDING_CHANNELS,
		bitsPerSample: DEFAULT_RECORDING_BITS_PER_SAMPLE,
	}
}

function positiveIntegerOr(value: number | undefined, fallback: number): number {
	return Number.isFinite(value) && Number(value) > 0 ? Math.round(Number(value)) : fallback
}

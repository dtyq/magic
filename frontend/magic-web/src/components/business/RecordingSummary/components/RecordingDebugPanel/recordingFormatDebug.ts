import type { MediaRecorderConfig } from "@/types/recordSummary"
import type { RecordingDebugFormat } from "./types"

/** Storage key used to persist the development-only recording format choice. */
export const RECORDING_DEBUG_FORMAT_STORAGE_KEY = "recordingSummary_debugRecordingFormat"

/** Formats shown in the development diagnostics panel. */
export const RECORDING_DEBUG_FORMAT_OPTIONS: Array<{
	value: RecordingDebugFormat
	labelKey: string
}> = [
	{ value: "auto", labelKey: "recordingSummary.debugPanel.formatAuto" },
	{ value: "wav", labelKey: "recordingSummary.debugPanel.formatWav" },
	{ value: "ogg-opus", labelKey: "recordingSummary.debugPanel.formatOggOpus" },
]

const OGG_OPUS_MIME_TYPE = "audio/ogg; codecs=opus"
const WAV_MIME_TYPE = "audio/wav"

/** Return the safe default when persisted debug data is missing or malformed. */
export function normalizeRecordingDebugFormat(value: unknown): RecordingDebugFormat {
	return value === "wav" || value === "ogg-opus" || value === "auto" ? value : "auto"
}

/** Read the persisted format without allowing storage failures to affect recording. */
export function readRecordingDebugFormat(storage?: Storage): RecordingDebugFormat {
	try {
		const targetStorage =
			storage ?? (typeof window !== "undefined" ? window.localStorage : null)
		return normalizeRecordingDebugFormat(
			targetStorage?.getItem(RECORDING_DEBUG_FORMAT_STORAGE_KEY),
		)
	} catch {
		return "auto"
	}
}

/** Persist a validated format while tolerating private-mode and quota errors. */
export function writeRecordingDebugFormat(format: RecordingDebugFormat, storage?: Storage): void {
	try {
		const targetStorage =
			storage ?? (typeof window !== "undefined" ? window.localStorage : null)
		targetStorage?.setItem(RECORDING_DEBUG_FORMAT_STORAGE_KEY, format)
	} catch {
		// Storage is optional diagnostics state and must never block recording.
	}
}

/** Convert a debug choice into the recorder configuration consumed by the next session. */
export function toRecordingDebugConfig(
	format: RecordingDebugFormat,
): Pick<MediaRecorderConfig, "mimeType" | "encodingPolicy"> {
	if (format === "wav") {
		return {
			mimeType: WAV_MIME_TYPE,
			encodingPolicy: {
				policyVersion: "debug-format-wav-v1",
				candidates: ["wav"],
				forceWav: true,
				allowWavFallback: true,
			},
		}
	}

	if (format === "ogg-opus") {
		return {
			mimeType: OGG_OPUS_MIME_TYPE,
			encodingPolicy: {
				policyVersion: "debug-format-ogg-opus-v1",
				candidates: ["webcodecs-opus", "wasm-opus"],
				allowWavFallback: true,
			},
		}
	}

	return {
		mimeType: OGG_OPUS_MIME_TYPE,
		encodingPolicy: undefined,
	}
}

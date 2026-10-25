import type { AudioChunkData } from "../types/RecorderTypes"
import { DEFAULT_RECORDING_SAMPLE_RATE } from "./RecordingEncodingProfile"

/** Resample target required by the recording artifact contract. */
export const RECORDING_TARGET_SAMPLE_RATE = DEFAULT_RECORDING_SAMPLE_RATE

/** Normalize one PCM chunk to the requested sample rate with linear interpolation. */
export function normalizePcm(
	pcmData: Int16Array,
	sourceSampleRate: number,
	targetSampleRate: number = RECORDING_TARGET_SAMPLE_RATE,
): Int16Array {
	if (!Number.isFinite(sourceSampleRate) || sourceSampleRate <= 0) {
		throw new Error("Invalid PCM source sample rate")
	}
	if (!Number.isFinite(targetSampleRate) || targetSampleRate <= 0) {
		throw new Error("Invalid PCM target sample rate")
	}
	if (pcmData.length === 0) return new Int16Array()
	if (sourceSampleRate === targetSampleRate) return new Int16Array(pcmData)

	const targetLength = Math.max(
		1,
		Math.round((pcmData.length * targetSampleRate) / sourceSampleRate),
	)
	const normalized = new Int16Array(targetLength)
	for (let index = 0; index < targetLength; index++) {
		const sourcePosition = (index * sourceSampleRate) / targetSampleRate
		const leftIndex = Math.min(Math.floor(sourcePosition), pcmData.length - 1)
		const rightIndex = Math.min(leftIndex + 1, pcmData.length - 1)
		const interpolation = sourcePosition - leftIndex
		normalized[index] = Math.round(
			pcmData[leftIndex] * (1 - interpolation) + pcmData[rightIndex] * interpolation,
		)
	}
	return normalized
}

/** Normalize a chunk before any file encoder sees its PCM payload. */
export function normalizeAudioChunk(
	chunkData: AudioChunkData,
	targetSampleRate: number = RECORDING_TARGET_SAMPLE_RATE,
): AudioChunkData {
	const pcmData = normalizePcm(chunkData.pcmData, chunkData.sampleRate, targetSampleRate)
	return {
		...chunkData,
		pcmData,
		sampleRate: targetSampleRate,
		duration: pcmData.length / targetSampleRate,
	}
}

import { RecordingConfig } from "@/types/recordSummary"

/**
 * Default recording configuration preferring Ogg/Opus with WAV fallback.
 * 默认配置，优先使用 Ogg/Opus，编码器不可用时回退到 WAV
 */
export const DEFAULT_RECORDING_CONFIG: RecordingConfig = {
	source: "recorder_core",
	mediaRecorder: {
		mimeType: "audio/ogg; codecs=opus", // Prefer compressed Ogg/Opus output
		audioBitsPerSecond: 32000, // Target Opus bitrate; WAV fallback keeps the PCM contract
		timeslice: 10000, // 10 seconds per chunk
		enableEchoCancellation: false,
		enableNoiseSuppression: false,
		autoGainControl: false,
	},
	upload: {
		chunkSizeThreshold: 15 * 1024 * 1024, // Increased from 10MB to 15MB to accommodate higher quality audio
		timeThreshold: 30 * 1000, // 30 seconds
		chunkCountThreshold: 100,
		maxConcurrentUploads: 3,
		maxRetryCount: 5,
	},
	persistence: {
		storagePrefix: "recordSummary",
		enableIndexedDB: true,
		autoCleanupDays: 7,
		maxStorageSize: 200 * 1024 * 1024, // Doubled from 100MB to 200MB for higher quality audio storage
	},
	sessionRestore: {
		autoRestore: true,
		confirmRestore: false,
		clearOnRestore: false,
	},
}

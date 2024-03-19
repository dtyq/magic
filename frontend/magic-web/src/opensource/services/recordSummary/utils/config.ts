import { RecordingConfig } from "@/opensource/types/recordSummary"

/**
 * Default recording configuration using Web Audio API for WAV recording
 * 默认配置，使用 Web Audio API 进行 WAV 录制
 */
export const DEFAULT_RECORDING_CONFIG: RecordingConfig = {
	source: "recorder_core",
	mediaRecorder: {
		mimeType: "audio/wav", // Default WAV format
		audioBitsPerSecond: 256000, // 16kHz * 16bit = 256kbps for WAV
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

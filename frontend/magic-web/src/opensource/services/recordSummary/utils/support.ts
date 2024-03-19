import { RecorderCoreAdapter } from "../MediaRecorderService/RecorderCoreAdapter"

/**
 * @deprecated This function checked for MediaRecorder support.
 * We now use Web Audio API which has its own browser compatibility checks.
 * Use RecorderCoreAdapter.isBrowserSupported() instead.
 */
export function isMediaRecorderSupported(_mimeType: string): boolean {
	// Redirect to audio recorder browser support check
	return RecorderCoreAdapter.isBrowserSupported()
}

/**
 * Check if audio recording is supported using Web Audio API
 * 检查是否支持使用 Web Audio API 进行音频录制
 */
export function isRecordingSupported(): boolean {
	return RecorderCoreAdapter.isBrowserSupported()
}

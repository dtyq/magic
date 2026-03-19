/**
 * MediaRecorder Polyfill Utility
 * Provides polyfill support for browsers that don't support MediaRecorder API natively
 *
 * @deprecated This utility is deprecated as we've migrated to Web Audio API for audio recording.
 * Web Audio API provides better browser compatibility and PCM support without requiring polyfills.
 * This file is kept for reference but is no longer actively used.
 */

let polyfillLoaded = false
let polyfillLoadingPromise: Promise<void> | null = null
let isUsingPolyfill = false

/**
 * Load audio-recorder-polyfill if MediaRecorder is not supported
 * 如果浏览器不支持 MediaRecorder，则加载 polyfill
 */
export async function ensureMediaRecorderSupport(): Promise<void> {
	// If already loading, return the existing promise to prevent duplicate loads
	if (polyfillLoadingPromise) {
		return polyfillLoadingPromise
	}

	// Check if MediaRecorder is already supported
	if (typeof MediaRecorder !== "undefined" && !polyfillLoaded) {
		// Native MediaRecorder exists, check if it supports common formats
		const testFormats = [
			"audio/webm",
			"audio/webm;codecs=opus",
			"audio/mp4",
			"audio/mp4;codecs=aac",
		]

		const hasSupport = testFormats.some((format) => {
			try {
				return MediaRecorder.isTypeSupported(format)
			} catch {
				return false
			}
		})

		if (hasSupport) {
			// Native support is good enough
			return
		}
	}

	// Load polyfill if not already loaded
	if (!polyfillLoaded) {
		polyfillLoadingPromise = (async () => {
			try {
				const AudioRecorderPolyfill = await import("audio-recorder-polyfill")

				// Apply polyfill to window.MediaRecorder
				if (AudioRecorderPolyfill.default) {
					window.MediaRecorder = AudioRecorderPolyfill.default as typeof MediaRecorder
					polyfillLoaded = true
					isUsingPolyfill = true

					console.log("[MediaRecorder] Polyfill loaded successfully (WAV format)")
				}
			} catch (error) {
				console.error("[MediaRecorder] Failed to load polyfill:", error)
				throw new Error("MediaRecorder is not supported and polyfill failed to load")
			} finally {
				// Clear the loading promise after completion
				polyfillLoadingPromise = null
			}
		})()

		return polyfillLoadingPromise
	}
}

/**
 * Check if MediaRecorder is supported (either natively or via polyfill)
 * 检查是否支持 MediaRecorder（原生或通过 polyfill）
 */
export function isMediaRecorderAvailable(): boolean {
	return typeof MediaRecorder !== "undefined"
}

/**
 * Check if using polyfill implementation
 * 检查是否使用 polyfill 实现
 */
export function isUsingMediaRecorderPolyfill(): boolean {
	return isUsingPolyfill
}

/**
 * Get the best supported MIME type for the current environment
 * 获取当前环境最佳支持的 MIME 类型
 *
 * Note: audio-recorder-polyfill only supports WAV format
 * 注意：audio-recorder-polyfill 仅支持 WAV 格式
 */
export function getBestSupportedMimeType(preferredTypes: string[] = []): string {
	if (!isMediaRecorderAvailable()) {
		return ""
	}

	// If using polyfill, it only supports WAV
	if (isUsingPolyfill) {
		console.log("[MediaRecorder] Using polyfill, defaulting to WAV format")
		return "audio/wav"
	}

	// Try preferred types for native MediaRecorder
	for (const mimeType of preferredTypes) {
		try {
			if (MediaRecorder.isTypeSupported(mimeType)) {
				return mimeType
			}
		} catch {
			// Continue to next type
		}
	}

	// Return empty string to use browser default
	return ""
}

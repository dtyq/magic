import { getBrowserInfo } from "@/providers/BrowserProvider/browser"
import { hasAudioWorkletSupport } from "@/services/recordSummary/MediaRecorderService/utils/AudioWorkletSupport"
import { recordingLogger } from "@/services/recordSummary/utils/RecordingLogger"

export type RecordingHealthStatus = "supported" | "partial" | "unsupported"

export interface RecordingHealthCheckResult {
	checkedAt: number
	browserName: string
	browserVersion: number
	platform: string
	userAgent: string
	isSecureContext: boolean
	hasGetUserMedia: boolean
	hasAudioContext: boolean
	hasAudioWorklet: boolean
	hasAudioWorkletNode: boolean
	processingMode: "worklet" | "script-processor"
	overallStatus: RecordingHealthStatus
}

const healthCheckLogger = recordingLogger.namespace("HealthCheck")

function hasGetUserMediaSupport(): boolean {
	if (typeof navigator === "undefined") return false

	const legacyNavigator = navigator as Navigator & {
		getUserMedia?: unknown
		webkitGetUserMedia?: unknown
		mozGetUserMedia?: unknown
	}

	return Boolean(
		navigator.mediaDevices?.getUserMedia ||
		legacyNavigator.getUserMedia ||
		legacyNavigator.webkitGetUserMedia ||
		legacyNavigator.mozGetUserMedia,
	)
}

function getAudioContextConstructor(): typeof AudioContext | undefined {
	if (typeof window === "undefined") return undefined

	const win = window as typeof window & { webkitAudioContext?: typeof AudioContext }
	return win.AudioContext ?? win.webkitAudioContext
}

/** Returns browser capabilities without requesting microphone permission. */
export function checkRecordingHealth(): RecordingHealthCheckResult {
	const browser =
		typeof navigator === "undefined" ? { name: "Unknown", version: 0 } : getBrowserInfo()
	const audioContextConstructor = getAudioContextConstructor()
	const hasAudioContext = typeof audioContextConstructor === "function"
	const hasAudioWorkletNode =
		typeof window !== "undefined" && typeof window.AudioWorkletNode !== "undefined"
	const hasAudioWorklet = hasAudioWorkletSupport()
	const hasGetUserMedia = hasGetUserMediaSupport()
	const isSecureContext = typeof window !== "undefined" && window.isSecureContext === true
	const requiredChecksPassed = isSecureContext && hasGetUserMedia && hasAudioContext
	const overallStatus: RecordingHealthStatus = !requiredChecksPassed
		? "unsupported"
		: hasAudioWorklet && hasAudioWorkletNode
			? "supported"
			: "partial"

	return {
		checkedAt: Date.now(),
		browserName: browser.name,
		browserVersion: browser.version,
		platform: typeof navigator === "undefined" ? "Unknown" : navigator.platform || "Unknown",
		userAgent: typeof navigator === "undefined" ? "" : navigator.userAgent,
		isSecureContext,
		hasGetUserMedia,
		hasAudioContext,
		hasAudioWorklet,
		hasAudioWorkletNode,
		processingMode: hasAudioWorklet && hasAudioWorkletNode ? "worklet" : "script-processor",
		overallStatus,
	}
}

/** Reports every user-triggered health check with browser and capability details. */
export function reportRecordingHealthCheck(result: RecordingHealthCheckResult): void {
	healthCheckLogger.report("Audio recording health check", {
		browserName: result.browserName,
		browserVersion: result.browserVersion,
		platform: result.platform,
		userAgent: result.userAgent,
		isSecureContext: result.isSecureContext,
		hasGetUserMedia: result.hasGetUserMedia,
		hasAudioContext: result.hasAudioContext,
		hasAudioWorklet: result.hasAudioWorklet,
		hasAudioWorkletNode: result.hasAudioWorkletNode,
		processingMode: result.processingMode,
		overallStatus: result.overallStatus,
		checkedAt: result.checkedAt,
	})
}

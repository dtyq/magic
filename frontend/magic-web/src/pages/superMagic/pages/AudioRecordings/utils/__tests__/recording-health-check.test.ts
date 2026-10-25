import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const { report } = vi.hoisted(() => ({ report: vi.fn() }))

vi.mock("@/providers/BrowserProvider/browser", () => ({
	getBrowserInfo: vi.fn(() => ({ name: "Edge", version: 152, isOutdated: false })),
}))

vi.mock("@/services/recordSummary/MediaRecorderService/utils/AudioWorkletSupport", () => ({
	hasAudioWorkletSupport: vi.fn(() => true),
}))

vi.mock("@/services/recordSummary/utils/RecordingLogger", () => ({
	recordingLogger: {
		namespace: vi.fn(() => ({ report })),
	},
}))

import { hasAudioWorkletSupport } from "@/services/recordSummary/MediaRecorderService/utils/AudioWorkletSupport"
import { checkRecordingHealth, reportRecordingHealthCheck } from "../recording-health-check"

const originalAudioContext = window.AudioContext
const originalAudioWorkletNode = window.AudioWorkletNode
const originalMediaDevices = navigator.mediaDevices
const originalPlatform = navigator.platform
const originalUserAgent = navigator.userAgent
const originalIsSecureContext = window.isSecureContext

function defineReadonly(target: object, key: PropertyKey, value: unknown) {
	Object.defineProperty(target, key, { configurable: true, value })
}

beforeEach(() => {
	vi.clearAllMocks()
	vi.mocked(hasAudioWorkletSupport).mockReturnValue(true)
	defineReadonly(window, "isSecureContext", true)
	defineReadonly(window, "AudioContext", class MockAudioContext {})
	defineReadonly(window, "AudioWorkletNode", class MockAudioWorkletNode {})
	defineReadonly(navigator, "mediaDevices", { getUserMedia: vi.fn() })
	defineReadonly(navigator, "platform", "Win32")
	defineReadonly(
		navigator,
		"userAgent",
		"Mozilla/5.0 Chrome/152.0.0.0 Safari/537.36 Edg/152.0.0.0",
	)
})

afterEach(() => {
	defineReadonly(window, "AudioContext", originalAudioContext)
	defineReadonly(window, "AudioWorkletNode", originalAudioWorkletNode)
	defineReadonly(window, "isSecureContext", originalIsSecureContext)
	defineReadonly(navigator, "mediaDevices", originalMediaDevices)
	defineReadonly(navigator, "platform", originalPlatform)
	defineReadonly(navigator, "userAgent", originalUserAgent)
})

describe("recording health check", () => {
	it("returns the browser, capability and preferred processing mode", () => {
		const result = checkRecordingHealth()

		expect(result).toMatchObject({
			browserName: "Edge",
			browserVersion: 152,
			platform: "Win32",
			isSecureContext: true,
			hasGetUserMedia: true,
			hasAudioContext: true,
			hasAudioWorklet: true,
			hasAudioWorkletNode: true,
			processingMode: "worklet",
			overallStatus: "supported",
		})
	})

	it("uses compatibility mode when AudioWorklet is unavailable", () => {
		vi.mocked(hasAudioWorkletSupport).mockReturnValue(false)

		expect(checkRecordingHealth()).toMatchObject({
			hasAudioWorklet: false,
			processingMode: "script-processor",
			overallStatus: "partial",
		})
	})

	it("reports the complete user-triggered result", () => {
		const result = checkRecordingHealth()

		reportRecordingHealthCheck(result)

		expect(report).toHaveBeenCalledWith(
			"Audio recording health check",
			expect.objectContaining({
				browserName: "Edge",
				browserVersion: 152,
				platform: "Win32",
				userAgent: expect.stringContaining("Edg/152"),
				isSecureContext: true,
				hasGetUserMedia: true,
				hasAudioContext: true,
				hasAudioWorklet: true,
				hasAudioWorkletNode: true,
				processingMode: "worklet",
				overallStatus: "supported",
				checkedAt: result.checkedAt,
			}),
		)
	})
})

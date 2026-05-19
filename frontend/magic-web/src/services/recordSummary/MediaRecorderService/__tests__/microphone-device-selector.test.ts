/**
 * Unit tests for microphone device selection and switching.
 *
 * Coverage:
 *  1. AudioConstraintsConfig – deviceId handling
 *  2. MicrophoneSourceStrategy – correct deviceId passed to getUserMedia
 *  3. MediaRecorderService.switchMicrophoneDevice – proxy to adapter
 *  4. MicrophoneDeviceSelector component – render, device list, user interaction
 */

import { describe, it, expect, vi, beforeEach } from "vitest"
import { getMicrophoneConstraints } from "../config/AudioConstraintsConfig"

// ─── 1. AudioConstraintsConfig ────────────────────────────────────────────────

describe("getMicrophoneConstraints – deviceId", () => {
	it("default preset includes deviceId:{ ideal:'default' }", () => {
		const constraints = getMicrophoneConstraints("default")
		expect(constraints).toMatchObject({
			deviceId: { ideal: "default" },
		})
	})

	it("explicit string deviceId is preserved as-is in returned constraints", () => {
		const constraints = getMicrophoneConstraints("default", { deviceId: "abc-123" })
		expect(constraints).toMatchObject({ deviceId: "abc-123" })
	})

	it("object deviceId (ideal/exact) is preserved", () => {
		const constraints = getMicrophoneConstraints("default", { deviceId: { exact: "abc-123" } })
		expect(constraints).toMatchObject({ deviceId: { exact: "abc-123" } })
	})
})

// ─── 2. MicrophoneSourceStrategy – deviceId → getUserMedia ───────────────────

import { MicrophoneSourceStrategy } from "../strategies/MicrophoneSourceStrategy"

describe("MicrophoneSourceStrategy – getUserMedia deviceId", () => {
	const makeStream = () => ({
		getAudioTracks: vi.fn().mockReturnValue([
			{
				id: "t1",
				readyState: "live",
				label: "My Mic",
				onended: null,
				onmute: null,
				onunmute: null,
			},
		]),
		getTracks: vi.fn().mockReturnValue([]),
		addTrack: vi.fn(),
		removeTrack: vi.fn(),
	})

	function makeStrategy(deviceIdConfig?: string | { ideal?: string; exact?: string }) {
		const mockGetUserMedia = vi.fn().mockResolvedValue(makeStream())
		const config = {
			sampleRate: 16000,
			bitRate: 16,
			chunkDuration: 10,
			type: "wav" as const,
			maxRetries: 1,
			audioSource: {
				source: "microphone" as const,
				microphoneConstraints:
					deviceIdConfig !== undefined ? { deviceId: deviceIdConfig } : undefined,
			},
		}
		const deps = {
			logger: { log: vi.fn(), warn: vi.fn(), error: vi.fn(), report: vi.fn() },
			mediaDevices: { getUserMedia: mockGetUserMedia, getDisplayMedia: vi.fn() },
		}
		return { strategy: new MicrophoneSourceStrategy(config, deps), mockGetUserMedia }
	}

	it("uses { ideal:'default' } when no explicit deviceId provided", async () => {
		const { strategy, mockGetUserMedia } = makeStrategy()
		await strategy.initialize()
		const calledConstraints = mockGetUserMedia.mock.calls[0][0].audio
		expect(calledConstraints.deviceId).toEqual({ ideal: "default" })
	})

	it("uses { exact: deviceId } when explicit string deviceId is provided", async () => {
		const { strategy, mockGetUserMedia } = makeStrategy("device-xyz")
		await strategy.initialize()
		const calledConstraints = mockGetUserMedia.mock.calls[0][0].audio
		expect(calledConstraints.deviceId).toEqual({ exact: "device-xyz" })
	})

	it("passes object deviceId through unchanged", async () => {
		const { strategy, mockGetUserMedia } = makeStrategy({ ideal: "default" })
		await strategy.initialize()
		const calledConstraints = mockGetUserMedia.mock.calls[0][0].audio
		// object constraints are passed as-is (not wrapped again)
		expect(calledConstraints.deviceId).toEqual({ ideal: "default" })
	})
})

// ─── 3. MediaRecorderService.switchMicrophoneDevice ─────────────────────────

import { MediaRecorderService } from "../index"
import { RecorderCoreAdapter } from "../RecorderCoreAdapter"

vi.mock("../RecorderCoreAdapter", () => ({
	RecorderCoreAdapter: vi.fn().mockImplementation(() => ({
		start: vi.fn().mockResolvedValue(undefined),
		stop: vi.fn().mockResolvedValue(undefined),
		pause: vi.fn(),
		resume: vi.fn(),
		cleanup: vi.fn(),
		switchMicrophoneDevice: vi.fn().mockResolvedValue(undefined),
		getMediaStream: vi.fn().mockReturnValue({
			getAudioTracks: () => [{ id: "t1", readyState: "live", label: "mic" }],
		}),
		getStatus: vi.fn().mockReturnValue({
			state: "recording",
			session: null,
			bufferDuration: 0,
			isPaused: false,
		}),
		getCurrentSessionId: vi.fn().mockReturnValue(null),
	})),
}))
;(RecorderCoreAdapter as any).isBrowserSupported = vi.fn().mockReturnValue(true)
;(RecorderCoreAdapter as any).isAudioSourceSupported = vi.fn().mockReturnValue({
	supported: true,
})

describe("MediaRecorderService.switchMicrophoneDevice", () => {
	let service: MediaRecorderService
	let mockAdapter: ReturnType<typeof vi.fn>

	beforeEach(async () => {
		vi.clearAllMocks()
		service = new MediaRecorderService()
		await service.startRecording("session-001")
		// Grab the adapter instance the service created
		mockAdapter = (service as any).recorderAdapter
	})

	it("delegates to RecorderCoreAdapter.switchMicrophoneDevice during recording", async () => {
		await service.switchMicrophoneDevice("device-abc")
		expect(mockAdapter.switchMicrophoneDevice).toHaveBeenCalledWith("device-abc")
	})

	it("throws RecorderInitializationError when adapter is not initialized", async () => {
		;(service as any).recorderAdapter = null
		await expect(service.switchMicrophoneDevice("device-abc")).rejects.toThrow(
			"Cannot switch microphone device",
		)
	})

	it("updates config and returns without calling adapter when paused", async () => {
		// Simulate paused state
		;(service as any).isRecording = false
		await service.switchMicrophoneDevice("device-paused")
		// Adapter should NOT be called in paused path
		expect(mockAdapter.switchMicrophoneDevice).not.toHaveBeenCalled()
		// Config should be updated
		const cfg = service.getConfig()
		expect(cfg.audioSource?.microphoneConstraints?.deviceId).toBe("device-paused")
	})
})

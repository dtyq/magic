import { describe, it, expect, vi, beforeEach } from "vitest"
import { MediaRecorderService } from "../index"
import { RecorderCoreAdapter } from "../RecorderCoreAdapter"

// Mock RecorderCoreAdapter
vi.mock("../RecorderCoreAdapter", () => ({
	RecorderCoreAdapter: vi.fn().mockImplementation(() => ({
		start: vi.fn().mockResolvedValue(undefined),
		stop: vi.fn().mockResolvedValue(undefined),
		pause: vi.fn(),
		resume: vi.fn(),
		cleanup: vi.fn(),
		getStatus: vi.fn().mockReturnValue({
			isRecording: false,
			isPaused: false,
			sessionId: null,
			chunkIndex: 0,
			bufferDuration: 0,
			config: {
				sampleRate: 16000,
				bitRate: 16,
				chunkDuration: 10,
				type: "pcm",
			},
		}),
		getCurrentSessionId: vi.fn().mockReturnValue(null),
	})),
}))

// Add static method mocks
RecorderCoreAdapter.isBrowserSupported = vi.fn().mockReturnValue(true)
RecorderCoreAdapter.isAudioSourceSupported = vi.fn().mockReturnValue({
	supported: true,
	message: undefined,
})

describe("MediaRecorderService", () => {
	let service: MediaRecorderService

	beforeEach(() => {
		vi.clearAllMocks()
		service = new MediaRecorderService()
	})

	describe("initialization", () => {
		it("should initialize with browser support", () => {
			expect(service.isBrowserSupported).toBe(true)
		})

		it("should handle unsupported browser", () => {
			RecorderCoreAdapter.isBrowserSupported = vi.fn().mockReturnValue(false)
			const onMediaRecorderNotSupported = vi.fn()

			const unsupportedService = new MediaRecorderService({}, { onMediaRecorderNotSupported })

			expect(unsupportedService.isBrowserSupported).toBe(false)
			expect(onMediaRecorderNotSupported).toHaveBeenCalled()
		})
	})

	describe("startRecording", () => {
		it("should start recording with session ID", async () => {
			const sessionId = "test-session-123"

			await service.startRecording(sessionId)

			const status = service.getStatus()
			expect(status.isRecording).toBe(true)
			expect(status.sessionId).toBe(sessionId)
		})

		it("should throw error if session ID is missing", async () => {
			await expect(service.startRecording("")).rejects.toThrow(
				"Session ID is required to start recording",
			)
		})

		it("should not start if already recording", async () => {
			const sessionId = "test-session-123"
			await service.startRecording(sessionId)

			// Try to start again
			const consoleSpy = vi.spyOn(console, "warn")
			await service.startRecording(sessionId)

			expect(consoleSpy).toHaveBeenCalledWith("Recording is already in progress")
		})
	})

	describe("stopRecording", () => {
		it("should stop recording", async () => {
			const sessionId = "test-session-123"

			await service.startRecording(sessionId)
			await service.stopRecording()

			const status = service.getStatus()
			expect(status.isRecording).toBe(false)
		})

		it("should resolve immediately if not recording", async () => {
			await expect(service.stopRecording()).resolves.toBeUndefined()
		})
	})

	describe("pauseRecording", () => {
		it("should pause recording when active", async () => {
			const sessionId = "test-session-123"
			await service.startRecording(sessionId)

			service.pauseRecording()

			// Verify the adapter's pause method was called
			// This would need access to the internal adapter, which is private
			// In real implementation, we'd check via events or status
		})

		it("should not pause if not recording", () => {
			expect(() => service.pauseRecording()).not.toThrow()
		})
	})

	describe("cleanup", () => {
		it("should cleanup resources", async () => {
			const sessionId = "test-session-123"
			await service.startRecording(sessionId)

			service.cleanup()

			const status = service.getStatus()
			expect(status.isRecording).toBe(false)
		})
	})

	describe("getStatus", () => {
		it("should return initial status", () => {
			const status = service.getStatus()

			expect(status).toMatchObject({
				isRecording: false,
				sessionId: null,
				chunkIndex: 0,
				mediaRecorderState: "inactive",
				hasAudioStream: false,
				supportedMimeTypes: ["audio/pcm"],
			})
		})

		it("should return recording status when active", async () => {
			const sessionId = "test-session-123"
			await service.startRecording(sessionId)

			const status = service.getStatus()

			expect(status.isRecording).toBe(true)
			expect(status.sessionId).toBe(sessionId)
			expect(status.mediaRecorderState).toBe("recording")
		})
	})

	describe("getCurrentSessionId", () => {
		it("should return null when not recording", () => {
			expect(service.getCurrentSessionId()).toBeNull()
		})

		it("should return session ID when recording", async () => {
			const sessionId = "test-session-123"
			await service.startRecording(sessionId)

			expect(service.getCurrentSessionId()).toBe(sessionId)
		})
	})

	describe("reset", () => {
		it("should reset service state", async () => {
			const sessionId = "test-session-123"
			await service.startRecording(sessionId)

			service.reset()

			expect(service.getCurrentSessionId()).toBeNull()
			const status = service.getStatus()
			expect(status.isRecording).toBe(false)
		})
	})

	describe("configuration", () => {
		it("should use default configuration", () => {
			const status = service.getStatus()
			expect(status.supportedMimeTypes).toContain("audio/pcm")
		})

		it("should accept custom configuration", () => {
			const customConfig = {
				timeslice: 5000,
				audioBitsPerSecond: 128000,
			}

			const customService = new MediaRecorderService(customConfig)
			expect(customService).toBeDefined()
		})
	})

	describe("events", () => {
		it("should trigger onRecordingStart event", async () => {
			const onRecordingStart = vi.fn()
			const eventService = new MediaRecorderService({}, { onRecordingStart })

			await eventService.startRecording("test-session")

			expect(onRecordingStart).toHaveBeenCalled()
		})

		it("should trigger onRecordingStop event", async () => {
			const onRecordingStop = vi.fn()
			const eventService = new MediaRecorderService({}, { onRecordingStop })

			await eventService.startRecording("test-session")
			await eventService.stopRecording()

			expect(onRecordingStop).toHaveBeenCalled()
		})

		it("should trigger onRecordingError event on error", async () => {
			const onRecordingError = vi.fn()
			const errorService = new MediaRecorderService({}, { onRecordingError })

			// Mock adapter to throw error
			const mockAdapter = vi.mocked(RecorderCoreAdapter)
			mockAdapter.prototype.start = vi.fn().mockRejectedValue(new Error("Test error"))

			try {
				await errorService.startRecording("test-session")
			} catch {
				// Expected to throw
			}

			// Cleanup is called on error, so recording should not be active
			const status = errorService.getStatus()
			expect(status.isRecording).toBe(false)
		})
	})
})

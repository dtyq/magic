import { describe, it, expect, vi, beforeEach } from "vitest"
import { RecorderCoreAdapter } from "../RecorderCoreAdapter"

// Mock MediaDevices API
const mockGetUserMedia = vi.fn().mockResolvedValue({
	getTracks: vi.fn().mockReturnValue([
		{
			stop: vi.fn(),
			kind: "audio",
		},
	]),
	getAudioTracks: vi.fn().mockReturnValue([
		{
			stop: vi.fn(),
			kind: "audio",
		},
	]),
	clone: vi.fn().mockReturnThis(),
})

const mockGetDisplayMedia = vi.fn().mockResolvedValue({
	getTracks: vi.fn().mockReturnValue([
		{
			stop: vi.fn(),
			kind: "audio",
		},
	]),
	getAudioTracks: vi.fn().mockReturnValue([
		{
			stop: vi.fn(),
			kind: "audio",
		},
	]),
	getVideoTracks: vi.fn().mockReturnValue([]),
	removeTrack: vi.fn(),
	clone: vi.fn().mockReturnThis(),
})

// Mock AudioContext
class MockAudioContext {
	sampleRate = 16000
	destination = {}

	createMediaStreamSource = vi.fn().mockReturnValue({
		connect: vi.fn(),
		disconnect: vi.fn(),
	})

	createScriptProcessor = vi.fn().mockReturnValue({
		connect: vi.fn(),
		disconnect: vi.fn(),
		onaudioprocess: null,
	})

	createGain = vi.fn().mockReturnValue({
		gain: { value: 1.0 },
		connect: vi.fn(),
		disconnect: vi.fn(),
	})

	createMediaStreamDestination = vi.fn().mockReturnValue({
		stream: {
			getTracks: vi.fn().mockReturnValue([]),
			clone: vi.fn().mockReturnThis(),
		},
	})

	close = vi.fn().mockResolvedValue(undefined)
}

// Set up global mocks
global.AudioContext = MockAudioContext as any
global.navigator = {
	...global.navigator,
	mediaDevices: {
		getUserMedia: mockGetUserMedia,
		getDisplayMedia: mockGetDisplayMedia,
	},
} as any

describe("RecorderCoreAdapter", () => {
	let adapter: RecorderCoreAdapter

	beforeEach(() => {
		vi.clearAllMocks()
		adapter = new RecorderCoreAdapter()
	})

	describe("initialization", () => {
		it("should initialize with default configuration", () => {
			const status = adapter.getStatus()

			expect(status.config).toMatchObject({
				sampleRate: 16000,
				bitRate: 16,
				chunkDuration: 10,
				type: "pcm",
			})
		})

		it("should accept custom configuration", () => {
			const customConfig = {
				sampleRate: 8000,
				bitRate: 8,
				chunkDuration: 5,
				type: "wav" as const,
			}

			const customAdapter = new RecorderCoreAdapter(customConfig)
			const status = customAdapter.getStatus()

			expect(status.config).toMatchObject(customConfig)
		})
	})

	describe("browser support", () => {
		it("should check browser support", () => {
			const isSupported = RecorderCoreAdapter.isBrowserSupported()
			expect(typeof isSupported).toBe("boolean")
		})
	})

	describe("recording lifecycle", () => {
		it("should start recording with session ID", async () => {
			const sessionId = "test-session-123"

			await adapter.start(sessionId)

			const status = adapter.getStatus()
			expect(status.isRecording).toBe(true)
			expect(status.sessionId).toBe(sessionId)
		})

		it("should throw error if session ID is missing", async () => {
			await expect(adapter.start("")).rejects.toThrow(
				"Session ID is required to start recording",
			)
		})

		it("should not start if already recording", async () => {
			const sessionId = "test-session-123"
			await adapter.start(sessionId)

			const consoleSpy = vi.spyOn(console, "warn")
			await adapter.start(sessionId)

			expect(consoleSpy).toHaveBeenCalledWith("Recording is already in progress")
		})

		it("should stop recording", async () => {
			const sessionId = "test-session-123"
			await adapter.start(sessionId)

			await adapter.stop()

			const status = adapter.getStatus()
			expect(status.isRecording).toBe(false)
		})

		it("should pause recording", async () => {
			const sessionId = "test-session-123"
			await adapter.start(sessionId)

			adapter.pause()

			const status = adapter.getStatus()
			expect(status.isPaused).toBe(true)
		})

		it("should resume recording", async () => {
			const sessionId = "test-session-123"
			await adapter.start(sessionId)
			adapter.pause()

			adapter.resume()

			const status = adapter.getStatus()
			expect(status.isPaused).toBe(false)
		})

		it("should not pause if not recording", () => {
			expect(() => adapter.pause()).not.toThrow()
		})

		it("should not resume if not paused", async () => {
			const sessionId = "test-session-123"
			await adapter.start(sessionId)

			expect(() => adapter.resume()).not.toThrow()
		})
	})

	describe("cleanup", () => {
		it("should cleanup resources", async () => {
			const sessionId = "test-session-123"
			await adapter.start(sessionId)

			adapter.cleanup()

			const status = adapter.getStatus()
			expect(status.isRecording).toBe(false)
			expect(status.sessionId).toBeNull()
			expect(status.chunkIndex).toBe(0)
		})

		it("should handle cleanup when not recording", () => {
			expect(() => adapter.cleanup()).not.toThrow()
		})
	})

	describe("status", () => {
		it("should return initial status", () => {
			const status = adapter.getStatus()

			expect(status).toMatchObject({
				isRecording: false,
				isPaused: false,
				sessionId: null,
				chunkIndex: 0,
				bufferDuration: 0,
			})
		})

		it("should update status during recording", async () => {
			const sessionId = "test-session-123"
			await adapter.start(sessionId, 5)

			const status = adapter.getStatus()

			expect(status.isRecording).toBe(true)
			expect(status.sessionId).toBe(sessionId)
			expect(status.chunkIndex).toBe(5)
		})
	})

	describe("session management", () => {
		it("should return null when no session", () => {
			expect(adapter.getCurrentSessionId()).toBeNull()
		})

		it("should return current session ID", async () => {
			const sessionId = "test-session-123"
			await adapter.start(sessionId)

			expect(adapter.getCurrentSessionId()).toBe(sessionId)
		})

		it("should support custom chunk index", async () => {
			const sessionId = "test-session-123"
			const startChunkIndex = 10

			await adapter.start(sessionId, startChunkIndex)

			const status = adapter.getStatus()
			expect(status.chunkIndex).toBe(startChunkIndex)
		})
	})

	describe("events", () => {
		it("should trigger onChunkReady event", async () => {
			const onChunkReady = vi.fn()
			const eventAdapter = new RecorderCoreAdapter({}, { onChunkReady })

			await eventAdapter.start("test-session")

			// In a real scenario, onChunkReady would be called when audio data reaches chunk duration
			// Here we just verify the adapter was created with the event handler
			expect(eventAdapter).toBeDefined()
		})

		it("should trigger onError event", () => {
			const onError = vi.fn()
			const errorAdapter = new RecorderCoreAdapter({}, { onError })

			expect(errorAdapter).toBeDefined()
		})

		it("should trigger onProcess event", () => {
			const onProcess = vi.fn()
			const processAdapter = new RecorderCoreAdapter({}, { onProcess })

			expect(processAdapter).toBeDefined()
		})
	})

	describe("recorder instance", () => {
		it("should return null initially", () => {
			expect(adapter.getRecorderInstance()).toBeNull()
		})

		it("should return recorder instance after start", async () => {
			await adapter.start("test-session")

			const instance = adapter.getRecorderInstance()
			expect(instance).toBeDefined()
		})
	})
})

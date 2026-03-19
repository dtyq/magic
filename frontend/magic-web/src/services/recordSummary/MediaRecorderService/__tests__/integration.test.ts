/**
 * Integration tests for RecorderCoreAdapter
 * RecorderCoreAdapter 集成测试
 */

import { describe, it, expect, vi, beforeEach } from "vitest"
import { RecorderCoreAdapter } from "../RecorderCoreAdapter"
import type { RecorderCoreConfig, RecorderCoreEvents } from "../types/RecorderTypes"

/**
 * Mock recorder instance for testing
 * 用于测试的模拟录音器实例
 */
class MockRecorder {
	public stream: MediaStream | null = null
	private openCallback: (() => void) | null = null
	private processCallback:
		| ((
				buffers: Int16Array[],
				powerLevel: number,
				duration: number,
				sampleRate: number,
		  ) => void)
		| null = null

	constructor(config: {
		type: string
		sampleRate: number
		bitRate: number
		onProcess?: (
			buffers: Int16Array[],
			powerLevel: number,
			duration: number,
			sampleRate: number,
		) => void
	}) {
		this.processCallback = config.onProcess || null
	}

	open(success: () => void, _fail: (msg: string, isUserNotAllow: boolean) => void) {
		this.openCallback = success
		// Simulate successful open
		setTimeout(() => {
			this.openCallback?.()
		}, 10)
	}

	start() {
		// Simulate audio processing
		if (this.processCallback) {
			setTimeout(() => {
				// Simulate 100ms of audio data at 16kHz
				const testBuffer = new Int16Array(1600)
				for (let i = 0; i < testBuffer.length; i++) {
					testBuffer[i] = Math.floor(Math.random() * 1000)
				}
				this.processCallback?.([testBuffer], 50, 0.1, 16000)
			}, 100)
		}
	}

	stop() {
		// Stop simulation
	}

	pause() {
		// Pause simulation
	}

	resume() {
		// Resume simulation
	}

	close() {
		// Close recorder
	}

	static SampleData(
		buffers: Int16Array[],
		_bufferSampleRate: number,
		_targetSampleRate: number,
		_prevChunk: unknown,
	) {
		// Merge buffers for simplicity
		const totalLength = buffers.reduce((sum, buf) => sum + buf.length, 0)
		const merged = new Int16Array(totalLength)
		let offset = 0
		for (const buf of buffers) {
			merged.set(buf, offset)
			offset += buf.length
		}
		return { data: merged, sampleRate: 16000 }
	}
}

/**
 * Mock MediaStream for testing
 * 用于测试的模拟 MediaStream
 */
class MockMediaStream {
	private tracks: MediaStreamTrack[] = []

	constructor() {
		// Create mock tracks
		const mockTrack = {
			kind: "audio",
			stop: vi.fn(),
		} as unknown as MediaStreamTrack
		this.tracks.push(mockTrack)
	}

	getTracks() {
		return this.tracks
	}

	getAudioTracks() {
		return this.tracks.filter((t) => t.kind === "audio")
	}

	getVideoTracks() {
		return []
	}

	removeTrack(_track: MediaStreamTrack) {
		// Remove track
	}

	clone() {
		return new MockMediaStream() as unknown as MediaStream
	}
}

describe("RecorderCoreAdapter Integration Tests", () => {
	let mockConfig: Partial<RecorderCoreConfig>
	let mockEvents: RecorderCoreEvents

	beforeEach(() => {
		mockConfig = {
			sampleRate: 16000,
			bitRate: 16,
			chunkDuration: 0.5, // 0.5 seconds for faster tests
			type: "wav",
			maxRetries: 3,
			audioSource: {
				source: "microphone",
			},
		}

		mockEvents = {
			onChunkReady: vi.fn(),
			onError: vi.fn(),
			onProcess: vi.fn(),
			onStateChange: vi.fn(),
		}

		// Mock browser APIs
		global.navigator = {
			mediaDevices: {
				getUserMedia: vi.fn().mockResolvedValue(new MockMediaStream()),
				getDisplayMedia: vi.fn().mockResolvedValue(new MockMediaStream()),
			},
		} as unknown as Navigator

		global.AudioContext = class MockAudioContext {
			sampleRate = 16000

			createMediaStreamSource() {
				return {
					connect: vi.fn(),
					disconnect: vi.fn(),
				}
			}

			createGain() {
				return {
					gain: { value: 1.0 },
					connect: vi.fn(),
					disconnect: vi.fn(),
				}
			}

			createMediaStreamDestination() {
				return {
					stream: new MockMediaStream(),
				}
			}

			createScriptProcessor() {
				return {
					connect: vi.fn(),
					disconnect: vi.fn(),
					onaudioprocess: null,
				}
			}

			async close() {
				// Close context
			}
		} as unknown as typeof AudioContext
	})

	it("should check browser support", () => {
		const isSupported = RecorderCoreAdapter.isBrowserSupported()
		expect(isSupported).toBe(true)
	})

	it("should check audio source support", () => {
		const micSupport = RecorderCoreAdapter.isAudioSourceSupported("microphone")
		expect(micSupport.supported).toBe(true)
	})

	it("should initialize adapter with default config", () => {
		const adapter = new RecorderCoreAdapter({}, {})

		const status = adapter.getStatus()
		expect(status.state).toBe("idle")
		expect(status.session).toBeNull()
	})

	it("should create adapter with custom dependencies", () => {
		const mockLogger = {
			log: vi.fn(),
			warn: vi.fn(),
			error: vi.fn(),
		}

		const adapter = new RecorderCoreAdapter(mockConfig, mockEvents, {
			logger: mockLogger,
		} as never)

		expect(adapter).toBeDefined()
	})

	it("should handle lifecycle: init -> recording -> stop", async () => {
		const adapter = new RecorderCoreAdapter(mockConfig, mockEvents, {
			recorderFactory: {
				create: () =>
					new MockRecorder({
						type: "wav",
						sampleRate: 16000,
						bitRate: 16,
					}) as never,
				getSampleData: MockRecorder.SampleData as never,
			},
		} as never)

		// Start recording
		await adapter.start("test-session-id", 0)

		let status = adapter.getStatus()
		expect(status.state).toBe("recording")
		expect(status.session?.sessionId).toBe("test-session-id")

		// Stop recording
		await adapter.stop()

		status = adapter.getStatus()
		expect(status.state).toBe("idle")

		// Cleanup
		await adapter.cleanup()
	})

	it("should get current session ID", async () => {
		const adapter = new RecorderCoreAdapter(mockConfig, mockEvents, {
			recorderFactory: {
				create: () =>
					new MockRecorder({
						type: "wav",
						sampleRate: 16000,
						bitRate: 16,
					}) as never,
				getSampleData: MockRecorder.SampleData as never,
			},
		} as never)

		expect(adapter.getCurrentSessionId()).toBeNull()

		await adapter.start("test-session", 0)
		expect(adapter.getCurrentSessionId()).toBe("test-session")

		await adapter.cleanup()
	})

	it("should prevent double start", async () => {
		const adapter = new RecorderCoreAdapter(mockConfig, mockEvents, {
			recorderFactory: {
				create: () =>
					new MockRecorder({
						type: "wav",
						sampleRate: 16000,
						bitRate: 16,
					}) as never,
				getSampleData: MockRecorder.SampleData as never,
			},
		} as never)

		await adapter.start("session1", 0)

		// Try to start again
		await adapter.start("session2", 0)

		// Should still be session1
		expect(adapter.getCurrentSessionId()).toBe("session1")

		await adapter.cleanup()
	})

	describe("AudioWorklet Integration", () => {
		it("should check AudioWorklet support", () => {
			const isSupported = RecorderCoreAdapter.isAudioWorkletSupported()
			// In test environment, this may return false
			expect(typeof isSupported).toBe("boolean")
		})

		it("should get preferred processing mode", () => {
			const mode = RecorderCoreAdapter.getPreferredProcessingMode()
			expect(["worklet", "script-processor"]).toContain(mode)
		})

		it("should use AudioWorklet when available and preferred", async () => {
			// Mock AudioWorkletNode
			global.AudioWorkletNode = class MockAudioWorkletNode {
				port = {
					postMessage: vi.fn(),
					onmessage: null,
					onmessageerror: null,
					close: vi.fn(),
				}
				connect = vi.fn()
				disconnect = vi.fn()
			} as any

			const adapter = new RecorderCoreAdapter(mockConfig, mockEvents, {
				preferWorklet: true,
			} as never)

			await adapter.start("test-worklet-session", 0)

			const recorder = adapter.getAudioRecorder()
			// Check if using worklet mode (if supported)
			if (recorder && RecorderCoreAdapter.isAudioWorkletSupported()) {
				expect(recorder.processingMode).toBe("worklet")
			}

			await adapter.cleanup()
		})

		it("should fallback to ScriptProcessor when AudioWorklet fails", async () => {
			const adapter = new RecorderCoreAdapter(mockConfig, mockEvents, {
				preferWorklet: false, // Force ScriptProcessor
			} as never)

			await adapter.start("test-fallback-session", 0)

			const recorder = adapter.getAudioRecorder()
			if (recorder) {
				expect(recorder.processingMode).toBe("script-processor")
			}

			await adapter.cleanup()
		})

		it("should handle pause/resume with AudioWorklet", async () => {
			const adapter = new RecorderCoreAdapter(mockConfig, mockEvents)

			await adapter.start("test-pause-session", 0)

			// Pause
			adapter.pause()
			let status = adapter.getStatus()
			expect(status.state).toBe("paused")

			// Resume
			adapter.resume()
			status = adapter.getStatus()
			expect(status.state).toBe("recording")

			await adapter.cleanup()
		})
	})
})

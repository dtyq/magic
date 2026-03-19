/**
 * Tests for AudioWorkletManager
 * AudioWorkletManager 的测试
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { AudioWorkletManager } from "../managers/AudioWorkletManager"

// Mock logger
const mockLogger = {
	log: vi.fn(),
	warn: vi.fn(),
	error: vi.fn(),
}

// Mock AudioContext
class MockAudioContext {
	sampleRate = 16000
	audioWorklet = {
		addModule: vi.fn().mockResolvedValue(undefined),
	}

	createMediaStreamSource = vi.fn().mockReturnValue({
		connect: vi.fn(),
		disconnect: vi.fn(),
	})

	async close() {
		// Close context
	}
}

// Mock AudioWorkletNode
class MockAudioWorkletNode {
	port = {
		postMessage: vi.fn(),
		onmessage: null as ((event: MessageEvent) => void) | null,
		onmessageerror: null as ((event: Event) => void) | null,
		close: vi.fn(),
	}

	connect = vi.fn()
	disconnect = vi.fn()
}

// Set up global mocks
global.AudioContext = MockAudioContext as any
global.AudioWorkletNode = MockAudioWorkletNode as any

describe("AudioWorkletManager", () => {
	let manager: AudioWorkletManager
	let audioContext: MockAudioContext

	beforeEach(() => {
		vi.clearAllMocks()
		manager = new AudioWorkletManager(mockLogger)
		audioContext = new MockAudioContext()
	})

	afterEach(async () => {
		await manager.cleanup()
	})

	describe("loadWorklet", () => {
		it("should load worklet module successfully", async () => {
			await manager.loadWorklet(audioContext as any)

			expect(audioContext.audioWorklet.addModule).toHaveBeenCalled()
			expect(manager.isLoaded()).toBe(true)
			expect(mockLogger.log).toHaveBeenCalledWith("AudioWorklet loaded successfully")
		})

		it("should not load worklet twice", async () => {
			await manager.loadWorklet(audioContext as any)
			await manager.loadWorklet(audioContext as any)

			expect(audioContext.audioWorklet.addModule).toHaveBeenCalledTimes(1)
			expect(mockLogger.log).toHaveBeenCalledWith("AudioWorklet already loaded")
		})

		it("should throw error if worklet fails to load", async () => {
			const error = new Error("Failed to load")
			audioContext.audioWorklet.addModule = vi.fn().mockRejectedValue(error)

			await expect(manager.loadWorklet(audioContext as any)).rejects.toThrow()
			expect(mockLogger.error).toHaveBeenCalled()
		})
	})

	describe("createWorkletNode", () => {
		beforeEach(async () => {
			await manager.loadWorklet(audioContext as any)
		})

		it("should create worklet node successfully", () => {
			const node = manager.createWorkletNode(audioContext as any)

			expect(node).toBeInstanceOf(MockAudioWorkletNode)
			expect(manager.getWorkletNode()).toBe(node)
			expect(mockLogger.log).toHaveBeenCalledWith("AudioWorkletNode created successfully")
		})

		it("should throw error if worklet not loaded", () => {
			const freshManager = new AudioWorkletManager(mockLogger)

			expect(() => freshManager.createWorkletNode(audioContext as any)).toThrow(
				"AudioWorklet module not loaded",
			)
		})
	})

	describe("setupMessageHandler", () => {
		let node: MockAudioWorkletNode
		let onAudioData: ReturnType<typeof vi.fn>
		let onError: ReturnType<typeof vi.fn>

		beforeEach(async () => {
			await manager.loadWorklet(audioContext as any)
			node = manager.createWorkletNode(audioContext as any) as any
			onAudioData = vi.fn()
			onError = vi.fn()
		})

		it("should set up message handler for audio data", () => {
			manager.setupMessageHandler(node as any, onAudioData, onError)

			expect(node.port.onmessage).not.toBeNull()
			expect(mockLogger.log).toHaveBeenCalledWith("AudioWorklet message handler set up")
		})

		it("should handle audio data messages", () => {
			manager.setupMessageHandler(node as any, onAudioData, onError)

			// Create mock audio data
			const buffer = new Int16Array([1, 2, 3, 4, 5])
			const message = {
				type: "audioData",
				data: buffer.buffer,
				length: buffer.length,
			}

			// Trigger message handler
			if (node.port.onmessage) {
				node.port.onmessage(new MessageEvent("message", { data: message }))
			}

			expect(onAudioData).toHaveBeenCalled()
			const receivedBuffer = onAudioData.mock.calls[0][0]
			expect(receivedBuffer).toBeInstanceOf(Int16Array)
			expect(receivedBuffer.length).toBe(5)
		})

		it("should handle error messages", () => {
			manager.setupMessageHandler(node as any, onAudioData, onError)

			const message = {
				type: "error",
				error: "Test error",
			}

			// Trigger message handler
			if (node.port.onmessage) {
				node.port.onmessage(new MessageEvent("message", { data: message }))
			}

			expect(onError).toHaveBeenCalled()
			expect(mockLogger.error).toHaveBeenCalledWith("Error from AudioWorklet:", "Test error")
		})

		it("should handle state messages", () => {
			manager.setupMessageHandler(node as any, onAudioData, onError)

			const message = {
				type: "state",
				state: "recording",
			}

			// Trigger message handler
			if (node.port.onmessage) {
				node.port.onmessage(new MessageEvent("message", { data: message }))
			}

			expect(mockLogger.log).toHaveBeenCalledWith("AudioWorklet state changed:", "recording")
		})
	})

	describe("setState", () => {
		let node: MockAudioWorkletNode

		beforeEach(async () => {
			await manager.loadWorklet(audioContext as any)
			node = manager.createWorkletNode(audioContext as any) as any
		})

		it("should send state to worklet", () => {
			manager.setState("recording")

			expect(node.port.postMessage).toHaveBeenCalledWith({
				type: "state",
				state: "recording",
			})
			expect(mockLogger.log).toHaveBeenCalledWith("State sent to worklet:", "recording")
		})

		it("should handle paused state", () => {
			manager.setState("paused")

			expect(node.port.postMessage).toHaveBeenCalledWith({
				type: "state",
				state: "paused",
			})
		})

		it("should warn if worklet node not created", () => {
			const freshManager = new AudioWorkletManager(mockLogger)
			freshManager.setState("recording")

			expect(mockLogger.warn).toHaveBeenCalledWith(
				"Cannot set state: worklet node not created",
			)
		})
	})

	describe("cleanup", () => {
		it("should cleanup worklet node", async () => {
			await manager.loadWorklet(audioContext as any)
			const node = manager.createWorkletNode(audioContext as any) as any

			await manager.cleanup()

			expect(node.disconnect).toHaveBeenCalled()
			expect(node.port.close).toHaveBeenCalled()
			expect(manager.getWorkletNode()).toBeNull()
			expect(mockLogger.log).toHaveBeenCalledWith("AudioWorkletNode disconnected")
		})

		it("should handle cleanup without worklet node", async () => {
			await manager.cleanup()

			// Should not throw
			expect(mockLogger.log).not.toHaveBeenCalledWith("AudioWorkletNode disconnected")
		})
	})

	describe("isLoaded", () => {
		it("should return false initially", () => {
			expect(manager.isLoaded()).toBe(false)
		})

		it("should return true after loading", async () => {
			await manager.loadWorklet(audioContext as any)

			expect(manager.isLoaded()).toBe(true)
		})
	})
})

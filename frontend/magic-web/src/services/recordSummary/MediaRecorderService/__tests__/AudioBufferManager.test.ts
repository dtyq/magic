/**
 * Unit tests for AudioBufferManager
 * AudioBufferManager 单元测试
 */

import { describe, it, expect, vi, beforeEach } from "vitest"
import { AudioBufferManager } from "../managers/AudioBufferManager"
import type { RecorderCoreConfig, AudioChunkData } from "../types/RecorderTypes"
import type { LoggerInterface } from "../types/RecorderDependencies"

describe("AudioBufferManager", () => {
	let mockLogger: LoggerInterface
	let mockConfig: RecorderCoreConfig
	let mockEvents: {
		onChunkReady?: (chunkData: AudioChunkData) => void
		onProgress?: (duration: number, totalSamples: number) => void
	}

	beforeEach(() => {
		mockLogger = {
			log: vi.fn(),
			warn: vi.fn(),
			error: vi.fn(),
		}

		mockConfig = {
			sampleRate: 16000,
			bitRate: 16,
			chunkDuration: 1, // 1 second for faster tests
			type: "wav",
			maxRetries: 5,
		}

		mockEvents = {
			onChunkReady: vi.fn(),
			onProgress: vi.fn(),
		}
	})

	it("should initialize with empty buffer", () => {
		const manager = new AudioBufferManager(mockConfig, mockEvents, mockLogger)

		expect(manager.getDuration()).toBe(0)
		expect(manager.hasData()).toBe(false)
	})

	it("should add data to buffer", () => {
		const manager = new AudioBufferManager(mockConfig, mockEvents, mockLogger)

		const testData = new Int16Array(8000) // 0.5 seconds at 16kHz
		manager.addData(testData, mockConfig.sampleRate)

		expect(manager.getDuration()).toBe(0.5)
		expect(manager.hasData()).toBe(true)
		expect(mockEvents.onProgress).toHaveBeenCalledWith(0.5, 8000)
	})

	it("should trigger chunk when duration exceeds threshold", () => {
		const manager = new AudioBufferManager(mockConfig, mockEvents, mockLogger)

		// Add 1.5 seconds of data (should trigger chunk at 1 second)
		const testData = new Int16Array(24000)
		manager.addData(testData, mockConfig.sampleRate)

		expect(mockEvents.onChunkReady).toHaveBeenCalledTimes(1)

		const chunkData = (mockEvents.onChunkReady as ReturnType<typeof vi.fn>).mock.calls[0][0]
		expect(chunkData.pcmData).toBeInstanceOf(Int16Array)
		expect(chunkData.sampleRate).toBe(mockConfig.sampleRate)
		expect(chunkData.bitRate).toBe(mockConfig.bitRate)
	})

	it("should clear buffer after flushing", () => {
		const manager = new AudioBufferManager(mockConfig, mockEvents, mockLogger)

		const testData = new Int16Array(24000)
		manager.addData(testData, mockConfig.sampleRate)

		// After flush, buffer should have remaining data
		expect(manager.getDuration()).toBeLessThan(1)
	})

	it("should force flush buffer", () => {
		const manager = new AudioBufferManager(mockConfig, mockEvents, mockLogger)

		const testData = new Int16Array(8000) // 0.5 seconds (less than threshold)
		manager.addData(testData, mockConfig.sampleRate)

		expect(mockEvents.onChunkReady).not.toHaveBeenCalled()

		manager.forceFlush(mockConfig.sampleRate)

		expect(mockEvents.onChunkReady).toHaveBeenCalledTimes(1)
	})

	it("should clear all data", () => {
		const manager = new AudioBufferManager(mockConfig, mockEvents, mockLogger)

		const testData = new Int16Array(8000)
		manager.addData(testData, mockConfig.sampleRate)

		manager.clear()

		expect(manager.getDuration()).toBe(0)
		expect(manager.hasData()).toBe(false)
	})

	it("should get buffer state", () => {
		const manager = new AudioBufferManager(mockConfig, mockEvents, mockLogger)

		const testData = new Int16Array(8000)
		manager.addData(testData, mockConfig.sampleRate)

		const state = manager.getBufferState()

		expect(state.duration).toBe(0.5)
		expect(state.totalSamples).toBe(8000)
		expect(state.buffers.length).toBe(1)
	})

	it("should handle multiple data additions", () => {
		const manager = new AudioBufferManager(mockConfig, mockEvents, mockLogger)

		// Add data in chunks
		for (let i = 0; i < 5; i++) {
			const testData = new Int16Array(4000)
			manager.addData(testData, mockConfig.sampleRate)
		}

		// Total is 20000 samples = 1.25 seconds, should trigger one chunk
		expect(mockEvents.onChunkReady).toHaveBeenCalledTimes(1)
		expect(manager.getDuration()).toBeLessThan(1)
	})
})

/**
 * Unit tests for WAVEncoder
 * WAVEncoder 单元测试
 */

import { describe, it, expect } from "vitest"
import { WAVEncoder } from "../encoders/WAVEncoder"
import type { AudioChunkData } from "../types/RecorderTypes"

describe("WAVEncoder", () => {
	it("should return correct MIME type", () => {
		const encoder = new WAVEncoder()
		expect(encoder.getMimeType()).toBe("audio/wav")
	})

	it("should encode PCM data to WAV format", () => {
		const encoder = new WAVEncoder()

		// Create test PCM data
		const pcmData = new Int16Array([0, 100, -100, 200, -200])
		const chunkData: AudioChunkData = {
			pcmData,
			sampleRate: 16000,
			bitRate: 16,
			duration: pcmData.length / 16000,
		}

		const result = encoder.encode(chunkData)

		// Verify result structure
		expect(result.data).toBeInstanceOf(ArrayBuffer)
		expect(result.mimeType).toBe("audio/wav")
		expect(result.size).toBeGreaterThan(44) // WAV header + data

		// Verify WAV header
		const view = new DataView(result.data)

		// Check RIFF header
		expect(String.fromCharCode(view.getUint8(0))).toBe("R")
		expect(String.fromCharCode(view.getUint8(1))).toBe("I")
		expect(String.fromCharCode(view.getUint8(2))).toBe("F")
		expect(String.fromCharCode(view.getUint8(3))).toBe("F")

		// Check WAVE format
		expect(String.fromCharCode(view.getUint8(8))).toBe("W")
		expect(String.fromCharCode(view.getUint8(9))).toBe("A")
		expect(String.fromCharCode(view.getUint8(10))).toBe("V")
		expect(String.fromCharCode(view.getUint8(11))).toBe("E")

		// Check sample rate
		expect(view.getUint32(24, true)).toBe(16000)

		// Check bit depth
		expect(view.getUint16(34, true)).toBe(16)
	})

	it("should calculate correct buffer size", () => {
		const encoder = new WAVEncoder()

		const pcmData = new Int16Array(100)
		const chunkData: AudioChunkData = {
			pcmData,
			sampleRate: 16000,
			bitRate: 16,
			duration: pcmData.length / 16000,
		}

		const result = encoder.encode(chunkData)

		// 44 bytes header + 200 bytes data (100 samples * 2 bytes per sample)
		expect(result.size).toBe(244)
	})

	it("should handle empty PCM data", () => {
		const encoder = new WAVEncoder()

		const pcmData = new Int16Array(0)
		const chunkData: AudioChunkData = {
			pcmData,
			sampleRate: 16000,
			bitRate: 16,
			duration: 0,
		}

		const result = encoder.encode(chunkData)

		// Should still have WAV header
		expect(result.size).toBe(44)
	})
})

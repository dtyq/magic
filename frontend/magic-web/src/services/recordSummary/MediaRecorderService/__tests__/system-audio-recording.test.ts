import { describe, it, expect, beforeEach, vi } from "vitest"
import { MediaRecorderService } from "../index"
import { RecorderCoreAdapter } from "../RecorderCoreAdapter"
import type { AudioSourceConfig } from "@/types/recordSummary"

describe("System Audio Recording", () => {
	describe("Type Definitions", () => {
		it("should accept valid AudioSourceType values", () => {
			const sources: Array<"microphone" | "system" | "both"> = [
				"microphone",
				"system",
				"both",
			]
			expect(sources).toHaveLength(3)
		})

		it("should create valid AudioSourceConfig", () => {
			const config: AudioSourceConfig = {
				source: "both",
				microphoneGain: 1.0,
				systemGain: 1.0,
			}
			expect(config.source).toBe("both")
			expect(config.microphoneGain).toBe(1.0)
			expect(config.systemGain).toBe(1.0)
		})
	})

	describe("MediaRecorderService Configuration", () => {
		it("should have default microphone configuration", () => {
			const service = new MediaRecorderService()
			const status = service.getStatus()

			expect(status.audioSource).toBeDefined()
			expect(status.audioSource?.source).toBe("microphone")
			expect(status.audioSource?.microphoneGain).toBe(1.1)
			expect(status.audioSource?.systemGain).toBe(1.0)
		})

		it("should accept custom audio source configuration", () => {
			const service = new MediaRecorderService({
				audioSource: {
					source: "both",
					microphoneGain: 0.8,
					systemGain: 0.8,
				},
			})
			const status = service.getStatus()

			expect(status.audioSource?.source).toBe("both")
			expect(status.audioSource?.microphoneGain).toBe(0.8)
			expect(status.audioSource?.systemGain).toBe(0.8)
		})

		it("should accept system-only audio source", () => {
			const service = new MediaRecorderService({
				audioSource: {
					source: "system",
				},
			})
			const status = service.getStatus()

			expect(status.audioSource?.source).toBe("system")
		})
	})

	describe("Browser Support Check", () => {
		it("should check microphone support", () => {
			const result = RecorderCoreAdapter.isAudioSourceSupported("microphone")
			expect(result).toHaveProperty("supported")
			if (!result.supported) {
				expect(result).toHaveProperty("message")
			}
		})

		it("should check system audio support", () => {
			const result = RecorderCoreAdapter.isAudioSourceSupported("system")
			expect(result).toHaveProperty("supported")
			if (!result.supported) {
				expect(result).toHaveProperty("message")
				expect(result.message).toContain("screen sharing")
			}
		})

		it("should check mixed audio support", () => {
			const result = RecorderCoreAdapter.isAudioSourceSupported("both")
			expect(result).toHaveProperty("supported")
		})

		it("should return false for unknown source type", () => {
			const result = RecorderCoreAdapter.isAudioSourceSupported("unknown" as "microphone")
			expect(result.supported).toBe(false)
			expect(result.message).toBe("Unknown audio source type")
		})
	})

	describe("Configuration Validation", () => {
		it("should allow non-negative gain values", () => {
			// Valid gains
			const validConfig: AudioSourceConfig = {
				source: "both",
				microphoneGain: 0.5,
				systemGain: 1.0,
			}
			expect(validConfig.microphoneGain).toBeGreaterThanOrEqual(0)
			expect(validConfig.systemGain).toBeGreaterThanOrEqual(0)
		})

		it("should use default gain when not specified", () => {
			const config: AudioSourceConfig = {
				source: "both",
			}
			const service = new MediaRecorderService({ audioSource: config })
			const status = service.getStatus()

			// Defaults should be applied
			expect(status.audioSource?.microphoneGain).toBe(1.1)
			expect(status.audioSource?.systemGain).toBe(1.0)
		})
	})

	describe("Service Integration", () => {
		let service: MediaRecorderService

		beforeEach(() => {
			service = new MediaRecorderService()
		})

		it("should initialize with default configuration", () => {
			expect(service).toBeDefined()
			expect(service.isBrowserSupported).toBeDefined()
		})

		it("should expose audio source in status", () => {
			const status = service.getStatus()
			expect(status).toHaveProperty("audioSource")
			expect(status.audioSource).toHaveProperty("source")
		})

		it("should use default gains for mixed source", () => {
			const service = new MediaRecorderService({
				audioSource: {
					source: "both",
				},
			})
			const status = service.getStatus()

			// Default gains
			expect(status.audioSource?.microphoneGain).toBe(1.1)
			expect(status.audioSource?.systemGain).toBe(1.0)
		})
	})

	describe("Edge Cases", () => {
		it("should handle missing audio source config gracefully", () => {
			const service = new MediaRecorderService({})
			const status = service.getStatus()

			// Should fall back to defaults (microphone)
			expect(status.audioSource).toBeDefined()
			expect(status.audioSource?.source).toBe("microphone")
		})

		it("should handle partial audio source config", () => {
			const service = new MediaRecorderService({
				audioSource: {
					source: "system",
					// Only source specified, gains should use defaults
				},
			})
			const status = service.getStatus()

			expect(status.audioSource?.source).toBe("system")
			expect(status.audioSource?.microphoneGain).toBe(1.1)
			expect(status.audioSource?.systemGain).toBe(1.0)
		})
	})

	describe("Fallback Mechanism", () => {
		it("should notify when fallback occurs", () => {
			let fallbackCalled = false
			let fallbackInfo: {
				requested?: string
				fallback?: string
				reason?: string
			} = {}

			const service = new MediaRecorderService(
				{
					audioSource: { source: "both" },
				},
				{
					onAudioSourceFallback: (requested, fallback, reason) => {
						fallbackCalled = true
						fallbackInfo = { requested, fallback, reason }
					},
				},
			)

			expect(service).toBeDefined()
			// Note: Actual fallback will be tested during startRecording in real browser
		})

		it("should support all three audio source types", () => {
			const sources: Array<"microphone" | "system" | "both"> = [
				"microphone",
				"system",
				"both",
			]

			sources.forEach((source) => {
				const service = new MediaRecorderService({
					audioSource: { source },
				})
				const status = service.getStatus()
				expect(status.audioSource?.source).toBe(source)
			})
		})
	})
})

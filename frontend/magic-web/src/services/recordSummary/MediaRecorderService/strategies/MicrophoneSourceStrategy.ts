/**
 * Microphone audio source strategy
 * 麦克风音频源策略
 */

import type { AudioSourceStrategy, AudioSourceInitResult } from "./AudioSourceStrategy"
import type { RecorderCoreConfig, AudioRecorder } from "../types/RecorderTypes"
import type { RecorderDependencies } from "../types/RecorderDependencies"
import { AudioStreamCaptureError, PermissionDeniedError } from "../types/RecorderErrors"
import { ResourceManager } from "../managers/ResourceManager"
import { RetryManager } from "../managers/RetryManager"
import { getMicrophoneConstraints } from "../config/AudioConstraintsConfig"

/**
 * MicrophoneSourceStrategy captures audio from microphone only
 * MicrophoneSourceStrategy 仅从麦克风捕获音频
 */
export class MicrophoneSourceStrategy implements AudioSourceStrategy {
	private mediaStream: MediaStream | null = null
	private audioRecorder: AudioRecorder | null = null
	private resourceManager: ResourceManager
	private retryManager: RetryManager

	constructor(
		private readonly config: RecorderCoreConfig,
		private readonly dependencies: RecorderDependencies,
	) {
		this.resourceManager = new ResourceManager(dependencies.logger)
		this.retryManager = new RetryManager(
			{
				maxAttempts: config.maxRetries,
			},
			dependencies.logger,
		)
	}

	getName(): string {
		return "MicrophoneSourceStrategy"
	}

	async initialize(): Promise<AudioSourceInitResult> {
		try {
			this.dependencies.logger.log("Initializing microphone audio source")

			// Get microphone stream with retry
			const retryResult = await this.retryManager.execute(async () => {
				// Get audio constraints from config or use defaults
				const audioConstraints = getMicrophoneConstraints(
					"default",
					this.config.audioSource?.microphoneConstraints,
				)

				return await this.dependencies.mediaDevices.getUserMedia({
					audio: audioConstraints,
				})
			}, "Get microphone stream")

			if (!retryResult.success || !retryResult.result) {
				const error = retryResult.error || new Error("Failed to get microphone stream")
				// Check if it's a permission error
				if (this.isPermissionError(error)) {
					throw new PermissionDeniedError("Microphone permission denied by user")
				}
				throw error
			}

			this.mediaStream = retryResult.result

			// Monitor audio track state
			const audioTracks = this.mediaStream.getAudioTracks()
			audioTracks.forEach((track) => {
				track.onended = () => {
					this.dependencies.logger.error("Microphone audio track ended unexpectedly", {
						trackId: track.id,
						trackLabel: track.label,
						trackState: track.readyState,
					})

					// 上报监控：麦克风音频轨道意外结束（可能原因：用户撤销权限、设备断开）
					// Report: Microphone track ended unexpectedly (permission revoked or device disconnected)
					this.dependencies.logger.report({
						namespace: "recordingStreamInterrupted",
						data: {
							description: "麦克风音频轨道意外结束",
							reason: "track_ended",
							trackId: track.id,
							trackLabel: track.label,
							audioSource: "microphone",
							possibleCauses: "用户撤销权限、设备断开",
							timestamp: Date.now(),
						},
					})
				}

				// Monitor muted state changes
				track.onmute = () => {
					this.dependencies.logger.warn("Microphone audio track muted", {
						trackId: track.id,
						trackLabel: track.label,
					})
				}

				track.onunmute = () => {
					this.dependencies.logger.log("Microphone audio track unmuted", {
						trackId: track.id,
					})
				}
			})

			// Register stream for cleanup
			this.resourceManager.register(
				"mediaStream",
				"MediaStream",
				() => {
					if (this.mediaStream) {
						this.mediaStream.getTracks().forEach((track) => {
							// Clean up track event listeners
							track.onended = null
							track.onmute = null
							track.onunmute = null
							track.stop()
						})
					}
				},
				this.mediaStream,
			)

			// Create audio recorder
			this.audioRecorder = {
				isRecording: false,
				isPaused: false,
			}

			this.dependencies.logger.log("Microphone audio source initialized successfully")

			return {
				mediaStream: this.mediaStream,
				audioRecorder: this.audioRecorder,
			}
		} catch (error) {
			this.dependencies.logger.error("Failed to initialize microphone audio source:", error)
			await this.cleanup()
			throw new AudioStreamCaptureError(
				"Failed to initialize microphone audio source",
				error as Error,
			)
		}
	}

	/**
	 * Check if error is permission-related
	 * 检查错误是否与权限相关
	 */
	private isPermissionError(error: Error): boolean {
		const errorName = error.name
		const errorMessage = error.message.toLowerCase()
		return (
			errorName === "NotAllowedError" ||
			errorName === "PermissionDeniedError" ||
			errorMessage.includes("permission denied") ||
			errorMessage.includes("user denied")
		)
	}

	async cleanup(): Promise<void> {
		this.dependencies.logger.log("Cleaning up microphone audio source")

		// Disconnect audio nodes if they exist
		if (this.audioRecorder) {
			if (this.audioRecorder.scriptProcessor) {
				this.audioRecorder.scriptProcessor.disconnect()
				this.audioRecorder.scriptProcessor = undefined
			}
			if (this.audioRecorder.audioSource) {
				this.audioRecorder.audioSource.disconnect()
				this.audioRecorder.audioSource = undefined
			}
		}

		await this.resourceManager.cleanupAll()
		this.mediaStream = null
		this.audioRecorder = null
		this.dependencies.logger.log("Microphone audio source cleaned up")
	}

	getMediaStream(): MediaStream | null {
		return this.mediaStream
	}
}

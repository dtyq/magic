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
				return await this.requestMicrophoneStream()
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
					this.dependencies.logger.error({
						eventKey: "microphone_track_ended_unexpectedly",
						errorKind: "unknown",
						message: "Microphone audio track ended unexpectedly",
						context: {
							trackState: track.readyState,
							trackMuted: track.muted,
							trackEnabled: track.enabled,
						},
					})

					// 上报监控：麦克风音频轨道意外结束（可能原因：用户撤销权限、设备断开）
					// Report: Microphone track ended unexpectedly (permission revoked or device disconnected)
					this.dependencies.logger.report({
						namespace: "recordingStreamInterrupted",
						data: {
							description: "麦克风音频轨道意外结束",
							reason: "track_ended",
							audioSource: "microphone",
							possibleCauses: "用户撤销权限、设备断开",
							timestamp: Date.now(),
						},
					})
				}

				// Monitor muted state changes
				track.onmute = () => {
					this.dependencies.logger.warn("Microphone audio track muted", {
						trackState: track.readyState,
						trackMuted: track.muted,
						trackEnabled: track.enabled,
					})
				}

				track.onunmute = () => {
					this.dependencies.logger.log("Microphone audio track unmuted", {
						trackState: track.readyState,
						trackMuted: track.muted,
						trackEnabled: track.enabled,
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
			this.dependencies.logger.error({
				eventKey: "initialize_microphone_audio_source_failed",
				errorKind: "unknown",
				error: error,
				message: "Failed to initialize microphone audio source:",
			})
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

	/**
	 * Requests microphone input using the preferred constraints first, then falls
	 * back to `audio: true` for browsers/webviews that reject advanced constraints.
	 */
	private async requestMicrophoneStream(): Promise<MediaStream> {
		const explicitDeviceId = this.config.audioSource?.microphoneConstraints?.deviceId
		const deviceIdConstraint =
			explicitDeviceId && typeof explicitDeviceId === "string"
				? { exact: explicitDeviceId }
				: { ideal: "default" }

		const audioConstraints = getMicrophoneConstraints("default", {
			...this.config.audioSource?.microphoneConstraints,
			deviceId: deviceIdConstraint,
		})

		try {
			this.dependencies.logger.log("Requesting microphone stream", {
				deviceId: deviceIdConstraint,
				constraints: audioConstraints,
			})

			return await this.dependencies.mediaDevices.getUserMedia({
				audio: audioConstraints,
			})
		} catch (error) {
			if (!(error instanceof Error) || this.isPermissionError(error)) {
				throw error
			}

			// Some embedded browsers reject advanced track constraints such as
			// `deviceId`, `noiseSuppression`, or `autoGainControl`; retrying with
			// the minimal `audio: true` shape preserves recording capability.
			this.dependencies.logger.warn(
				"Preferred microphone constraints failed, retrying with minimal audio constraints",
				error,
			)

			return await this.dependencies.mediaDevices.getUserMedia({
				audio: true,
			})
		}
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

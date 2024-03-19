/**
 * System audio source strategy
 * 系统音频源策略
 */

import type { AudioSourceStrategy, AudioSourceInitResult } from "./AudioSourceStrategy"
import type {
	RecorderCoreConfig,
	AudioRecorder,
	DisplayMediaStreamOptions,
} from "../types/RecorderTypes"
import type { RecorderDependencies } from "../types/RecorderDependencies"
import { AudioStreamCaptureError } from "../types/RecorderErrors"
import { ResourceManager } from "../managers/ResourceManager"
import { getSystemAudioConstraints } from "../config/AudioConstraintsConfig"

/**
 * SystemAudioSourceStrategy captures system audio via screen sharing
 * SystemAudioSourceStrategy 通过屏幕共享捕获系统音频
 */
export class SystemAudioSourceStrategy implements AudioSourceStrategy {
	private mediaStream: MediaStream | null = null
	private systemMediaStream: MediaStream | null = null
	private audioContext: AudioContext | null = null
	private audioRecorder: AudioRecorder | null = null
	private resourceManager: ResourceManager

	constructor(
		private readonly config: RecorderCoreConfig,
		private readonly dependencies: RecorderDependencies,
	) {
		this.resourceManager = new ResourceManager(dependencies.logger)
	}

	getName(): string {
		return "SystemAudioSourceStrategy"
	}

	async initialize(): Promise<AudioSourceInitResult> {
		try {
			this.dependencies.logger.log("Initializing system audio source")

			// Capture system audio
			this.systemMediaStream = await this.captureSystemAudio()

			this.resourceManager.register(
				"systemMediaStream",
				"MediaStream",
				() => {
					if (this.systemMediaStream) {
						this.systemMediaStream.getTracks().forEach((track) => track.stop())
					}
				},
				this.systemMediaStream,
			)

			// Create audio recorder
			this.audioRecorder = {
				isRecording: false,
				isPaused: false,
			}

			// Set up manual audio processing from system stream
			await this.setupManualAudioProcessing(this.systemMediaStream, this.audioRecorder)

			// Set media stream for silence detection
			this.mediaStream = this.systemMediaStream.clone()

			this.dependencies.logger.log("System audio source initialized successfully")

			return {
				mediaStream: this.mediaStream,
				audioRecorder: this.audioRecorder,
			}
		} catch (error) {
			this.dependencies.logger.error("Failed to initialize system audio source:", error)
			await this.cleanup()
			throw new AudioStreamCaptureError(
				"Failed to initialize system audio source",
				error as Error,
			)
		}
	}

	/**
	 * Capture system audio via screen sharing
	 * 通过屏幕共享捕获系统音频
	 */
	private async captureSystemAudio(): Promise<MediaStream> {
		try {
			// Use pre-authorized display media if available (from user gesture context)
			// 如果有预授权的显示媒体，优先使用（来自用户手势上下文）
			let displayMedia: MediaStream
			if (this.dependencies.preauthorizedDisplayMedia) {
				this.dependencies.logger.log("Using pre-authorized display media for system audio")
				displayMedia = this.dependencies.preauthorizedDisplayMedia
				// Don't clear it here, let the caller manage the lifecycle
			} else {
				this.dependencies.logger.log("Requesting new display media for system audio")

				const systemAudioConstraints = getSystemAudioConstraints(
					this.config.audioSource?.systemAudioConstraints,
				)

				displayMedia = await this.dependencies.mediaDevices.getDisplayMedia({
					video: {
						displaySurface: "monitor",
					},
					audio: systemAudioConstraints,
					preferCurrentTab: false,
					selfBrowserSurface: "exclude",
					systemAudio: "include",
					surfaceSwitching: "include",
					monitorTypeSurfaces: "include",
				} as DisplayMediaStreamOptions)
			}

			// Check if audio track is available
			const audioTracks = displayMedia.getAudioTracks()
			if (audioTracks.length === 0) {
				displayMedia.getVideoTracks().forEach((track) => track.stop())
				throw new Error("No audio track available in selected screen/window")
			}

			// Add track monitoring
			audioTracks.forEach((track) => {
				track.onended = () => {
					this.dependencies.logger.error("System audio track ended unexpectedly", {
						trackId: track.id,
						trackLabel: track.label,
						trackState: track.readyState,
					})

					// 上报监控：系统音频轨道意外结束（可能原因：用户停止共享、关闭窗口）
					// Report: System audio track ended unexpectedly (user stopped sharing or closed window)
					this.dependencies.logger.report({
						namespace: "recordingStreamInterrupted",
						data: {
							description: "系统音频轨道意外结束",
							reason: "track_ended",
							trackId: track.id,
							trackLabel: track.label,
							audioSource: "system",
							possibleCauses: "用户停止共享、关闭窗口",
							timestamp: Date.now(),
						},
					})
				}
			})

			// Stop video track immediately as we only need audio
			const videoTracks = displayMedia.getVideoTracks()
			videoTracks.forEach((track) => {
				track.stop()
				displayMedia.removeTrack(track)
			})

			this.dependencies.logger.log("System audio captured successfully", {
				audioTracks: audioTracks.length,
				videoTracksStopped: videoTracks.length,
			})

			return displayMedia
		} catch (error) {
			this.dependencies.logger.error("Failed to capture system audio:", error)

			// 上报监控：系统音频捕获失败（可能原因：用户拒绝、浏览器不支持、选择无音频窗口）
			// Report: System audio capture failed (permission denied, browser not supported, or no audio window selected)
			this.dependencies.logger.report({
				namespace: "systemAudioCaptureFailed",
				data: {
					description: "系统音频捕获失败",
					errorName: (error as Error).name,
					errorMessage: (error as Error).message,
					audioSource: "system",
					possibleCauses: "用户拒绝权限、浏览器不支持、选择了无音频的窗口",
					timestamp: Date.now(),
				},
			})

			throw new AudioStreamCaptureError("Failed to capture system audio", error as Error)
		}
	}

	/**
	 * Set up manual audio processing for system stream
	 * 为系统流设置手动音频处理
	 */
	private async setupManualAudioProcessing(
		stream: MediaStream,
		audioRecorder: AudioRecorder,
	): Promise<void> {
		return new Promise((resolve, reject) => {
			try {
				// Create AudioContext
				// Use native sample rate to avoid resampling artifacts and main thread overhead
				// 使用原生采样率以避免重采样伪影和主线程开销
				this.audioContext = this.dependencies.audioContextFactory.create()

				// Store actual sample rate (browser may not support requested rate)
				const actualSampleRate = this.audioContext.sampleRate
				audioRecorder.actualSampleRate = actualSampleRate

				this.dependencies.logger.log("AudioContext created for system audio", {
					requestedSampleRate: this.config.sampleRate,
					actualSampleRate,
				})

				this.resourceManager.register(
					"audioContext",
					"AudioContext",
					async () => {
						if (this.audioContext) {
							await this.audioContext.close()
						}
					},
					this.audioContext,
				)

				// Create media stream source
				const source = this.audioContext.createMediaStreamSource(stream)

				// Create script processor to capture audio data
				const bufferSize = 4096
				const scriptProcessor = this.audioContext.createScriptProcessor(
					bufferSize,
					1, // mono
					1,
				)

				// Store references in audio recorder for cleanup
				audioRecorder.scriptProcessor = scriptProcessor
				audioRecorder.audioSource = source

				// Connect nodes
				source.connect(scriptProcessor)
				scriptProcessor.connect(this.audioContext.destination)

				this.dependencies.logger.log("Manual audio processing set up successfully")
				resolve()
			} catch (error) {
				this.dependencies.logger.error("Failed to set up manual audio processing:", error)
				reject(error)
			}
		})
	}

	async cleanup(): Promise<void> {
		this.dependencies.logger.log("Cleaning up system audio source")

		// Disconnect audio nodes
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
		this.systemMediaStream = null
		this.audioContext = null
		this.audioRecorder = null

		this.dependencies.logger.log("System audio source cleaned up")
	}

	getMediaStream(): MediaStream | null {
		return this.mediaStream
	}

	/**
	 * Get script processor for audio data processing
	 * 获取用于音频数据处理的脚本处理器
	 */
	getScriptProcessor(): ScriptProcessorNode | null {
		return this.audioRecorder?.scriptProcessor || null
	}
}

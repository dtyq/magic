/**
 * Mixed audio source strategy (microphone + system audio)
 * 混合音频源策略（麦克风 + 系统音频）
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
import {
	getMicrophoneConstraints,
	getSystemAudioConstraints,
} from "../config/AudioConstraintsConfig"

/**
 * MixedAudioSourceStrategy captures both microphone and system audio
 * MixedAudioSourceStrategy 同时捕获麦克风和系统音频
 */
export class MixedAudioSourceStrategy implements AudioSourceStrategy {
	private mediaStream: MediaStream | null = null
	private systemMediaStream: MediaStream | null = null
	private micMediaStream: MediaStream | null = null
	private mixedStream: MediaStream | null = null
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
		return "MixedAudioSourceStrategy"
	}

	async initialize(): Promise<AudioSourceInitResult> {
		try {
			this.dependencies.logger.log("Initializing mixed audio source")

			const micAudioConstraints = getMicrophoneConstraints(
				"default",
				this.config.audioSource?.microphoneConstraints,
			)

			// Get microphone stream
			this.micMediaStream = await this.dependencies.mediaDevices.getUserMedia({
				audio: micAudioConstraints,
			})

			// Monitor microphone audio track state
			const micAudioTracks = this.micMediaStream.getAudioTracks()
			micAudioTracks.forEach((track) => {
				track.onended = () => {
					this.dependencies.logger.error(
						"Microphone audio track ended unexpectedly in mixed mode",
						{
							trackId: track.id,
							trackLabel: track.label,
							trackState: track.readyState,
						},
					)

					// 上报监控：混合模式下麦克风音频轨道意外结束
					// Report: Microphone track ended unexpectedly in mixed mode
					this.dependencies.logger.report({
						namespace: "recordingStreamInterrupted",
						data: {
							description: "混合模式下麦克风音频轨道意外结束",
							reason: "track_ended",
							trackId: track.id,
							trackLabel: track.label,
							audioSource: "microphone",
							mixedMode: true,
							possibleCauses: "用户撤销麦克风权限、麦克风设备断开",
							timestamp: Date.now(),
						},
					})
				}

				track.onmute = () => {
					this.dependencies.logger.warn("Microphone audio track muted in mixed mode", {
						trackId: track.id,
						trackLabel: track.label,
					})
				}

				track.onunmute = () => {
					this.dependencies.logger.log("Microphone audio track unmuted in mixed mode", {
						trackId: track.id,
					})
				}
			})

			this.resourceManager.register(
				"micMediaStream",
				"MediaStream",
				() => {
					if (this.micMediaStream) {
						this.micMediaStream.getTracks().forEach((track) => {
							// Clean up track event listeners
							track.onended = null
							track.onmute = null
							track.onunmute = null
							track.stop()
						})
					}
				},
				this.micMediaStream,
			)

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

			// Mix the two streams
			this.mixedStream = this.mixAudioStreams(this.micMediaStream, this.systemMediaStream)

			this.resourceManager.register(
				"mixedStream",
				"MediaStream",
				() => {
					if (this.mixedStream) {
						this.mixedStream.getTracks().forEach((track) => track.stop())
					}
				},
				this.mixedStream,
			)

			// Create audio recorder
			this.audioRecorder = {
				isRecording: false,
				isPaused: false,
			}

			// Set up manual audio processing from mixed stream
			await this.setupManualAudioProcessing(this.mixedStream, this.audioRecorder)

			// Set media stream for silence detection
			this.mediaStream = this.mixedStream.clone()

			this.dependencies.logger.log("Mixed audio source initialized successfully")

			return {
				mediaStream: this.mediaStream,
				audioRecorder: this.audioRecorder,
			}
		} catch (error) {
			this.dependencies.logger.error("Failed to initialize mixed audio source:", error)
			await this.cleanup()
			throw new AudioStreamCaptureError(
				"Failed to initialize mixed audio source",
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
				this.dependencies.logger.log("Using pre-authorized display media for mixed audio")
				displayMedia = this.dependencies.preauthorizedDisplayMedia
				// Don't clear it here, let the caller manage the lifecycle
			} else {
				const systemAudioConstraints = getSystemAudioConstraints(
					this.config.audioSource?.systemAudioConstraints,
				)

				this.dependencies.logger.log("Requesting new display media for mixed audio")
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

			// Monitor system audio track state
			audioTracks.forEach((track) => {
				track.onended = () => {
					this.dependencies.logger.error(
						"System audio track ended unexpectedly in mixed mode",
						{
							trackId: track.id,
							trackLabel: track.label,
							trackState: track.readyState,
						},
					)

					// 上报监控：混合模式下系统音频轨道意外结束（用户停止共享、关闭窗口）
					// Report: System audio track ended unexpectedly in mixed mode (user stopped sharing or closed window)
					this.dependencies.logger.report({
						namespace: "recordingStreamInterrupted",
						data: {
							description: "混合模式下系统音频轨道意外结束",
							reason: "track_ended",
							trackId: track.id,
							trackLabel: track.label,
							audioSource: "system",
							mixedMode: true,
							possibleCauses: "用户停止屏幕共享、关闭了被共享的窗口",
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

			// 上报监控：混合模式下系统音频捕获失败（用户拒绝、浏览器不支持、选择无音频窗口）
			// Report: System audio capture failed in mixed mode (permission denied, browser not supported, or no audio window selected)
			this.dependencies.logger.report({
				namespace: "systemAudioCaptureFailed",
				data: {
					description: "混合模式下系统音频捕获失败",
					errorName: (error as Error).name,
					errorMessage: (error as Error).message,
					audioSource: "system",
					mixedMode: true,
					possibleCauses: "用户拒绝权限、浏览器不支持系统音频捕获、选择了无音频的窗口",
					timestamp: Date.now(),
				},
			})

			throw new AudioStreamCaptureError("Failed to capture system audio", error as Error)
		}
	}

	/**
	 * Mix microphone and system audio streams
	 * 混合麦克风和系统音频流
	 */
	private mixAudioStreams(micStream: MediaStream, systemStream: MediaStream): MediaStream {
		try {
			// Create audio context with configured sample rate
			// Use native sample rate to avoid resampling artifacts
			// 使用原生采样率以避免重采样伪影
			this.audioContext = this.dependencies.audioContextFactory.create()

			// Log actual sample rate (browser may not support requested rate)
			this.dependencies.logger.log("AudioContext created for mixing", {
				requestedSampleRate: this.config.sampleRate,
				actualSampleRate: this.audioContext.sampleRate,
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

			// Create source nodes from streams
			const micSource = this.audioContext.createMediaStreamSource(micStream)
			const systemSource = this.audioContext.createMediaStreamSource(systemStream)

			// Create gain nodes for volume control
			const micGain = this.audioContext.createGain()
			const systemGain = this.audioContext.createGain()

			// Get configured gain values or use defaults (1.0 for 1:1 ratio)
			const audioSource = this.config.audioSource
			micGain.gain.value = audioSource?.microphoneGain ?? 1.0
			systemGain.gain.value = audioSource?.systemGain ?? 1.0

			// Create destination for mixed stream
			const destination = this.audioContext.createMediaStreamDestination()

			// Connect nodes: source -> gain -> destination
			micSource.connect(micGain)
			systemSource.connect(systemGain)
			micGain.connect(destination)
			systemGain.connect(destination)

			this.dependencies.logger.log("Audio streams mixed successfully", {
				micGain: micGain.gain.value,
				systemGain: systemGain.gain.value,
				sampleRate: this.audioContext.sampleRate,
			})

			return destination.stream
		} catch (error) {
			this.dependencies.logger.error("Failed to mix audio streams:", error)
			throw new AudioStreamCaptureError("Failed to mix audio streams", error as Error)
		}
	}

	/**
	 * Set up manual audio processing for mixed stream
	 * 为混合流设置手动音频处理
	 */
	private async setupManualAudioProcessing(
		stream: MediaStream,
		audioRecorder: AudioRecorder,
	): Promise<void> {
		return new Promise((resolve, reject) => {
			try {
				if (!this.audioContext) {
					throw new Error("AudioContext not initialized")
				}

				// Store actual sample rate (already created in mixAudioStreams)
				audioRecorder.actualSampleRate = this.audioContext.sampleRate

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
				audioRecorder.mixedSource = source

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
		this.dependencies.logger.log("Cleaning up mixed audio source")

		// Disconnect audio nodes
		if (this.audioRecorder) {
			if (this.audioRecorder.scriptProcessor) {
				this.audioRecorder.scriptProcessor.disconnect()
				this.audioRecorder.scriptProcessor = undefined
			}
			if (this.audioRecorder.mixedSource) {
				this.audioRecorder.mixedSource.disconnect()
				this.audioRecorder.mixedSource = undefined
			}
		}

		await this.resourceManager.cleanupAll()

		this.mediaStream = null
		this.systemMediaStream = null
		this.micMediaStream = null
		this.mixedStream = null
		this.audioContext = null
		this.audioRecorder = null

		this.dependencies.logger.log("Mixed audio source cleaned up")
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

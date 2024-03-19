import type { MediaRecorderEvents, MediaRecorderConfig } from "@/opensource/types/recordSummary"
import { AudioChunkDB, type StoredAudioChunk } from "./AudioChunkDB"
import {
	RecorderCoreAdapter,
	type RecorderCoreConfig,
	type RecorderCoreEvents,
} from "./RecorderCoreAdapter"
import type { AudioSourceConfig, AudioSourceType } from "./types/RecorderTypes"
import { RecorderInitializationError, InvalidStateError } from "./types/RecorderErrors"
import { logger as Logger } from "@/opensource/utils/log"

/**
 * Media recorder service dependencies
 * 媒体录制服务依赖项
 */
interface MediaRecorderServiceDependencies {
	audioChunkDB?: AudioChunkDB
}

const logger = Logger.createLogger("MediaRecorderService")

/**
 * Media recorder service for recording and storing audio chunks
 * Based on Web Audio API for real-time PCM recording with fixed frame size
 * 媒体录制服务，用于录制和存储音频分片
 * 基于 Web Audio API 实现实时 PCM 录制，支持固定帧大小
 */
export class MediaRecorderService {
	private recorderAdapter: RecorderCoreAdapter | null = null
	private sessionId = ""
	private chunkIndex = 0
	private isRecording = false
	private config: MediaRecorderConfig
	private events: Partial<MediaRecorderEvents>
	private audioChunkDB: AudioChunkDB
	private preauthorizedDisplayMedia: MediaStream | null = null

	public isBrowserSupported = true

	// Default configuration
	private readonly DEFAULT_CONFIG: MediaRecorderConfig = {
		mimeType: "audio/wav", // Default WAV format
		audioBitsPerSecond: 256000, // 16kHz * 16bit = 256 kbps
		timeslice: 10000, // 10 seconds per chunk
		enableEchoCancellation: false,
		enableNoiseSuppression: false,
		autoGainControl: false,
		audioSource: {
			source: "microphone", // Default: microphone only
			microphoneGain: 1.1,
			systemGain: 1.0,
		},
	}

	constructor(
		config: Partial<MediaRecorderConfig> = {},
		events: Partial<MediaRecorderEvents> = {},
		dependencies: MediaRecorderServiceDependencies = {},
	) {
		// Deep merge audio source config to ensure all defaults are applied
		const audioSourceConfig = config.audioSource
			? {
					...this.DEFAULT_CONFIG.audioSource,
					...config.audioSource,
				}
			: this.DEFAULT_CONFIG.audioSource

		this.config = {
			...this.DEFAULT_CONFIG,
			...config,
			audioSource: audioSourceConfig,
		}
		this.events = events
		this.audioChunkDB = dependencies.audioChunkDB ?? new AudioChunkDB()

		// Check browser support
		if (!RecorderCoreAdapter.isBrowserSupported()) {
			this.isBrowserSupported = false
			this.events.onMediaRecorderNotSupported?.()
			logger.warn("浏览器不支持音频录制")
			return
		}

		logger.log("MediaRecorderService初始化完成", {
			mimeType: this.config.mimeType,
			audioSource: this.config.audioSource?.source,
		})
	}

	/**
	 * Update configuration (useful for updating audio source before starting)
	 * 更新配置（用于在开始录制前更新音频源）
	 */
	updateConfig(config: Partial<MediaRecorderConfig>): void {
		const audioSourceConfig = config.audioSource
			? {
					...this.config.audioSource,
					...config.audioSource,
				}
			: this.config.audioSource

		this.config = {
			...this.config,
			...config,
			audioSource: audioSourceConfig,
		}
		console.log("MediaRecorderService config updated", {
			config: this.config,
		})
	}

	/**
	 * Get current recorder configuration
	 * 获取当前录制配置
	 */
	getConfig(): MediaRecorderConfig {
		return {
			...this.config,
			audioSource: {
				...this.config.audioSource,
			},
		}
	}

	/**
	 * Start recording with session ID
	 * 使用会话ID开始录制
	 */
	async startRecording(sessionId: string, startChunkIndex: number = 0): Promise<void> {
		if (this.isRecording) {
			logger.warn("录音已在进行中")
			return
		}

		if (!sessionId) {
			throw new Error("Session ID is required to start recording")
		}

		// 清理现有的录音适配器
		if (this.recorderAdapter) {
			logger.log("清理现有录音适配器")
			await this.recorderAdapter.cleanup()
			this.recorderAdapter = null
		}

		try {
			// 设置会话参数
			this.sessionId = sessionId
			this.chunkIndex = startChunkIndex

			// 检查音频源支持并应用回退策略
			let audioSourceConfig = this.config.audioSource
			const requestedSource = audioSourceConfig?.source || "microphone"
			const supportCheck = RecorderCoreAdapter.isAudioSourceSupported(requestedSource)

			if (!supportCheck.supported) {
				// 尝试回退策略
				if (requestedSource === "both" || requestedSource === "system") {
					// 回退到麦克风
					const micCheck = RecorderCoreAdapter.isAudioSourceSupported("microphone")
					if (micCheck.supported) {
						logger.warn("音频源不支持，回退到仅麦克风录制", {
							requestedSource,
							fallbackTo: "microphone",
							reason: supportCheck.message || "Audio source not supported",
						})
						audioSourceConfig = {
							...audioSourceConfig,
							source: "microphone",
						}
						// Notify about fallback
						this.events.onAudioSourceFallback?.(
							requestedSource,
							"microphone",
							supportCheck.message || "Audio source not supported",
						)
					} else {
						throw new Error(
							"Neither mixed audio nor microphone recording is supported in this browser",
						)
					}
				} else {
					throw new Error(
						supportCheck.message ||
							`Audio source "${requestedSource}" is not supported`,
					)
				}
			}

			// Create audio recorder adapter configuration
			const recorderConfig: Partial<RecorderCoreConfig> = {
				sampleRate: 16000, // 16kHz
				bitRate: 16, // 16-bit
				chunkDuration: (this.config.timeslice || 10000) / 1000, // Convert ms to seconds
				type: "wav",
				audioSource: audioSourceConfig,
			}

			// Create audio recorder adapter events
			const recorderEvents: RecorderCoreEvents = {
				onChunkReady: this.handleChunkReady.bind(this),
				onError: this.handleRecorderError.bind(this),
				onProcess: this.handleRecorderProcess.bind(this),
				onAudioSourceFallback: this.handleAudioSourceFallback.bind(this),
				onStreamInterrupted: this.handleStreamInterrupted.bind(this),
				onChunkTimeout: this.handleChunkTimeout.bind(this),
			}

			// Create recorder adapter with preauthorized display media if available
			this.recorderAdapter = new RecorderCoreAdapter(recorderConfig, recorderEvents, {
				logger,
				preauthorizedDisplayMedia: this.preauthorizedDisplayMedia,
			})

			logger.log("RecorderAdapter created", {
				sessionId,
				startChunkIndex,
				config: recorderConfig,
			})

			// Start recording
			await this.recorderAdapter.start(sessionId, startChunkIndex)

			// Validate audio stream immediately after start
			const stream = this.recorderAdapter.getMediaStream()
			if (!stream) {
				throw new RecorderInitializationError(
					"Failed to obtain media stream after recorder start",
				)
			}

			const audioTracks = stream.getAudioTracks()
			if (audioTracks.length === 0) {
				throw new RecorderInitializationError("No audio tracks available in media stream")
			}

			// Check track state
			const activeTrack = audioTracks.find((track) => track.readyState === "live")
			if (!activeTrack) {
				throw new RecorderInitializationError("Audio track is not in 'live' state")
			}

			logger.log("Audio stream validated successfully", {
				trackCount: audioTracks.length,
				trackStates: audioTracks.map((t) => ({ id: t.id, state: t.readyState })),
			})

			this.isRecording = true
			this.events.onRecordingStart?.()

			logger.report("录音启动成功", {
				startChunkIndex,
				audioSource: audioSourceConfig?.source,
			})
		} catch (error) {
			// Ensure cleanup on any error
			logger.error("录音启动失败", {
				error: error instanceof Error ? error.message : String(error),
			})
			this.cleanup()
			throw new Error(`Failed to start recording: ${error}`)
		}
	}

	/**
	 * Stop recording
	 * 停止录制
	 */
	stopRecording(): Promise<void> {
		return new Promise((resolve, reject) => {
			if (!this.isRecording || !this.recorderAdapter) {
				resolve()
				return
			}

			try {
				// Stop the recorder adapter
				this.recorderAdapter
					.stop()
					.then(() => {
						this.isRecording = false
						this.events.onRecordingStop?.()
						logger.report("录音停止成功")
						resolve()
					})
					.catch((error) => {
						logger.error("停止录音失败", {
							error: error instanceof Error ? error.message : String(error),
						})
						const err = new Error(`Failed to stop recorder: ${error}`)
						this.events.onRecordingError?.(err)
						reject(err)
					})
			} catch (error) {
				logger.error("停止录音异常", {
					error: error instanceof Error ? error.message : String(error),
				})
				this.cleanup()
				reject(new Error(`Failed to stop recorder: ${error}`))
			}
		})
	}

	/**
	 * Stop recording and cleanup resources
	 * 停止录制并同步清理资源
	 */
	async stopRecordingAndCleanup(): Promise<void> {
		await this.stopRecording()
		this.cleanup()
	}

	/**
	 * Pause recording
	 * 暂停录制
	 */
	pauseRecording(): void {
		if (this.recorderAdapter && this.isRecording) {
			this.recorderAdapter.pause()
			logger.log("录音已暂停")
		}
	}

	/**
	 * Resume recording (not used in original implementation, but kept for API compatibility)
	 * 恢复录制（原实现中未使用，但保留以兼容API）
	 */
	resumeRecording(): void {
		if (this.recorderAdapter && this.isRecording) {
			this.recorderAdapter.resume()
			logger.log("录音已恢复")
		}
	}

	/**
	 * Switch audio source during recording
	 * Uses "auto-pause, switch, auto-resume" strategy
	 * If switch fails, automatically rolls back to previous source
	 * 录制期间切换音频源
	 * 使用"自动暂停-切换-自动恢复"策略
	 * 如果切换失败，自动回滚到之前的音频源，不影响录制
	 */
	async switchAudioSource(newSource: AudioSourceType): Promise<void> {
		if (!this.recorderAdapter) {
			throw new RecorderInitializationError(
				"Cannot switch audio source: RecorderAdapter not initialized",
			)
		}

		if (!this.isRecording) {
			throw new InvalidStateError(this.recorderAdapter.getStatus().state, "switchAudioSource")
		}

		try {
			logger.log("切换音频源", {
				newSource,
			})
			await this.recorderAdapter.switchAudioSource(newSource)
			logger.report("音频源切换成功", {
				newSource,
			})
		} catch (error) {
			// RecorderAdapter has already attempted rollback
			// If rollback succeeded, it won't throw error
			// If we reach here, both switch and rollback failed
			logger.error("音频源切换失败", {
				newSource,
				error: error instanceof Error ? error.message : String(error),
			})
			throw error
		}
	}

	/**
	 * Request data manually to force chunk generation
	 * 手动请求数据以强制生成分片
	 */
	requestData(): void {
		if (!this.isRecording) {
			logger.warn("Cannot request data: not recording")
			return
		}

		if (!this.recorderAdapter) {
			logger.warn("Cannot request data: recorder adapter not initialized")
			return
		}

		logger.log("Requesting manual chunk generation")

		// Force the adapter to generate a chunk from current buffer
		this.recorderAdapter.requestData()
	}

	/**
	 * Handle chunk ready event from recorder adapter
	 * 处理录音适配器的分片就绪事件
	 */
	private async handleChunkReady(chunk: StoredAudioChunk, chunkIndex: number): Promise<void> {
		try {
			let success = false
			try {
				// Save chunk to IndexedDB
				await this.audioChunkDB.saveChunk(chunk)
				success = true
				console.log("Chunk saved to IndexedDB", {
					chunkIndex,
					size: chunk.size,
					id: chunk.id,
				})
			} catch (error) {
				console.error("Failed to save chunk to IndexedDB:", error)
				success = false
			}

			// Emit event with chunk information
			this.events.onDataAvailable?.(chunk, chunkIndex, success)
		} catch (error) {
			const err = new Error(`Failed to handle chunk: ${error}`)
			console.error("Failed to handle chunk:", error)
			this.events.onRecordingError?.(err)
		}
	}

	/**
	 * Handle audio source fallback event
	 * 处理音频源回退事件
	 */
	private handleAudioSourceFallback(
		requestedSource: AudioSourceType,
		fallbackSource: AudioSourceType,
		reason: string,
	): void {
		this.events.onAudioSourceFallback?.(requestedSource, fallbackSource, reason)
	}

	/**
	 * Handle recorder error
	 * 处理录音错误
	 */
	private handleRecorderError(error: Error): void {
		logger.error("录音错误", {
			error: error.message,
		})
		this.events.onRecordingError?.(error)
	}

	/**
	 * Handle recorder processing updates
	 * 处理录音处理更新
	 */
	private handleRecorderProcess(): void {
		// No logging here - this is a hot path called frequently
	}

	/**
	 * Handle stream interruption event
	 * 处理音频流中断事件
	 */
	private handleStreamInterrupted(reason: string, trackId: string, trackLabel: string): void {
		logger.error("录音流中断", {
			reason,
			trackId,
			trackLabel,
		})

		const audioSource = this.config.audioSource?.source || "unknown"
		this.events.onStreamInterrupted?.(reason, {
			trackId,
			trackLabel,
			audioSource,
		})
	}

	/**
	 * Handle chunk timeout event
	 * 处理分片超时事件
	 */
	private handleChunkTimeout(expectedTime: number, actualTime: number, chunkIndex: number): void {
		logger.warn("分片生成超时", {
			expectedTime,
			actualTime,
			chunkIndex,
			delay: actualTime - expectedTime,
		})

		this.events.onChunkTimeout?.({
			expectedChunkInterval: expectedTime,
			actualElapsedTime: actualTime,
			lastChunkIndex: chunkIndex,
		})
	}

	/**
	 * Release audio stream (microphone) while keeping other state intact
	 * Used for pausing recording to free browser microphone permission
	 * 释放音频流（麦克风），但保留其他状态
	 * 用于暂停录音时释放浏览器的麦克风权限
	 */
	releaseStream(): void {
		if (this.recorderAdapter) {
			logger.log("释放音频流")
			// For audio recorder, we need to stop the recorder to release the stream
			// This is different from MediaRecorder which could release stream independently
			this.pauseRecording()
		}
	}

	/**
	 * Cleanup resources
	 * 清理资源
	 */
	cleanup(): void {
		try {
			if (this.recorderAdapter) {
				this.recorderAdapter.cleanup()
				this.recorderAdapter = null
			}

			this.isRecording = false
			logger.log("MediaRecorderService清理完成")
		} catch (error) {
			logger.error("清理过程出错", {
				error: error instanceof Error ? error.message : String(error),
			})
		}
	}

	/**
	 * Get recording status
	 * 获取录制状态
	 */
	getStatus() {
		const adapterStatus = this.recorderAdapter?.getStatus() || {}

		return {
			isRecording: this.isRecording,
			sessionId: this.sessionId || null,
			chunkIndex: this.chunkIndex,
			mediaRecorderState: this.isRecording ? "recording" : "inactive",
			hasAudioStream: this.isRecording,
			supportedMimeTypes: ["audio/wav"],
			audioSource: this.config.audioSource,
			adapterStatus,
		}
	}

	/**
	 * Get current session ID
	 * 获取当前会话ID
	 */
	getCurrentSessionId(): string | null {
		return this.sessionId || null
	}

	/**
	 * Reset service state
	 * 重置服务状态
	 */
	reset(): void {
		this.cleanup()
		this.sessionId = ""
		this.chunkIndex = 0
	}

	/**
	 * Get all chunks for a specific session
	 * 获取指定会话的所有分片
	 */
	async getSessionChunks(sessionId?: string): Promise<StoredAudioChunk[]> {
		const targetSessionId = sessionId || this.sessionId
		if (!targetSessionId) {
			throw new Error(
				"Session ID is required. Either provide sessionId parameter or start recording first.",
			)
		}
		return await this.audioChunkDB.getSessionChunks(targetSessionId)
	}

	/**
	 * Dispose service and cleanup all resources
	 * 释放服务并清理所有资源
	 */
	dispose(): void {
		this.cleanup()
		logger.log("MediaRecorderService已释放")
	}

	/**
	 * Get MediaRecorder stream for voice recognition
	 * 获取用于语音识别的音频流
	 *
	 * Returns the actual recording stream which can be:
	 * - Microphone stream (microphone mode)
	 * - System audio stream (system mode)
	 * - Mixed stream (both mode - microphone + system audio)
	 */
	getMediaRecorderStream(): MediaStream | null {
		return this.recorderAdapter?.getMediaStream() || null
	}

	/**
	 * Get media stream for silence detection
	 * 获取用于静音检测的音频流
	 *
	 * Returns the same stream as getMediaRecorderStream()
	 */
	getMediaStream(): MediaStream | null {
		return this.recorderAdapter?.getMediaStream() || null
	}

	/**
	 * Get frequency data for visualization from shared AnalyserNode
	 * Returns a Uint8Array with frequency data (0-255 values)
	 * 从共享的 AnalyserNode 获取频率数据用于可视化
	 * 返回包含频率数据的 Uint8Array（0-255 的值）
	 */
	getFrequencyData(): Uint8Array | null {
		return this.recorderAdapter?.getFrequencyData() || null
	}

	/**
	 * Get AnalyserNode for advanced visualization use cases
	 * 获取 AnalyserNode 用于高级可视化场景
	 */
	getAnalyserNode(): AnalyserNode | null {
		return this.recorderAdapter?.getAnalyserNode() || null
	}

	getAudioSource(): AudioSourceConfig | null {
		return this.config.audioSource || null
	}

	/**
	 * Set pre-authorized display media stream (must be called in user gesture context)
	 * 设置预授权的显示媒体流（必须在用户手势上下文中调用）
	 */
	setPreauthorizedDisplayMedia(stream: MediaStream): void {
		this.preauthorizedDisplayMedia = stream
		logger.log("Preauthorized display media set", {
			audioTracks: stream.getAudioTracks().length,
			videoTracks: stream.getVideoTracks().length,
		})
	}

	/**
	 * Get pre-authorized display media stream
	 * 获取预授权的显示媒体流
	 */
	getPreauthorizedDisplayMedia(): MediaStream | null {
		return this.preauthorizedDisplayMedia
	}

	/**
	 * Clear pre-authorized display media reference after use
	 * 使用后清理预授权显示媒体引用
	 */
	clearPreauthorizedDisplayMedia(): void {
		this.preauthorizedDisplayMedia = null
		logger.log("Preauthorized display media cleared")
	}

	/**
	 * Get AudioContext instance for reliable duration tracking
	 * AudioContext.currentTime provides the most accurate time source for audio recording
	 * 获取 AudioContext 实例用于可靠的时长追踪
	 * AudioContext.currentTime 为音频录制提供最精确的时间源
	 */
	getAudioContext(): AudioContext | null {
		return this.recorderAdapter?.getAudioContext() || null
	}
}

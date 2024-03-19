/**
 * Audio recorder adapter for real-time audio recording
 * 实时音频录制适配器
 */

import type { StoredAudioChunk } from "./AudioChunkDB"
import { recordingLogger } from "../utils/RecordingLogger"

// Import type definitions
import type {
	RecorderCoreConfig,
	RecorderCoreEvents,
	RecordingState,
	RecordingStatus,
	AudioSourceType,
	AudioChunkData,
	AudioRecorder,
	AudioProcessingMode,
} from "./types/RecorderTypes"
import {
	RecorderError,
	InvalidStateError,
	RecorderInitializationError,
	AudioSourceSwitchError,
	PermissionDeniedError,
} from "./types/RecorderErrors"
import type { RecorderDependencies } from "./types/RecorderDependencies"
import { createDefaultDependencies } from "./types/RecorderDependencies"

// Import managers
import { AudioBufferManager } from "./managers/AudioBufferManager"
import { ResourceManager } from "./managers/ResourceManager"
import { AudioWorkletManager } from "./managers/AudioWorkletManager"
import { TimeTrackingWorkerManager } from "./managers/TimeTrackingWorkerManager"

// Import encoders
import type { AudioEncoder } from "./encoders/AudioEncoder"
import { WAVEncoder } from "./encoders/WAVEncoder"
import { PCMEncoder } from "./encoders/PCMEncoder"

// Import strategies
import type { AudioSourceStrategy } from "./strategies/AudioSourceStrategy"
import { AudioSourceStrategyFactory } from "./utils/AudioSourceStrategyFactory"

const logger = recordingLogger.namespace("Audio:RecorderCore")

/**
 * Default configuration for RecorderCore adapter
 * RecorderCore 适配器默认配置
 */
const DEFAULT_CONFIG: RecorderCoreConfig = {
	sampleRate: 16000, // 16kHz
	bitRate: 16, // 16-bit
	chunkDuration: 10, // 10 seconds per chunk
	type: "wav",
	maxRetries: 5,
}

/**
 * RecorderCoreAdapter - Audio recorder with strategy pattern and dependency injection
 * RecorderCoreAdapter - 使用策略模式和依赖注入的音频录制器
 */
export class RecorderCoreAdapter {
	// Configuration and events
	private readonly config: RecorderCoreConfig
	private readonly events: RecorderCoreEvents
	private readonly dependencies: RecorderDependencies

	// State management
	private state: RecordingState = "idle"
	private sessionId: string = ""
	private chunkIndex: number = 0

	// Components
	private bufferManager: AudioBufferManager | null = null
	private encoder: AudioEncoder | null = null
	private resourceManager: ResourceManager
	private audioSourceStrategy: AudioSourceStrategy | null = null
	private audioRecorder: AudioRecorder | null = null
	private workletManager: AudioWorkletManager | null = null
	private timeTrackingWorker: TimeTrackingWorkerManager | null = null

	// Shared Web Audio API resources for visualization
	private audioContext: AudioContext | null = null
	private analyserNode: AnalyserNode | null = null
	private frequencyDataArray: Uint8Array | null = null

	constructor(
		config: Partial<RecorderCoreConfig> = {},
		events: RecorderCoreEvents = {},
		dependencies?: Partial<RecorderDependencies>,
	) {
		this.config = { ...DEFAULT_CONFIG, ...config }
		this.events = events

		// Create dependencies (with defaults for browser environment)
		this.dependencies = dependencies
			? { ...createDefaultDependencies(logger), ...dependencies }
			: createDefaultDependencies(logger)

		this.resourceManager = new ResourceManager(this.dependencies.logger)

		// Create encoder based on config
		this.encoder = this.createEncoder()
	}

	/**
	 * Start recording with session ID
	 * 使用会话ID开始录制
	 */
	async start(sessionId: string, startChunkIndex: number = 0): Promise<void> {
		if (this.state === "recording") {
			this.dependencies.logger.warn("Recording is already in progress")
			return
		}

		if (this.state !== "idle" && this.state !== "error") {
			throw new InvalidStateError(this.state, "start")
		}

		if (!sessionId) {
			throw new RecorderInitializationError("Session ID is required to start recording")
		}

		try {
			this.setState("initializing")
			this.sessionId = sessionId
			this.chunkIndex = startChunkIndex

			this.dependencies.logger.log("Starting recording", {
				sessionId,
				startChunkIndex,
				audioSource: this.config.audioSource?.source || "microphone",
			})

			// Initialize buffer manager first (needed for onProcess callback)
			// Note: AudioContext will be set later after setupAudioProcessing
			this.bufferManager = new AudioBufferManager(
				this.config,
				{
					onChunkReady: this.handleChunkReady.bind(this),
					onProgress: this.events.onProcess,
					onChunkTimeout: (expectedTime, actualTime, chunkIndex) => {
						this.dependencies.logger.warn("Chunk timeout in buffer manager", {
							expectedTime,
							actualTime,
							chunkIndex,
						})
						this.events.onChunkTimeout?.(expectedTime, actualTime, chunkIndex)
					},
				},
				this.dependencies.logger,
				undefined, // AudioContext will be set after setupAudioProcessing
			)

			// Initialize audio source strategy
			await this.initializeAudioSource()

			// Set up audio processing with automatic mode selection
			// This creates AudioContext and stores it in this.audioContext
			// 设置音频处理，自动选择处理模式
			// 这会创建 AudioContext 并存储在 this.audioContext 中
			await this.setupAudioProcessing()

			// Now that AudioContext is available, update BufferManager and start time tracking
			// 现在 AudioContext 可用了，更新 BufferManager 并启动时间追踪
			if (this.audioContext && this.bufferManager) {
				// Update buffer manager with AudioContext reference
				// 更新 buffer manager 的 AudioContext 引用
				this.bufferManager.setAudioContext(this.audioContext)

				// Reset time tracking using AudioContext.currentTime
				// 使用 AudioContext.currentTime 重置时间追踪
				this.bufferManager.resetTimeTracking()

				// Start Web Worker for background time tracking (fallback for silence periods)
				// 启动 Web Worker 用于后台时间追踪（静音时段的兜底机制）
				this.timeTrackingWorker = new TimeTrackingWorkerManager(this.dependencies.logger)
				this.timeTrackingWorker.start(() => {
					// Worker callback: check time and flush if needed
					// Worker 回调：检查时间并在需要时清空缓冲区
					if (this.bufferManager) {
						this.bufferManager.checkTimeAndFlush()
					}
				}, this.config.chunkDuration * 1000) // Use chunkDuration as check interval

				this.dependencies.logger.log("Time tracking initialized", {
					audioContextTime: this.audioContext.currentTime,
					chunkDuration: this.config.chunkDuration,
					workerActive: this.timeTrackingWorker?.isRunning(),
				})
			} else {
				this.dependencies.logger.warn(
					"AudioContext not available, time-based chunk generation may be unreliable",
				)
			}

			// Start recording
			if (this.audioRecorder) {
				this.audioRecorder.isRecording = true
				this.audioRecorder.isPaused = false
			}

			this.setState("recording")

			this.dependencies.logger.log("Recording started successfully", {
				sessionId: this.sessionId,
				state: this.state,
			})
		} catch (error) {
			this.dependencies.logger.error("Failed to start recording:", error)
			this.setState("error")
			await this.cleanup()
			this.events.onError?.(error as Error)
			throw error
		}
	}

	/**
	 * Stop recording
	 * 停止录制
	 */
	async stop(): Promise<void> {
		if (this.state !== "recording" && this.state !== "paused") {
			return
		}

		try {
			this.setState("stopping")

			if (this.audioRecorder) {
				this.audioRecorder.isRecording = false
				this.audioRecorder.isPaused = false
			}

			// Stop time tracking worker
			// 停止时间追踪 Worker
			if (this.timeTrackingWorker) {
				this.timeTrackingWorker.stop()
				this.timeTrackingWorker = null
			}

			// Flush any remaining buffer
			if (this.bufferManager && this.bufferManager.hasData()) {
				this.bufferManager.forceFlush(this.config.sampleRate)
			}

			this.dependencies.logger.log("Recording stopped")
			this.setState("idle")
		} catch (error) {
			this.dependencies.logger.error("Error stopping recording:", error)
			this.setState("error")
			this.events.onError?.(
				new RecorderError("Failed to stop recording", "STOP_FAILED", error as Error),
			)
		}
	}

	/**
	 * Pause recording
	 * 暂停录制
	 */
	pause(): void {
		if (this.state !== "recording") {
			return
		}

		if (this.audioRecorder) {
			this.audioRecorder.isPaused = true

			// Notify AudioWorklet if using worklet mode
			// 如果使用 worklet 模式，通知 AudioWorklet
			if (this.audioRecorder.processingMode === "worklet" && this.workletManager) {
				this.workletManager.setState("paused")
			}

			this.setState("paused")
			this.dependencies.logger.log("Recording paused")
		}
	}

	/**
	 * Resume recording
	 * 恢复录制
	 */
	resume(): void {
		if (this.state !== "paused") {
			return
		}

		if (this.audioRecorder) {
			this.audioRecorder.isPaused = false

			// Notify AudioWorklet if using worklet mode
			// 如果使用 worklet 模式，通知 AudioWorklet
			if (this.audioRecorder.processingMode === "worklet" && this.workletManager) {
				this.workletManager.setState("recording")
			}

			this.setState("recording")
			this.dependencies.logger.log("Recording resumed")
		}
	}

	/**
	 * Force generate a chunk from current buffer
	 * 强制从当前缓冲区生成分片
	 */
	requestData(): void {
		if (this.state !== "recording") {
			this.dependencies.logger.warn("Cannot request data: not recording", {
				currentState: this.state,
			})
			return
		}

		if (!this.bufferManager) {
			this.dependencies.logger.warn("Cannot request data: buffer manager not initialized")
			return
		}

		// Get actual sample rate from audio recorder
		const sampleRate = this.audioRecorder?.actualSampleRate || this.config.sampleRate

		this.dependencies.logger.log("Forcing chunk generation", {
			sampleRate,
			bufferDuration: this.bufferManager.getDuration(),
		})

		// Force flush current buffer to generate a chunk
		this.bufferManager.forceFlush(sampleRate)
	}

	/**
	 * Switch audio source during recording
	 * Uses "auto-pause, switch, auto-resume" strategy for seamless switching
	 * 录制期间切换音频源
	 * 使用"自动暂停-切换-自动恢复"策略实现无缝切换
	 */
	async switchAudioSource(newSource: AudioSourceType): Promise<void> {
		const currentSource = this.config.audioSource?.source || "microphone"

		// Check if already using the requested source
		if (currentSource === newSource) {
			this.dependencies.logger.warn("Already using requested audio source", {
				source: newSource,
			})
			return
		}

		// Only allow switching during recording or paused state
		if (this.state !== "recording" && this.state !== "paused") {
			throw new InvalidStateError(this.state, "switchAudioSource")
		}

		const wasRecording = this.state === "recording"

		// Backup complete old state for reliable rollback
		const oldState = {
			strategy: this.audioSourceStrategy,
			audioRecorder: this.audioRecorder,
			audioSource: this.config.audioSource?.source || "microphone",
		}

		try {
			this.dependencies.logger.log("Starting audio source switch", {
				from: currentSource,
				to: newSource,
			})

			// Notify listeners that switching is starting
			this.events.onAudioSourceSwitching?.(currentSource, newSource)

			// Step 1: Auto-pause if currently recording
			if (wasRecording) {
				this.dependencies.logger.log("Auto-pausing recording for audio source switch")
				this.pause()
			}

			// Set switching state
			this.setState("switching")

			// Step 2: Update config with new audio source (temporarily)
			this.config.audioSource = {
				...this.config.audioSource,
				source: newSource,
			}

			// Step 3: Initialize NEW audio source FIRST (before cleaning up old one)
			// This ensures we can rollback to old source if new one fails
			// Disable fallback during switching to prevent silent fallback on permission denial
			this.dependencies.logger.log("Initializing new audio source")
			this.audioSourceStrategy = null // Temporarily null to allow initializeAudioSource to create new strategy
			await this.initializeAudioSource(false)

			// Step 4: Set up audio processing for the new source (unified approach)
			// 为新音频源设置音频处理（统一方法）
			await this.setupAudioProcessing()

			// Step 5: New source initialized successfully, NOW cleanup old source
			this.dependencies.logger.log("New audio source initialized, cleaning up old source")
			if (oldState.strategy) {
				await oldState.strategy.cleanup()
			}

			// Notify listeners that switch completed successfully
			this.events.onAudioSourceChanged?.(newSource)

			this.dependencies.logger.log("Audio source switched successfully", {
				from: currentSource,
				to: newSource,
				resumed: wasRecording,
			})
		} catch (error) {
			this.dependencies.logger.error("Failed to switch audio source:", error)

			// Rollback config to old audio source
			this.config.audioSource = {
				...this.config.audioSource,
				source: currentSource,
			}

			// Throw error - rollback also failed
			const switchError = new AudioSourceSwitchError(
				currentSource,
				newSource,
				`Failed to switch audio source from "${currentSource}" to "${newSource}"`,
				error as Error,
				false, // recoveredSuccessfully
			)

			throw switchError
		} finally {
			// Step 6: Auto-resume if was recording before
			if (wasRecording) {
				this.dependencies.logger.log("Auto-resuming recording after audio source switch")
				if (this.audioRecorder) {
					this.audioRecorder.isRecording = true
					this.audioRecorder.isPaused = false
				}
				this.setState("recording")
			} else {
				this.setState("paused")
			}
		}
	}

	/**
	 * Get recording status
	 * 获取录制状态
	 */
	getStatus(): RecordingStatus {
		return {
			state: this.state,
			session: this.sessionId
				? {
						sessionId: this.sessionId,
						chunkIndex: this.chunkIndex,
						startTime: Date.now(), // Simplified, should track actual start time
					}
				: null,
			bufferDuration: this.bufferManager?.getDuration() || 0,
			isPaused: this.state === "paused",
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
	 * Get media stream for silence detection
	 * 获取用于静音检测的音频流
	 */
	getMediaStream(): MediaStream | null {
		return this.audioSourceStrategy?.getMediaStream() || null
	}

	/**
	 * Get frequency data for visualization from shared AnalyserNode
	 * Returns a Uint8Array with frequency data (0-255 values)
	 * 从共享的 AnalyserNode 获取频率数据用于可视化
	 * 返回包含频率数据的 Uint8Array（0-255 的值）
	 */
	getFrequencyData(): Uint8Array | null {
		if (!this.analyserNode || !this.frequencyDataArray) {
			return null
		}

		// Get real-time frequency data
		// @ts-expect-error - getByteFrequencyData accepts Uint8Array with ArrayBufferLike
		this.analyserNode.getByteFrequencyData(this.frequencyDataArray)
		return this.frequencyDataArray
	}

	/**
	 * Get AnalyserNode for advanced visualization use cases
	 * 获取 AnalyserNode 用于高级可视化场景
	 */
	getAnalyserNode(): AnalyserNode | null {
		return this.analyserNode
	}

	/**
	 * Cleanup resources
	 * 清理资源
	 */
	async cleanup(): Promise<void> {
		try {
			this.dependencies.logger.log("Cleaning up RecorderCoreAdapter")

			// Clean up time tracking worker
			// 清理时间追踪 Worker
			if (this.timeTrackingWorker) {
				this.timeTrackingWorker.stop()
				this.timeTrackingWorker = null
			}

			// Clean up audio worklet manager
			if (this.workletManager) {
				await this.workletManager.cleanup()
				this.workletManager = null
			}

			// Clean up audio source strategy
			if (this.audioSourceStrategy) {
				await this.audioSourceStrategy.cleanup()
				this.audioSourceStrategy = null
			}

			// Clean up buffer manager
			if (this.bufferManager) {
				this.bufferManager.clear()
				this.bufferManager = null
			}

			// Clean up shared Web Audio API resources for visualization
			if (this.analyserNode) {
				this.analyserNode.disconnect()
				this.analyserNode = null
			}

			this.frequencyDataArray = null
			this.audioContext = null // Reference will be cleaned up by resourceManager

			// Clean up all other resources
			await this.resourceManager.cleanupAll()

			// Reset state
			this.audioRecorder = null
			this.sessionId = ""
			this.chunkIndex = 0
			this.setState("idle")

			this.dependencies.logger.log("RecorderCoreAdapter cleanup completed")
		} catch (error) {
			this.dependencies.logger.error("Error during cleanup:", error)
		}
	}

	/**
	 * Check if error is permission denied error
	 * 检查错误是否是权限被拒绝错误
	 */
	private isPermissionDeniedError(error: unknown): boolean {
		if (error instanceof PermissionDeniedError) {
			return true
		}

		if (error instanceof Error) {
			const errorName = error.name
			const errorMessage = error.message.toLowerCase()

			// Check for DOMException with NotAllowedError
			if (
				errorName === "NotAllowedError" ||
				errorName === "NotReadableError" ||
				errorMessage.includes("permission denied") ||
				errorMessage.includes("user denied") ||
				errorMessage.includes("not allowed")
			) {
				return true
			}
		}

		return false
	}

	/**
	 * Initialize audio source strategy based on config
	 * 根据配置初始化音频源策略
	 */
	private async initializeAudioSource(allowFallback: boolean = true): Promise<void> {
		const audioSource: AudioSourceType = this.config.audioSource?.source || "microphone"

		this.dependencies.logger.log("Initializing audio source:", audioSource)

		// Check support
		const supportCheck = AudioSourceStrategyFactory.isSupported(audioSource)
		if (!supportCheck.supported) {
			throw new RecorderInitializationError(
				supportCheck.message || `Audio source "${audioSource}" is not supported`,
			)
		}

		// Create strategy with fallback support
		// All modes now use manual processing (scriptProcessor)
		// 创建策略并支持回退
		// 所有模式现在都使用手动处理（scriptProcessor）
		let actualAudioSource = audioSource
		try {
			this.audioSourceStrategy = AudioSourceStrategyFactory.create(
				audioSource,
				this.config,
				this.dependencies,
			)
			const result = await this.audioSourceStrategy.initialize()
			this.audioRecorder = result.audioRecorder
		} catch (error) {
			// Don't fallback if permission is denied or fallback is disabled
			if (this.isPermissionDeniedError(error)) {
				this.dependencies.logger.error("Permission denied for audio source:", error)
				throw error
			}

			// Attempt fallback for system/both modes (only if allowed)
			if (allowFallback && (audioSource === "system" || audioSource === "both")) {
				this.dependencies.logger.warn(
					`Failed to initialize ${audioSource} audio source, falling back to microphone`,
					error,
				)

				// Clean up failed strategy
				if (this.audioSourceStrategy) {
					await this.audioSourceStrategy.cleanup()
				}

				// Try microphone fallback
				this.audioSourceStrategy = AudioSourceStrategyFactory.create(
					"microphone",
					this.config,
					this.dependencies,
				)
				const result = await this.audioSourceStrategy.initialize()
				this.audioRecorder = result.audioRecorder
				actualAudioSource = "microphone"

				// Update config with actual audio source used (fallback)
				// 更新配置为实际使用的音频源（fallback）
				if (this.config.audioSource) {
					this.config.audioSource.source = actualAudioSource
				} else {
					this.config.audioSource = {
						source: actualAudioSource,
					}
				}

				this.events.onAudioSourceFallback?.(
					audioSource,
					actualAudioSource,
					supportCheck.message || `Audio source "${audioSource}" is not supported`,
				)

				this.dependencies.logger.log("Audio source fallback applied, config updated", {
					requested: audioSource,
					actual: actualAudioSource,
				})
			} else {
				throw error
			}
		}

		this.dependencies.logger.log("Audio source initialized", {
			requested: audioSource,
			actual: actualAudioSource,
			strategy: this.audioSourceStrategy?.getName(),
		})
	}

	/**
	 * Set up audio processing with automatic mode selection
	 * 设置音频处理并自动选择处理模式
	 */
	private async setupAudioProcessing(): Promise<void> {
		if (!this.audioRecorder) {
			this.dependencies.logger.warn("No audio recorder available for processing")
			return
		}

		// Determine preferred processing mode
		// 确定首选处理模式
		const preferWorklet = this.dependencies.preferWorklet !== false // Default to true
		const workletSupported = RecorderCoreAdapter.isAudioWorkletSupported()

		this.dependencies.logger.log("Audio processing mode selection", {
			preferWorklet,
			workletSupported,
		})

		// Try AudioWorklet if preferred and supported
		// 如果首选且支持，尝试使用 AudioWorklet
		if (preferWorklet && workletSupported) {
			try {
				await this.setupAudioWorkletProcessing()
				this.audioRecorder.processingMode = "worklet"
				this.dependencies.logger.log("Using AudioWorklet for audio processing")
				return
			} catch (error) {
				this.dependencies.logger.warn(
					"Failed to set up AudioWorklet, falling back to ScriptProcessor",
					error,
				)
			}
		}

		// Fallback to ScriptProcessor
		// 降级到 ScriptProcessor
		this.setupScriptProcessorProcessing()
		this.audioRecorder.processingMode = "script-processor"
		this.dependencies.logger.log("Using ScriptProcessor for audio processing")
	}

	/**
	 * Set up AudioWorklet processing (modern approach)
	 * 设置 AudioWorklet 处理（现代方法）
	 */
	private async setupAudioWorkletProcessing(): Promise<void> {
		if (!this.audioRecorder) {
			throw new RecorderError("Audio recorder not initialized", "RECORDER_NOT_INITIALIZED")
		}

		const mediaStream = this.audioSourceStrategy?.getMediaStream()
		if (!mediaStream) {
			throw new RecorderError("No media stream available", "NO_MEDIA_STREAM")
		}

		try {
			// Create AudioContext
			const audioContext = this.dependencies.audioContextFactory.create({
				sampleRate: this.config.sampleRate,
			})

			// Get actual sample rate
			const actualSampleRate = audioContext.sampleRate
			this.audioRecorder.actualSampleRate = actualSampleRate

			// Store AudioContext reference for visualization
			this.audioContext = audioContext

			this.dependencies.logger.log("AudioContext created for AudioWorklet", {
				requestedSampleRate: this.config.sampleRate,
				actualSampleRate,
			})

			// Create AnalyserNode for visualization (shared across components)
			this.analyserNode = audioContext.createAnalyser()
			this.analyserNode.fftSize = 256
			this.analyserNode.smoothingTimeConstant = 0.8
			this.analyserNode.minDecibels = -90
			this.analyserNode.maxDecibels = -10
			this.frequencyDataArray = new Uint8Array(this.analyserNode.frequencyBinCount)

			this.dependencies.logger.log("AnalyserNode created for visualization", {
				fftSize: this.analyserNode.fftSize,
				frequencyBinCount: this.analyserNode.frequencyBinCount,
			})

			// Create and load worklet manager
			this.workletManager = new AudioWorkletManager(
				this.dependencies.logger,
				this.dependencies.workletPath,
			)

			await this.workletManager.loadWorklet(audioContext)

			// Create worklet node
			const workletNode = this.workletManager.createWorkletNode(audioContext)

			// Store reference
			this.audioRecorder.workletNode = workletNode

			// Set up message handler
			this.workletManager.setupMessageHandler(
				workletNode,
				(buffer: Int16Array) => {
					// Add to buffer manager with actual sample rate
					if (this.bufferManager) {
						this.bufferManager.addData(buffer, actualSampleRate)
					}
				},
				(error: Error) => {
					this.dependencies.logger.error("AudioWorklet error:", error)
					this.events.onError?.(error)
				},
				(metrics) => {
					// Log metrics in development mode
					// 开发模式下记录性能指标
					if (import.meta.env.DEV) {
						this.dependencies.logger.log("AudioWorklet metrics:", {
							processed: metrics.processedSamples,
							messages: metrics.messagesCount,
							errors: metrics.errorsCount,
							dropped: metrics.droppedFrames,
							time: metrics.currentTime.toFixed(2) + "s",
						})
					}

					// Warn if there are dropped frames or errors
					// 如果有掉帧或错误，发出警告
					if (metrics.droppedFrames > 0) {
						this.dependencies.logger.warn(
							`AudioWorklet dropped ${metrics.droppedFrames} frames in last 5s`,
						)
					}
					if (metrics.errorsCount > 0) {
						this.dependencies.logger.warn(
							`AudioWorklet encountered ${metrics.errorsCount} errors in last 5s`,
						)
					}
				},
			)

			// Create media stream source
			const source = audioContext.createMediaStreamSource(mediaStream)

			const gainNode = this.createMicrophoneGainNode(audioContext)

			// Connect: source -> (gain) -> worklet -> destination
			this.connectSourceToNode(source, workletNode, gainNode)
			workletNode.connect(audioContext.destination)

			// Connect analyser for visualization (does not affect recording)
			if (this.analyserNode) {
				this.connectSourceToNode(source, this.analyserNode, gainNode)
			}

			// Set initial state
			this.workletManager.setState("recording")

			// Register audio context for cleanup
			this.resourceManager.register(
				"audioContext",
				"AudioContext",
				async () => {
					await audioContext.close()
				},
				audioContext,
			)

			this.dependencies.logger.log("AudioWorklet processing set up successfully")
		} catch (error) {
			this.dependencies.logger.error("Failed to set up AudioWorklet processing:", error)
			throw error
		}
	}

	/**
	 * Set up ScriptProcessor processing (fallback approach)
	 * 设置 ScriptProcessor 处理（降级方法）
	 */
	private setupScriptProcessorProcessing(): void {
		if (!this.audioRecorder) {
			this.dependencies.logger.warn("No audio recorder available for script processor")
			return
		}

		// Check if script processor is already set up by strategy
		// 检查策略是否已经设置了 script processor
		if (this.audioRecorder.scriptProcessor) {
			// Strategy already set up script processor, just attach the handler
			// 策略已经设置了 script processor，只需要附加处理器
			const scriptProcessor = this.audioRecorder.scriptProcessor
			// Use actual sample rate from AudioContext (stored by strategy)
			const actualSampleRate = this.audioRecorder.actualSampleRate || this.config.sampleRate

			scriptProcessor.onaudioprocess = (e) => {
				if (this.state !== "recording") {
					return
				}

				const inputData = e.inputBuffer.getChannelData(0)
				const buffer = new Int16Array(inputData.length)

				// Convert Float32Array to Int16Array
				for (let i = 0; i < inputData.length; i++) {
					const s = Math.max(-1, Math.min(1, inputData[i]))
					buffer[i] = s < 0 ? s * 0x8000 : s * 0x7fff
				}

				// Add to buffer manager with actual sample rate
				if (this.bufferManager) {
					this.bufferManager.addData(buffer, actualSampleRate)
				}
			}

			this.dependencies.logger.log("ScriptProcessor set up (from strategy)", {
				configuredSampleRate: this.config.sampleRate,
				actualSampleRate,
			})
		} else {
			// For microphone mode, we need to set up script processor manually
			// 对于麦克风模式，需要手动设置 script processor
			const mediaStream = this.audioSourceStrategy?.getMediaStream()
			if (!mediaStream) {
				this.dependencies.logger.warn("No media stream available for script processor")
				return
			}

			try {
				// Create AudioContext
				// Use native sample rate to avoid resampling artifacts
				// 使用原生采样率以避免重采样伪影
				const audioContext = this.dependencies.audioContextFactory.create()

				// Get actual sample rate (browser may not support requested rate)
				const actualSampleRate = audioContext.sampleRate

				// Store actual sample rate in audio recorder
				this.audioRecorder.actualSampleRate = actualSampleRate

				// Store AudioContext reference for visualization
				this.audioContext = audioContext

				this.dependencies.logger.log("AudioContext created for ScriptProcessor", {
					requestedSampleRate: this.config.sampleRate,
					actualSampleRate,
				})

				// Create AnalyserNode for visualization (shared across components)
				this.analyserNode = audioContext.createAnalyser()
				this.analyserNode.fftSize = 256
				this.analyserNode.smoothingTimeConstant = 0.8
				this.analyserNode.minDecibels = -90
				this.analyserNode.maxDecibels = -10
				this.frequencyDataArray = new Uint8Array(this.analyserNode.frequencyBinCount)

				this.dependencies.logger.log("AnalyserNode created for visualization", {
					fftSize: this.analyserNode.fftSize,
					frequencyBinCount: this.analyserNode.frequencyBinCount,
				})

				// Create media stream source
				const source = audioContext.createMediaStreamSource(mediaStream)

				const gainNode = this.createMicrophoneGainNode(audioContext)

				// Create script processor to capture audio data
				const bufferSize = 4096
				const scriptProcessor = audioContext.createScriptProcessor(bufferSize, 1, 1)

				// Store references in audio recorder for cleanup
				this.audioRecorder.scriptProcessor = scriptProcessor
				this.audioRecorder.audioSource = source

				// Set up audio processing handler
				scriptProcessor.onaudioprocess = (e) => {
					if (this.state !== "recording") {
						return
					}

					const inputData = e.inputBuffer.getChannelData(0)
					const buffer = new Int16Array(inputData.length)

					// Convert Float32Array to Int16Array
					for (let i = 0; i < inputData.length; i++) {
						const s = Math.max(-1, Math.min(1, inputData[i]))
						buffer[i] = s < 0 ? s * 0x8000 : s * 0x7fff
					}

					// Add to buffer manager with actual sample rate
					if (this.bufferManager) {
						this.bufferManager.addData(buffer, actualSampleRate)
					}
				}

				// Connect nodes
				this.connectSourceToNode(source, scriptProcessor, gainNode)
				scriptProcessor.connect(audioContext.destination)

				// Connect analyser for visualization (does not affect recording)
				if (this.analyserNode) {
					this.connectSourceToNode(source, this.analyserNode, gainNode)
				}

				// Register audio context for cleanup
				this.resourceManager.register(
					"audioContext",
					"AudioContext",
					async () => {
						await audioContext.close()
					},
					audioContext,
				)

				this.dependencies.logger.log("ScriptProcessor set up successfully")
			} catch (error) {
				this.dependencies.logger.error("Failed to set up ScriptProcessor:", error)
			}
		}
	}

	private createMicrophoneGainNode(audioContext: AudioContext): GainNode | null {
		const audioSource = this.config.audioSource
		const isMicrophoneSource = (audioSource?.source || "microphone") === "microphone"
		if (!isMicrophoneSource) return null

		const microphoneGain = audioSource?.microphoneGain ?? 1.0
		const gainNode = audioContext.createGain()
		gainNode.gain.value = microphoneGain
		return gainNode
	}

	private connectSourceToNode(
		source: MediaStreamAudioSourceNode,
		target: AudioNode,
		gainNode: GainNode | null,
	): void {
		if (gainNode) {
			source.connect(gainNode)
			gainNode.connect(target)
			return
		}
		source.connect(target)
	}

	/**
	 * Handle audio chunk ready event
	 * 处理音频分片准备就绪事件
	 */
	private handleChunkReady(chunkData: AudioChunkData): void {
		try {
			if (!this.encoder) {
				throw new RecorderError("Encoder not initialized", "ENCODER_MISSING")
			}

			// Encode audio data
			const encodedChunk = this.encoder.encode(chunkData)

			// Create blob
			const blob = new Blob([encodedChunk.data], { type: encodedChunk.mimeType })

			// Create stored audio chunk
			const currentChunkIndex = this.chunkIndex
			const storedChunk: StoredAudioChunk = {
				id: this.generateChunkId(),
				sessionId: this.sessionId,
				chunk: blob,
				index: this.chunkIndex++,
				timestamp: Date.now(),
				size: blob.size,
				uploadStatus: "pending",
			}

			this.dependencies.logger.log("Chunk created", {
				index: currentChunkIndex,
				size: blob.size,
				duration: chunkData.duration,
			})

			// Notify about chunk ready
			this.events.onChunkReady?.(storedChunk, currentChunkIndex)
		} catch (error) {
			this.dependencies.logger.error("Failed to handle chunk ready:", error)
			this.events.onError?.(error as Error)
		}
	}

	/**
	 * Create encoder based on config
	 * 根据配置创建编码器
	 */
	private createEncoder(): AudioEncoder {
		switch (this.config.type) {
			case "wav":
				return new WAVEncoder()
			case "pcm":
				return new PCMEncoder()
			default:
				this.dependencies.logger.warn(
					`Unknown encoder type: ${this.config.type}, defaulting to WAV`,
				)
				return new WAVEncoder()
		}
	}

	/**
	 * Set recording state and notify listeners
	 * 设置录制状态并通知监听器
	 */
	private setState(newState: RecordingState): void {
		const oldState = this.state
		this.state = newState

		this.dependencies.logger.log(`State changed: ${oldState} -> ${newState}`)
		this.events.onStateChange?.(newState)
	}

	/**
	 * Generate unique chunk ID
	 * 生成唯一分片ID
	 */
	private generateChunkId(): string {
		return `recorder_core_chunk_${this.sessionId}_${Date.now()}_${Math.random()
			.toString(36)
			.substr(2, 9)}`
	}

	/**
	 * Check if specific audio source is supported
	 * 检查特定音频源是否支持
	 */
	static isAudioSourceSupported(source: AudioSourceType): {
		supported: boolean
		message?: string
	} {
		return AudioSourceStrategyFactory.isSupported(source)
	}

	/**
	 * Check if browser supports recording
	 * 检查浏览器是否支持录音
	 */
	static isBrowserSupported(): boolean {
		try {
			if (typeof window === "undefined") {
				return false
			}

			// Check for getUserMedia support
			const nav = navigator as {
				getUserMedia?: unknown
				webkitGetUserMedia?: unknown
				mozGetUserMedia?: unknown
			}
			const hasGetUserMedia =
				!!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia) ||
				!!nav.getUserMedia ||
				!!nav.webkitGetUserMedia ||
				!!nav.mozGetUserMedia

			// Check for AudioContext support
			const win = window as { webkitAudioContext?: unknown }
			const hasAudioContext =
				typeof window !== "undefined" &&
				(typeof AudioContext !== "undefined" ||
					typeof win.webkitAudioContext !== "undefined")

			return hasGetUserMedia && hasAudioContext
		} catch (error) {
			logger.error("Error checking browser support:", error)
			return false
		}
	}

	/**
	 * Check if AudioWorklet is supported in current browser
	 * 检查当前浏览器是否支持 AudioWorklet
	 */
	static isAudioWorkletSupported(): boolean {
		try {
			if (typeof window === "undefined") {
				return false
			}

			// Check for AudioWorklet support
			if (typeof AudioContext === "undefined") {
				return false
			}

			// // Check if audioWorklet property exists on AudioContext prototype
			// if (typeof AudioContext.prototype.audioWorklet === "undefined") {
			// 	return false
			// }

			// Check for AudioWorkletNode support
			if (typeof AudioWorkletNode === "undefined") {
				return false
			}

			return true
		} catch (error) {
			logger.error("Error checking AudioWorklet support:", error)
			return false
		}
	}

	/**
	 * Get preferred audio processing mode based on browser capabilities
	 * 根据浏览器能力获取推荐的音频处理模式
	 */
	static getPreferredProcessingMode(): AudioProcessingMode {
		return RecorderCoreAdapter.isAudioWorkletSupported() ? "worklet" : "script-processor"
	}

	/**
	 * Get audio recorder (for debugging)
	 * 获取音频录制器（用于调试）
	 */
	getAudioRecorder(): AudioRecorder | null {
		return this.audioRecorder
	}

	/**
	 * Get AudioContext instance for duration tracking
	 * AudioContext provides the most reliable time source for audio recording
	 * 获取 AudioContext 实例用于时长追踪
	 * AudioContext 为音频录制提供最可靠的时间源
	 */
	getAudioContext(): AudioContext | null {
		return this.audioContext
	}
}

// Export types and interfaces for backward compatibility
export type { RecorderCoreConfig, RecorderCoreEvents }

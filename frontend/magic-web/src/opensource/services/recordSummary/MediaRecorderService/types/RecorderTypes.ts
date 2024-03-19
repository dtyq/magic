/**
 * Type definitions for RecorderCore adapter
 * RecorderCore 适配器类型定义
 */

import type { StoredAudioChunk } from "../AudioChunkDB"
import type {
	MicrophoneConstraintsConfig,
	SystemAudioConstraintsConfig,
} from "../config/AudioConstraintsConfig"

/**
 * Recording state machine states
 * 录制状态机状态
 */
export type RecordingState =
	| "idle"
	| "initializing"
	| "recording"
	| "paused"
	| "switching" // Audio source switching in progress
	| "stopping"
	| "error"

/**
 * Audio source type for recording
 * 音频源类型
 */
export type AudioSourceType = "microphone" | "system" | "both"

/**
 * Audio format type
 * 音频格式类型
 */
export type AudioFormatType = "pcm" | "wav"

/**
 * Audio processing mode
 * 音频处理模式
 */
export type AudioProcessingMode = "worklet" | "script-processor"

/**
 * Recording session state
 * 录制会话状态
 */
export interface RecordingSessionState {
	sessionId: string
	chunkIndex: number
	startTime: number
}

/**
 * Recording status information
 * 录制状态信息
 */
export interface RecordingStatus {
	state: RecordingState
	session: RecordingSessionState | null
	bufferDuration: number
	isPaused: boolean
}

/**
 * Extended DisplayMediaStreamOptions for better browser support
 * 扩展的 DisplayMediaStreamOptions 以支持更多浏览器选项
 */
export interface DisplayMediaStreamOptions extends MediaStreamConstraints {
	preferCurrentTab?: boolean
	selfBrowserSurface?: "include" | "exclude"
	systemAudio?: "include" | "exclude"
	surfaceSwitching?: "include" | "exclude"
	monitorTypeSurfaces?: "include" | "exclude"
}

/**
 * Audio source configuration
 * 音频源配置
 */
export interface AudioSourceConfig {
	source: AudioSourceType
	microphoneGain?: number // Microphone gain (>= 0), default 1.1
	systemGain?: number // System audio gain (>= 0), default 1.0
	microphoneConstraints?: Partial<MicrophoneConstraintsConfig> // Custom microphone constraints
	systemAudioConstraints?: Partial<SystemAudioConstraintsConfig> // Custom system audio constraints
}

/**
 * Recorder core configuration
 * 录音器核心配置
 */
export interface RecorderCoreConfig {
	sampleRate: number // Sample rate in Hz (default: 16000)
	bitRate: number // Bit depth (default: 16)
	chunkDuration: number // Chunk duration in seconds (default: 10)
	type: AudioFormatType // Output format
	maxRetries: number // Max retries for opening recorder (default: 5)
	audioSource?: AudioSourceConfig // Audio source configuration
}

/**
 * Events fired by RecorderCore adapter
 * RecorderCore 适配器事件
 */
export interface RecorderCoreEvents {
	onChunkReady?: (chunk: StoredAudioChunk, chunkIndex: number) => void
	onError?: (error: Error) => void
	onProcess?: (duration: number, bufferSize: number) => void
	onStateChange?: (state: RecordingState) => void
	/**
	 * Called when audio source switching starts
	 * 音频源开始切换时调用
	 */
	onAudioSourceSwitching?: (fromSource: AudioSourceType, toSource: AudioSourceType) => void
	/**
	 * Called when audio source is successfully switched
	 * 音频源成功切换时调用
	 */
	onAudioSourceChanged?: (newSource: AudioSourceType) => void
	/**
	 * Called when audio source fallback occurs
	 * 音频源回退时调用
	 */
	onAudioSourceFallback?: (
		requestedSource: AudioSourceType,
		fallbackSource: AudioSourceType,
		reason: string,
	) => void
	/**
	 * Called when audio stream is interrupted (track ended, etc.)
	 * 音频流中断时调用（轨道结束等）
	 */
	onStreamInterrupted?: (reason: string, trackId: string, trackLabel: string) => void
	/**
	 * Called when chunk generation timeout is detected
	 * 检测到分片生成超时时调用
	 */
	onChunkTimeout?: (expectedTime: number, actualTime: number, lastChunkIndex: number) => void
}

/**
 * Audio recorder interface for managing recording state
 * 音频录制器接口，用于管理录制状态
 */
export interface AudioRecorder {
	scriptProcessor?: ScriptProcessorNode
	audioSource?: MediaStreamAudioSourceNode
	mixedSource?: MediaStreamAudioSourceNode
	workletNode?: AudioWorkletNode // AudioWorklet node for modern browsers
	isRecording: boolean
	isPaused: boolean
	actualSampleRate?: number // Actual AudioContext sample rate (may differ from config)
	processingMode?: AudioProcessingMode // Current audio processing mode
}

/**
 * Audio buffer data for chunk generation
 * 用于分片生成的音频缓冲数据
 */
export interface AudioBufferData {
	buffers: Int16Array[]
	duration: number
	totalSamples: number
}

/**
 * Audio chunk data ready for encoding
 * 准备编码的音频分片数据
 */
export interface AudioChunkData {
	pcmData: Int16Array
	sampleRate: number
	bitRate: number
	duration: number
}

/**
 * Sample data chunk for continuous audio processing
 * 用于连续音频处理的采样数据块
 */
export interface SampleDataChunk {
	data: Int16Array
	sampleRate: number
}

/**
 * Encoded audio chunk result
 * 编码后的音频分片结果
 */
export interface EncodedAudioChunk {
	data: ArrayBuffer
	mimeType: string
	size: number
}

/**
 * Retry strategy configuration
 * 重试策略配置
 */
export interface RetryConfig {
	maxAttempts: number
	baseDelayMs: number
	maxDelayMs: number
	shouldRetry?: (error: Error, attempt: number) => boolean
}

/**
 * Retry operation result
 * 重试操作结果
 */
export interface RetryResult<T> {
	success: boolean
	result?: T
	error?: Error
	attempts: number
}

/**
 * Resource cleanup function type
 * 资源清理函数类型
 */
export type ResourceCleanupFn = () => void | Promise<void>

/**
 * Managed resource interface
 * 托管资源接口
 */
export interface ManagedResource {
	id: string
	type: string
	cleanup: ResourceCleanupFn
	resource?: unknown
}

/**
 * Audio source support check result
 * 音频源支持检查结果
 */
export interface AudioSourceSupportResult {
	supported: boolean
	message?: string
}

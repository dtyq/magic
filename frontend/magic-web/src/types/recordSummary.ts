/**
 * Recording summary service types
 * 录制纪要服务相关类型定义
 */

import { VoiceResultUtterance } from "@/components/business/VoiceInput/services/VoiceClient/types"
import {
	ProjectListItem,
	Topic,
	Workspace,
} from "@/pages/superMagic/pages/Workspace/types"
import { StoredAudioChunk } from "@/services/recordSummary/MediaRecorderService/AudioChunkDB"
import { ModelItem } from "@/pages/superMagic/components/MessageEditor/components/ModelSwitch/types"

// 录制状态枚举
export type RecordingStatus = "init" | "recording" | "paused"

// 分片状态枚举
export type ChunkStatus = "pending" | "uploading" | "uploaded" | "failed"

// 录制会话数据结构
export interface RecordingSession {
	id: string // 唯一录制ID
	startTime: number // 录制开始时间戳
	lastActivityTime: number // 最后活动时间
	totalDuration: number // 总录制时长(ms)
	status: RecordingStatus
	textContent: (VoiceResultUtterance & { add_time: number; id: string })[] // 语音识别文本内容
	currentChunkIndex?: number // 当前分片索引（用于恢复时继续计数）
	metadata: {
		deviceInfo?: string
		userAgent?: string
		audioFormat?: string
		sampleRate?: number
	}
	userId: string
	model: ModelItem | null
	/**
	 * 组织 code
	 */
	organizationCode?: string
	/**
	 * 组织名称
	 */
	organizationName?: string
	/**
	 * 工作空间
	 */
	workspace: Workspace | null
	/**
	 * 项目
	 */
	project: ProjectListItem | null
	/**
	 * 聊天主题
	 */
	topic?: Topic | null
	/**
	 * 聊天话题
	 */
	chatTopic?: Topic | null
	/**
	 * 笔记内容
	 */
	note?: {
		content: string
		file_extension: string
	}
	/**
	 * 录音目录信息（持久化）
	 */
	directories?: RecordingDirectories
	/**
	 * 预设文件信息（笔记和转写文件）
	 */
	presetFiles?: PresetFiles
	/**
	 * 笔记文件的最后更新时间戳（用于检测文件变更）
	 */
	noteLastUpdatedAt?: string
	/**
	 * 音频源配置
	 */
	audioSource?: AudioSourceConfig
}

// 合并后的分片数据
export interface MergedChunk {
	id: string
	sessionId: string
	mergedChunkIndex: number // 合并分片序号
	audioData: ArrayBuffer // 合并后的音频数据
	totalSize: number // 总大小
	startTimestamp: number // 开始时间戳
	endTimestamp: number // 结束时间戳
}

// 恢复数据结构
export interface RestorationData {
	currentSession?: RecordingSession
}

// 上传配置
export interface UploadConfig {
	chunkSizeThreshold: number // 分片大小阈值(bytes)
	timeThreshold: number // 时间阈值(ms)
	chunkCountThreshold: number // 分片数量阈值
	maxConcurrentUploads: number // 最大并发上传数
	maxRetryCount: number // 最大重试次数
}

// 上传任务状态
export type UploadTaskStatus = "pending" | "uploading" | "completed" | "failed" | "cancelled"

// 上传任务
export interface UploadTask {
	id: string
	mergedChunk: MergedChunk
	status: UploadTaskStatus
	progress: number
	retryCount: number
	error?: Error
	uploadUrl?: string
	startTime?: number
	endTime?: number
}

// 上传事件
export interface UploadEvents {
	onProgress: (taskId: string, progress: number) => void
	onSuccess: (taskId: string, url: string) => void
	onError: (taskId: string, error: Error) => void
	onRetry: (taskId: string, retryCount: number) => void
	/** 当任务结束时调用（错误码 43200） */
	onTaskEnd?: (sessionId: string) => void
	/** 当网络离线时调用，提示用户数据已保存 */
	onNetworkOffline?: (sessionId: string, pendingChunksCount: number) => void
	/** 当网络恢复在线时调用，包含待上传分片数量 */
	onNetworkOnline?: (sessionId: string, pendingChunksCount: number) => void
	/** 当分片达到最大重试次数时调用 */
	onMaxRetriesReached?: (chunkId: string, retryCount: number) => void
}

// 上传队列状态
export interface UploadQueueStatus {
	pending: number
	uploading: number
	completed: number
	failed: number
	totalTasks: number
}

// 分片管理器事件
export interface ChunkManagerEvents {
	onUploadProgress: (progress: number) => void
	onUploadComplete: (chunkId: string, url: string) => void
	onUploadError: (chunkId: string, error: Error) => void
}

// 持久化选项
export interface PersistenceOptions {
	storagePrefix: string // 存储key前缀
	enableIndexedDB: boolean // 是否启用IndexedDB
	autoCleanupDays: number // 自动清理天数
	maxStorageSize: number // 最大存储大小(bytes)
}

// 会话恢复选项
export interface SessionRestoreOptions {
	autoRestore: boolean // 是否自动恢复
	confirmRestore: boolean // 是否需要确认恢复
	clearOnRestore: boolean // 恢复后是否清理旧数据
}

// Audio source type for recording
export type AudioSourceType = "microphone" | "system" | "both"

// Audio source configuration
export interface AudioSourceConfig {
	source: AudioSourceType // Audio source type
	microphoneGain?: number // Microphone gain (0-1), default 1.0
	systemGain?: number // System audio gain (0-1), default 1.0
}

// Media recorder configuration (using recorder-core for WAV recording)
export interface MediaRecorderConfig {
	mimeType?: string // Default: 'audio/wav' (recorder-core uses WAV format)
	audioBitsPerSecond?: number // Audio bitrate (default: 256000 for 16kHz * 16bit)
	timeslice?: number // Recording chunk duration in ms (default: 10000 for 10 seconds)
	autoRestartDelayMs?: number // Auto-restart delay (not used in recorder-core)
	maxAutoRestartAttempts?: number // Max auto-restart attempts (not used in recorder-core)
	enableEchoCancellation?: boolean // Enable echo cancellation
	enableNoiseSuppression?: boolean // Enable noise suppression
	autoGainControl?: boolean // Enable automatic gain control
	audioSource?: AudioSourceConfig // Audio source configuration, default microphone only
}

// Media recorder events (extends chunk manager events)
export interface MediaRecorderEvents {
	onRecordingStart?: () => void
	onRecordingStop?: () => void
	onRecordingError?: (error: Error) => void
	onDataAvailable?: (
		storedChunk: StoredAudioChunk,
		chunkIndex: number,
		indexdbSaveSuccess: boolean,
	) => void
	onMediaRecorderNotSupported?: () => void
	onAudioSourceFallback?: (
		requestedSource: AudioSourceType,
		fallbackSource: AudioSourceType,
		reason: string,
	) => void
	// Stream interruption event (track ended, muted, etc.)
	onStreamInterrupted?: (
		reason: string,
		details?: {
			trackId: string
			trackLabel: string
			audioSource: string
		},
	) => void
	// Chunk generation timeout event
	onChunkTimeout?: (details: {
		expectedChunkInterval: number // seconds
		actualElapsedTime: number // seconds
		lastChunkIndex: number
	}) => void
}

// Recording source type (using recorder-core for real-time PCM recording)
export type RecordingSource = "pcm_chunks" | "recorder_core"

// Recording configuration with source selection
export interface RecordingConfig {
	source: RecordingSource
	mediaRecorder?: MediaRecorderConfig
	upload: UploadConfig
	persistence: PersistenceOptions
	sessionRestore: SessionRestoreOptions
}

// Recording directory types
export interface RecordingDirectory {
	directory_path: string
	directory_id: string
	hidden: boolean
	type: "asr_hidden_dir" | "asr_display_dir"
}

export interface RecordingDirectories {
	asr_hidden_dir: RecordingDirectory
	asr_display_dir: RecordingDirectory
}

// Preset file information from backend
export interface PresetFile {
	file_id: string
	file_name: string
	file_path: string
}

export interface PresetFiles {
	note_file: PresetFile
	transcript_file: PresetFile
}

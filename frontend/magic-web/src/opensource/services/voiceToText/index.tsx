import { AudioProcessor } from "@/opensource/components/business/VoiceInput/services/AudioProcessor"
import { VoiceClientProxy } from "@/opensource/components/business/VoiceInput/services/VoiceClient/VoiceClientProxy"
import type {
	VoiceInputConfig,
	VoiceInputStatus,
} from "@/opensource/components/business/VoiceInput/types"
import { ChatApi } from "@/opensource/apis"
import { userStore } from "@/opensource/models/user"
import { env } from "@/opensource/utils/env"
import { VoiceResult } from "@/opensource/components/business/VoiceInput/services/VoiceClient/types"
import { createPersistenceStorage } from "./PersistenceManager"
import { logger as Logger } from "@/opensource/utils/log"
import { merge } from "lodash-es"

const DEFAULT_CONFIG: VoiceInputConfig = {
	wsUrl: "wss://openspeech.bytedance.com/api/v3/sauc/bigmodel_async",
	resourceId: "volc.bigasr.sauc.duration",
	authToken: "",
	organizationCode: "",
	apiAppId: "",
	audio: {
		sampleRate: 16000,
		channelCount: 1,
		bitsPerSample: 16,
	},
	request: {
		resultType: "single",
		enableAccelerateText: true,
		accelerateScore: 10,
		enableNonstream: true,
	},
	user: {
		uid: userStore.user.userInfo?.user_id || "",
		app_version: env("MAGIC_APP_VERSION"),
		platform: window.navigator.userAgent,
	},
}

export interface VoiceResultParams {
	/** 识别的文本结果 */
	result: VoiceResult
	/** 录制会话ID */
	recordingId: string
}

export interface AudioChunkParams {
	/** 音频数据分片 */
	audioData: ArrayBuffer
	/** 录制会话ID */
	recordingId: string
	/** 分片序号（可选，用于排序） */
	chunkIndex?: number
}

export interface VoiceToTextOptions {
	/** 语音输入配置 */
	config?: Partial<VoiceInputConfig>
	/** 语音识别结果回调 */
	onResult?: (params: VoiceResultParams) => void
	/** 音频分片回调（录制过程中的音频数据分片） */
	onAudioChunk?: (params: AudioChunkParams) => void
	/** 错误回调 */
	onError?: (error: Error) => void
	/** 状态变化回调 */
	onStatusChange?: (status: VoiceInputStatus) => void
	/** 连接成功回调 */
	onConnect?: () => void
	/** 重试配置 */
	retry?: {
		/** 最大重试次数，默认为3 */
		maxRetries?: number
		/** 重试间隔（毫秒），默认为1000ms */
		retryDelay?: number
		/** 每次重试是否增加延迟，默认为true */
		exponentialBackoff?: boolean
	}
	/** 持久化配置 */
	persistence?: {
		/** 是否启用持久化，默认为true */
		enabled?: boolean
		/** 会话过期时间（毫秒），默认为1小时 */
		sessionTTL?: number
		/** 最大存储的会话数，默认为10 */
		maxSessions?: number
	}
}

export interface RecordingSession {
	/** 录制会话ID */
	recordingId: string
	/** 创建时间戳 */
	createdAt: number
	/** 最后更新时间戳 */
	updatedAt: number
	/** 分片序号 */
	chunkIndex: number
	/** 是否正在录制 */
	isRecording: boolean
	/** 待发送的音频分片队列，用于持久化和恢复 */
	pendingChunks?: ArrayBuffer[]
}

export interface PersistenceStorage {
	/** 保存录制会话 */
	saveSession(session: RecordingSession): Promise<void>

	/** 获取录制会话 */
	getSession(recordingId: string): Promise<RecordingSession | null>

	/** 获取所有录制会话 */
	getAllSessions(): Promise<RecordingSession[]>

	/** 删除录制会话 */
	deleteSession(recordingId: string): Promise<void>

	/** 清理过期会话 */
	cleanExpiredSessions(maxAge: number): Promise<void>

	/** 清理所有会话 */
	clear(): Promise<void>

	/** 添加音频块到待发送队列 (增量操作) */
	appendToPendingChunks?(recordingId: string, chunk: ArrayBuffer): Promise<void>

	/** 清理待发送队列 */
	clearPendingChunks?(recordingId: string): Promise<void>

	/** 获取待发送队列大小 */
	getPendingChunksInfo?(recordingId: string): Promise<{ count: number; totalSize: number }>

	/** 批量获取并清理待发送队列 */
	popPendingChunks?(recordingId: string, count?: number): Promise<ArrayBuffer[]>
}

const logger = Logger.createLogger("VoiceToTextService", {
	enableConfig: { console: true, report: true, error: true, warn: true },
})

/**
 * 语音转文字服务类
 *
 * 基于 useVoiceInput hook 的核心功能实现的简洁服务类，
 * 提供语音录制和转文字功能。
 *
 * @example
 * ```typescript
 * import voiceToTextService from '@/opensource/services/voiceToText'
 *
 * // 初始化服务
 * await voiceToTextService.initialize({
 *   onResult: ({ text, recordingId }) => {
 *     console.log('识别结果:', text, '录制ID:', recordingId)
 *   },
 *   onAudioChunk: ({ audioData, recordingId, chunkIndex }) => {
 *     // 可以将音频分片上传到服务器，使用 recordingId 区分不同录制会话
 *     console.log('音频分片:', audioData.byteLength, 'bytes', '录制ID:', recordingId, '分片序号:', chunkIndex)
 *   },
 *   onError: (error) => console.error('错误:', error),
 *   onStatusChange: (status) => console.log('状态变化:', status)
 * })
 *
 * // 开始录音
 * await voiceToTextService.startRecording()
 *
 * // 停止录音
 * await voiceToTextService.stopRecording()
 *
 * // 切换录音状态
 * await voiceToTextService.toggleRecording()
 * ```
 */
class VoiceToTextService {
	private audioProcessor?: AudioProcessor
	private voiceClient?: VoiceClientProxy
	private status: VoiceInputStatus = "idle"
	private isConnected = false
	private isRecording = false
	private options: VoiceToTextOptions = {}
	private currentRecordingId: string | null = null
	private chunkIndex = 0
	private stopPromise: { resolve: () => void; reject: (error: Error) => void } | null = null

	// Retry mechanism properties
	private retryCount = 0
	private maxRetries = 3
	private retryDelay = 1000
	private exponentialBackoff = true
	private retryTimer: NodeJS.Timeout | null = null
	private isRetrying = false

	// Persistence properties
	private persistenceStorage?: PersistenceStorage
	private persistenceEnabled = true
	private sessionTTL = 60 * 60 * 1000 // 1 hour default
	private maxSessions = 10
	private unsubscribeAudioProcessor: (() => void) | null = null
	private externalAudioStream: MediaStream | null = null

	private visibilityChangeHandler: (() => void) | null = null
	private visibilityReconnectInProgress = false

	private networkStatus: "online" | "offline" = "online"
	private networkOfflineHandler: (() => void) | null = null
	private networkOnlineHandler: (() => void) | null = null
	private shouldReconnectAfterNetwork = false
	private resumeRecordingAfterNetwork = false
	private networkReconnectInProgress = false
	private offlineRecordingState: { recordingId: string | null; chunkIndex: number } | null = null
	// offlineAudioQueue removed - using session pendingChunks instead

	// Page Lifecycle API handlers
	private pageFreezeHandler: (() => void) | null = null
	private pageResumeHandler: (() => void) | null = null
	private pageLifecycleReconnectInProgress = false
	private frozenRecordingState: { recordingId: string | null; chunkIndex: number } | null = null
	private shouldResumeAfterPageResume = false

	// Concurrency control for session operations
	private sessionOperationLock = new Map<string, Promise<void>>()
	private pendingChunksProcessing = false

	constructor(options: VoiceToTextOptions = {}) {
		this.initialize(options)
	}

	/**
	 * Clean up audio processor and its event listeners
	 * 清理音频处理器和其事件监听器
	 */
	private cleanupAudioProcessor(): void {
		// Unsubscribe from audio processor events
		if (this.unsubscribeAudioProcessor) {
			logger.log(this.createLogContext("清理：清理音频处理器事件监听器"))
			this.unsubscribeAudioProcessor()
			this.unsubscribeAudioProcessor = null
		}

		// Stop and cleanup audio processor
		if (this.audioProcessor) {
			this.audioProcessor.stop()
			this.audioProcessor.dispose()
			this.audioProcessor = undefined
		}

		this.externalAudioStream = null
	}

	/**
	 * 检查 Web Worker 支持情况
	 */
	static isWorkerSupported(): boolean {
		return typeof Worker !== "undefined"
	}

	/**
	 * 获取运行环境信息
	 */
	static getEnvironmentInfo(): {
		workerSupported: boolean
		browserInfo: string
		supportLevel: "full" | "limited" | "none"
	} {
		const workerSupported = VoiceToTextService.isWorkerSupported()
		const browserInfo = navigator.userAgent

		let supportLevel: "full" | "limited" | "none" = "none"
		if (workerSupported) {
			// Check for additional features that might be needed
			const hasTransferableObjects =
				typeof ArrayBuffer !== "undefined" &&
				typeof ArrayBuffer.prototype.slice === "function"
			supportLevel = hasTransferableObjects ? "full" : "limited"
		}

		return {
			workerSupported,
			browserInfo,
			supportLevel,
		}
	}

	/**
	 * 初始化语音转文字服务
	 */
	async initialize(options: VoiceToTextOptions = {}) {
		this.options = options

		// Check Web Worker support and log environment info
		const envInfo = VoiceToTextService.getEnvironmentInfo()
		logger.log(
			this.createLogContext("初始化：语音转文字服务环境信息", {
				envInfo,
			}),
		)

		if (!envInfo.workerSupported) {
			logger.error(
				this.createLogContext("初始化失败：不支持Web Workers，语音识别将无法正常工作"),
			)
		} else if (envInfo.supportLevel === "limited") {
			logger.warn(
				this.createLogContext(
					"初始化警告：检测到有限的Web Worker支持，部分功能可能无法工作",
				),
			)
		}

		// Initialize retry configuration
		if (options.retry) {
			this.maxRetries = options.retry.maxRetries ?? 3
			this.retryDelay = options.retry.retryDelay ?? 1000
			this.exponentialBackoff = options.retry.exponentialBackoff ?? true
		}

		// Initialize persistence configuration
		if (options.persistence) {
			this.persistenceEnabled = options.persistence.enabled ?? true
			this.sessionTTL = options.persistence.sessionTTL ?? 60 * 60 * 1000
			this.maxSessions = options.persistence.maxSessions ?? 10
		}

		// Initialize persistence storage
		if (this.persistenceEnabled) {
			try {
				this.persistenceStorage = createPersistenceStorage()
				// Clean expired sessions on initialization
				await this.cleanExpiredSessions()
				logger.log(this.createLogContext("初始化：持久化存储初始化成功"))
			} catch (error) {
				logger.warn(
					this.createLogContext("初始化警告：持久化存储初始化失败", {
						error: String(error),
					}),
				)
				this.persistenceEnabled = false
			}
		}

		await this.initializeClients()
	}

	/**
	 * 开始录音并进行语音识别
	 * @param recordingId - 可选的录制ID，用于恢复之前的会话
	 */
	async startRecording(options?: { recordingId?: string; mediaStream?: MediaStream }) {
		if (this.networkStatus === "offline") {
			const error = new Error("Network is offline. Unable to start recording")
			logger.error(this.createLogContext("开始录音失败：网络离线，无法开始录音"))
			this.options.onError?.(error)
			throw error
		}

		if (this.isRecording) {
			logger.warn(this.createLogContext("开始录音：已在录音中，忽略重复请求"))
			return
		}

		this.updateStatus("connecting")

		await this.initializeClients()

		// 确保已连接
		if (!this.isConnected) {
			await this.connect(options?.recordingId ?? undefined)
		}

		// Setup network, visibility change, and page lifecycle handlers when starting recording
		this.setupNetworkListeners()
		this.setupVisibilityChangeHandler()
		this.setupPageLifecycleHandlers()

		let restoredSession: RecordingSession | null = null
		const recordingId = options?.recordingId
		if (options?.mediaStream) {
			this.externalAudioStream = options.mediaStream
		} else {
			this.externalAudioStream = null
		}

		// 尝试恢复现有会话或创建新会话
		if (recordingId && this.persistenceEnabled && this.persistenceStorage) {
			try {
				restoredSession = await this.restoreSession(recordingId)
			} catch (error) {
				logger.warn(
					this.createLogContext("开始录音：恢复会话失败，创建新会话", {
						error: String(error),
						recordingId,
					}),
				)
			}
		}

		if (restoredSession) {
			// 恢复现有会话
			this.currentRecordingId = restoredSession.recordingId
			this.chunkIndex = restoredSession.chunkIndex
			logger.log(
				this.createLogContext("开始录音：从会话恢复录音", {
					restoredRecordingId: restoredSession.recordingId,
					restoredChunkIndex: restoredSession.chunkIndex,
				}),
			)
		} else {
			// 创建新的录制会话
			this.currentRecordingId = recordingId || this.generateRecordingId()
			this.chunkIndex = 0
			// Ensure session exists before starting
			await this.getOrCreateCurrentSession()
			logger.log(this.createLogContext("开始录音：创建新的录制会话"))
		}

		// Queue state management is now handled in Worker
		this.updateStatus("recording")

		if (!this.audioProcessor?.isRecording) {
			try {
				await this.audioProcessor?.start(this.externalAudioStream ?? undefined)
			} catch (error) {
				logger.error(
					this.createLogContext("开始录音失败：启动音频处理器失败", {
						error: String(error),
					}),
				)
				throw error
			}
		}

		this.isRecording = true

		// 保存当前会话状态
		await this.saveCurrentSession()

		// Process any pending chunks from the session
		await this.processPendingChunks()

		// 上报开始录音事件
		logger.report(this.createLogContext("开始录音：录音已启动"))

		// 启动 Worker 队列发送模式（如果连接已建立）
		if (this.isConnected) {
			logger.log(this.createLogContext("开始录音：连接已就绪，启动发送模式"))
			try {
				await this.voiceClient?.startSending()
				logger.log(this.createLogContext("开始录音：发送模式启动成功"))
			} catch (error) {
				logger.error(
					this.createLogContext("开始录音失败：启动发送模式失败", {
						error: String(error),
					}),
				)
			}
		}
	}

	/**
	 * 停止录音
	 */
	async stopRecording(): Promise<void> {
		if (!this.isRecording) {
			logger.warn(this.createLogContext("停止录音：未在录音中，忽略停止请求"))
			return
		}

		this.updateStatus("processing")
		this.audioProcessor?.stop()

		// 更新会话状态
		await this.saveCurrentSession()

		// 等待队列发送完成后再结束
		// Create a promise to wait for completion
		return new Promise<void>((resolve, reject) => {
			// Set up timeout to prevent hanging indefinitely
			const timeout = setTimeout(() => {
				logger.error(this.createLogContext("停止录音失败：10秒超时，强制停止"))
				this.stopPromise = null
				reject(new Error("Stop recording timeout after 10 seconds"))
			}, 10000)

			this.stopPromise = {
				resolve: () => {
					clearTimeout(timeout)
					resolve()
				},
				reject: (error: Error) => {
					clearTimeout(timeout)
					reject(error)
				},
			}

			// 使用 Worker 的停止发送功能
			this.voiceClient
				?.stopSending()
				.then(() => {
					logger.log(this.createLogContext("停止录音：录音已停止"))
					this.isRecording = false
					this.updateStatus("idle")
					void this.logPendingChunksSnapshot("停止录音：退出时待发送队列快照")
					// Teardown network, visibility change, and page lifecycle handlers when recording stops
					this.teardownNetworkListeners()
					this.teardownVisibilityChangeHandler()
					this.teardownPageLifecycleHandlers()
					// 上报停止录音事件
					logger.report(this.createLogContext("停止录音：录音已停止"))
					resolve()
				})
				.catch((error) => {
					logger.error(
						this.createLogContext("停止录音失败：停止发送失败", {
							error: String(error),
						}),
					)
					void this.logErrorWithPendingSnapshot("停止录音失败：停止发送失败", error)
					reject(error)
				})
		})
	}

	/**
	 * Switch audio source during recording
	 * 录制期间切换音频源
	 *
	 * @param newMediaStream - The new audio stream to use
	 */
	async switchAudioSource(newMediaStream: MediaStream): Promise<void> {
		if (!this.isRecording) {
			logger.warn(this.createLogContext("切换音频源失败：未在录音中，无法切换"))
			throw new Error("Cannot switch audio source when not recording")
		}

		if (!this.audioProcessor) {
			logger.error(this.createLogContext("切换音频源失败：音频处理器未初始化"))
			throw new Error("Audio processor not initialized")
		}

		try {
			logger.log(this.createLogContext("切换音频源：正在切换音频源"))

			// Update external audio stream
			this.externalAudioStream = newMediaStream

			// Stop current audio processor
			await this.audioProcessor.stop()

			// Start audio processor with new stream
			await this.audioProcessor.start(newMediaStream)

			logger.log(this.createLogContext("切换音频源：音频源切换成功"))
		} catch (error) {
			logger.error(
				this.createLogContext("切换音频源失败：切换音频源失败", {
					error: String(error),
				}),
			)
			throw error
		}
	}

	/**
	 * Wait for worker to be ready
	 */
	async waitForWorkerReady(timeout: number = 10000): Promise<void> {
		if (!this.voiceClient) {
			const error = new Error("VoiceClient not initialized")
			logger.error(this.createLogContext("Worker错误：语音客户端未初始化"))
			throw error
		}

		return new Promise((resolve, reject) => {
			const timeoutId = setTimeout(() => {
				logger.error(this.createLogContext("Worker错误：等待Worker就绪超时（10秒）"))
				reject(new Error("Timeout waiting for worker to be ready"))
			}, timeout)

			// Poll for worker ready state
			const checkReady = () => {
				if ((this.voiceClient as unknown as { workerReady?: boolean })?.workerReady) {
					clearTimeout(timeoutId)
					clearInterval(intervalId)
					resolve()
				}
			}

			const intervalId = setInterval(checkReady, 100)
			checkReady() // Check immediately
		})
	}

	/**
	 * 连接语音服务
	 */
	async connect(recordingId?: string) {
		if (this.networkStatus === "offline") {
			logger.warn(this.createLogContext("连接失败：网络离线，跳过连接"))
			throw new Error("Network offline")
		}

		if (this.isConnected) {
			logger.log(this.createLogContext("连接：已连接，跳过"))
			return
		}

		try {
			await this.waitForWorkerReady()
			// 将 recordingId 透传给 Worker，保持重连时的连接ID一致
			await this.voiceClient?.connect(recordingId ?? this.currentRecordingId ?? undefined)
			this.resetRetryState()
			this.options.onConnect?.()
		} catch (error) {
			this.isRetrying = false
			logger.error(this.createLogContext("连接失败：连接失败", { error: String(error) }))
			this.handleError(error as Error)
		}
	}

	/**
	 * 断开连接
	 */
	disconnect() {
		if (!this.isConnected && !this.voiceClient) {
			logger.warn(this.createLogContext("断开连接：已断开连接"))
			return
		}

		logger.log(this.createLogContext("断开连接：正在断开语音服务"))
		this.voiceClient?.disconnect()

		// Clean up audio processor and event listeners
		this.cleanupAudioProcessor()
		this.isConnected = false
		this.isRecording = false
		// Queue management now handled in Worker
		this.resetRecordingId()
		this.resetRetryState() // Clean up retry state when disconnecting

		// Clean up network, visibility change, and page lifecycle handlers
		this.teardownNetworkListeners()
		this.teardownVisibilityChangeHandler()
		this.teardownPageLifecycleHandlers()

		// Reject pending stop promise if it exists
		if (this.stopPromise) {
			this.stopPromise.reject(new Error("Connection disconnected"))
			this.stopPromise = null
		}

		this.updateStatus("idle")
		void this.logPendingChunksSnapshot("断开连接：退出时待发送队列快照")
	}

	/**
	 * 销毁服务并清理所有资源（包括 Web Worker）
	 */
	dispose() {
		logger.log(this.createLogContext("销毁：正在销毁语音转文字服务并清理Web Worker资源"))
		this.teardownVisibilityChangeHandler()
		this.teardownNetworkListeners()
		this.teardownPageLifecycleHandlers()

		// Disconnect first
		this.disconnect()

		// Dispose Web Worker VoiceClient
		if (this.voiceClient) {
			this.voiceClient.dispose()
			this.voiceClient = undefined
		}

		// Clean up audio processor and event listeners
		this.cleanupAudioProcessor()

		// Clean up persistence storage
		if (
			this.persistenceStorage &&
			"close" in this.persistenceStorage &&
			typeof this.persistenceStorage.close === "function"
		) {
			this.persistenceStorage.close()
		}
		this.persistenceStorage = undefined

		// Reset all state
		this.options = {}
		this.status = "idle"
		this.isConnected = false
		this.isRecording = false
		this.resetRetryState()
		this.currentRecordingId = null
		this.persistenceEnabled = true

		// Clear concurrency control state
		this.sessionOperationLock.clear()
		this.pendingChunksProcessing = false

		// Clear page lifecycle state
		this.pageLifecycleReconnectInProgress = false
		this.frozenRecordingState = null
		this.shouldResumeAfterPageResume = false

		logger.log(this.createLogContext("销毁：语音转文字服务销毁成功"))
		void this.logPendingChunksSnapshot("销毁：销毁时待发送队列快照")
	}

	/**
	 * 获取当前状态
	 */
	getStatus(): VoiceInputStatus {
		return this.status
	}

	/**
	 * 是否正在录音
	 */
	getIsRecording(): boolean {
		return this.status === "recording"
	}

	/**
	 * 是否已连接
	 */
	getIsConnected(): boolean {
		return this.isConnected
	}

	/**
	 * 获取当前录制ID
	 */
	getCurrentRecordingId(): string | null {
		return this.currentRecordingId
	}

	/**
	 * 获取重试状态信息
	 */
	getRetryInfo() {
		return {
			isRetrying: this.isRetrying,
			retryCount: this.retryCount,
			maxRetries: this.maxRetries,
			hasExceededRetries: this.retryCount >= this.maxRetries,
		}
	}

	/**
	 * Get Page Lifecycle state information
	 * 获取页面生命周期状态信息
	 */
	getPageLifecycleInfo() {
		return {
			isResumeInProgress: this.pageLifecycleReconnectInProgress,
			shouldResumeAfterWake: this.shouldResumeAfterPageResume,
			hasFrozenState: this.frozenRecordingState !== null,
			frozenRecordingId: this.frozenRecordingState?.recordingId || null,
		}
	}

	/**
	 * 创建结构化日志上下文
	 * Create structured log context
	 */
	private createLogContext(message: string, extra?: Record<string, unknown>) {
		return {
			message,
			recordingId: this.currentRecordingId,
			chunkIndex: this.chunkIndex,
			status: this.status,
			isRecording: this.isRecording,
			isConnected: this.isConnected,
			networkStatus: this.networkStatus,
			retryCount: this.retryCount,
			...extra,
		}
	}

	private async getPendingChunksSnapshot(): Promise<{
		count: number
		totalSize: number
	}> {
		if (!this.persistenceStorage || !this.currentRecordingId) {
			return { count: 0, totalSize: 0 }
		}

		if (this.persistenceStorage.getPendingChunksInfo) {
			try {
				return await this.persistenceStorage.getPendingChunksInfo(this.currentRecordingId)
			} catch {
				return { count: 0, totalSize: 0 }
			}
		}

		try {
			const session = await this.persistenceStorage.getSession(this.currentRecordingId)
			const buffers = session?.pendingChunks || []
			const totalSize = buffers.reduce((sum, buf) => sum + buf.byteLength, 0)
			return { count: buffers.length, totalSize }
		} catch {
			return { count: 0, totalSize: 0 }
		}
	}

	private async logPendingChunksSnapshot(
		message: string,
		extra?: Record<string, unknown>,
	): Promise<void> {
		const snapshot = await this.getPendingChunksSnapshot()
		logger.report(
			this.createLogContext(message, {
				pendingChunksCount: snapshot.count,
				pendingChunksSize: snapshot.totalSize,
				...extra,
			}),
		)
	}

	private async logErrorWithPendingSnapshot(
		message: string,
		error: unknown,
		extra?: Record<string, unknown>,
	): Promise<void> {
		const reason = error instanceof Error ? error.message : String(error)
		await this.logPendingChunksSnapshot(message, { error: reason, ...extra })
	}

	/**
	 * 生成唯一的录制ID
	 */
	private generateRecordingId(): string {
		return `recording_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
	}

	/**
	 * Get or create current recording session
	 * 获取或创建当前录制会话
	 */
	private async getOrCreateCurrentSession(): Promise<RecordingSession> {
		if (!this.currentRecordingId) {
			this.currentRecordingId = this.generateRecordingId()
			this.chunkIndex = 0
		}

		if (!this.persistenceEnabled || !this.persistenceStorage) {
			// Return a minimal session object if persistence is disabled
			return {
				recordingId: this.currentRecordingId,
				createdAt: Date.now(),
				updatedAt: Date.now(),
				chunkIndex: this.chunkIndex,
				isRecording: this.isRecording,
				pendingChunks: [],
			}
		}

		let session = await this.persistenceStorage.getSession(this.currentRecordingId)
		if (!session) {
			session = {
				recordingId: this.currentRecordingId,
				createdAt: Date.now(),
				updatedAt: Date.now(),
				chunkIndex: this.chunkIndex,
				isRecording: this.isRecording,
				pendingChunks: [],
			}
			await this.persistenceStorage.saveSession(session)
		}

		// Ensure pendingChunks is initialized
		if (!session.pendingChunks) {
			session.pendingChunks = []
		}

		return session
	}

	/**
	 * Add audio data to pending chunks with size management
	 * 添加音频数据到待发送队列并管理大小
	 */
	private async addToPendingChunks(audioData: ArrayBuffer, reason?: string): Promise<void> {
		if (!this.currentRecordingId) {
			// Create a session if none exists
			await this.getOrCreateCurrentSession()
		}

		if (!this.persistenceEnabled || !this.persistenceStorage || !this.currentRecordingId) {
			// If persistence is disabled or no session, we can't store pending chunks
			return
		}

		// Ensure thread-safe operation using session lock
		const recordingId = this.currentRecordingId
		const existingLock = this.sessionOperationLock.get(recordingId)
		const reasonTag = reason || "unknown"

		const operation = async () => {
			// Wait for any existing operation to complete
			if (existingLock) {
				await existingLock
			}

			// Use the incremental append method if available
			if (this.persistenceStorage?.appendToPendingChunks) {
				try {
					await this.persistenceStorage.appendToPendingChunks(recordingId, audioData)
				} catch (error) {
					if ((error as Error).message?.includes("size limit exceeded")) {
						// Size limit exceeded, try to process existing chunks first
						logger.warn(
							this.createLogContext("待发送队列警告：存储大小限制超出，正在处理分片"),
						)
						await this.processPendingChunks()
						// Try again after clearing
						try {
							await this.persistenceStorage.appendToPendingChunks(
								recordingId,
								audioData,
							)
						} catch (retryError) {
							logger.error(
								this.createLogContext("待发送队列错误：清理后追加失败", {
									error: String(retryError),
									reason: reasonTag,
									chunkSize: audioData.byteLength,
									chunkIndex: this.chunkIndex,
								}),
							)
							throw retryError
						}
					} else {
						throw error
					}
				}
			} else if (this.persistenceStorage) {
				// Fallback to full session update
				const session = await this.getOrCreateCurrentSession()
				session.pendingChunks = session.pendingChunks || []
				session.pendingChunks.push(audioData)
				session.updatedAt = Date.now()
				await this.persistenceStorage.saveSession(session)
			}
		}

		// Set the lock and execute
		const lockPromise = operation().finally(() => {
			// Remove lock when done
			if (this.sessionOperationLock.get(recordingId) === lockPromise) {
				this.sessionOperationLock.delete(recordingId)
			}
		})

		this.sessionOperationLock.set(recordingId, lockPromise)
		await lockPromise
	}

	/**
	 * Process and send pending chunks from session
	 * 处理并发送会话中的待发送音频块
	 */
	private async processPendingChunks(): Promise<void> {
		if (!this.currentRecordingId || !this.persistenceStorage) {
			return
		}

		// Prevent concurrent processing
		if (this.pendingChunksProcessing) {
			return
		}

		this.pendingChunksProcessing = true

		try {
			// Use the batch pop method if available
			if (this.persistenceStorage.popPendingChunks) {
				const chunks = await this.persistenceStorage.popPendingChunks(
					this.currentRecordingId,
				)
				if (chunks.length > 0) {
					await this.voiceClient?.batchQueueAudio(chunks)
					logger.log(
						this.createLogContext("处理待发送队列：已处理会话中的待发送分片", {
							chunkCount: chunks.length,
						}),
					)
					await this.logPendingChunksSnapshot("处理待发送队列：已处理分片", {
						chunkCount: chunks.length,
					})
				} else {
					logger.log(this.createLogContext("处理待发送队列：触发但无待发送分片"))
				}
			} else {
				// Fallback to full session update
				const session = await this.persistenceStorage.getSession(this.currentRecordingId)
				if (session?.pendingChunks && session.pendingChunks.length > 0) {
					const chunks = session.pendingChunks
					await this.voiceClient?.batchQueueAudio(chunks)

					// Clear pending chunks after sending
					session.pendingChunks = []
					session.updatedAt = Date.now()
					await this.persistenceStorage.saveSession(session)

					logger.log(
						this.createLogContext("处理待发送队列：已处理会话中的待发送分片", {
							chunkCount: chunks.length,
						}),
					)
					await this.logPendingChunksSnapshot("处理待发送队列：已处理分片", {
						chunkCount: chunks.length,
					})
				} else {
					logger.log(this.createLogContext("处理待发送队列：触发但无待发送分片"))
				}
			}
		} catch (error) {
			logger.error(
				this.createLogContext("处理待发送队列错误：处理待发送分片失败", {
					error: String(error),
				}),
			)
			void this.logErrorWithPendingSnapshot("处理待发送队列错误：处理失败", error)
		} finally {
			this.pendingChunksProcessing = false
		}
	}

	/**
	 * 清除当前录制ID
	 */
	private clearRecordingId(): void {
		this.currentRecordingId = null
		this.chunkIndex = 0
	}

	/**
	 * 重置录制ID（错误或断开连接时调用）
	 */
	private resetRecordingId(): void {
		// 幂等：若已为空则不再处理，避免重复日志
		if (!this.currentRecordingId) return
		if (this.isRecording) {
			logger.log(
				"Recording ID reset due to connection issue",
				`Previous ID: ${this.currentRecordingId}`,
			)
		}
		this.clearRecordingId()
	}

	private async initializeClients() {
		const config = merge(DEFAULT_CONFIG, this.options.config)

		// Clean up existing audio processor before creating a new one
		this.cleanupAudioProcessor()

		if (!this.audioProcessor) {
			// 初始化音频处理器
			this.audioProcessor = new AudioProcessor(config.audio)

			// Expose audioProcessor for debugging purposes
			;(window as typeof window & { audioProcessor?: AudioProcessor }).audioProcessor =
				this.audioProcessor

			this.unsubscribeAudioProcessor = this.audioProcessor.on("data", (audioData) => {
				// 提供音频分片给业务层（用于上传等场景）
				if (this.currentRecordingId) {
					this.options.onAudioChunk?.({
						audioData,
						recordingId: this.currentRecordingId,
						chunkIndex: this.chunkIndex++,
					})
				}

				// Smart storage strategy: Only store to pendingChunks when necessary
				const canSendImmediately =
					this.isRecording && this.isConnected && this.networkStatus === "online"

				if (canSendImmediately) {
					// Send directly to Worker queue when actively recording and connected
					try {
						this.voiceClient?.queueAudio(audioData)
					} catch (error) {
						logger.error(
							this.createLogContext("发送分片失败：队列入队异常", {
								error: String(error),
								chunkIndex: this.chunkIndex,
								chunkSize: audioData.byteLength,
							}),
						)
						void this.logErrorWithPendingSnapshot("发送分片失败：队列入队异常", error, {
							chunkIndex: this.chunkIndex,
							chunkSize: audioData.byteLength,
						})
						// fallback to pending
						this.addToPendingChunks(audioData, "queue_fail").catch((err) => {
							logger.error(
								this.createLogContext("待发送队列错误：入队失败后回落存储失败", {
									error: String(err),
								}),
							)
						})
					}
				} else {
					// Store to pendingChunks when:
					// - Not recording yet (audio processor started but recording not begun)
					// - Not connected (connection issues)
					// - Network is offline
					// This prevents accumulation of successfully sent chunks
					const reason = !this.isRecording
						? "not_recording"
						: !this.isConnected
							? "not_connected"
							: this.networkStatus === "offline"
								? "network_offline"
								: "unknown"

					this.addToPendingChunks(audioData, reason).catch((error) => {
						logger.error(
							this.createLogContext("待发送队列错误：添加音频分片到待发送队列失败", {
								reason,
								error: String(error),
								chunkSize: audioData.byteLength,
								chunkIndex: this.chunkIndex,
							}),
						)
					})
					// Removed high-frequency log: Audio chunk stored (too verbose)
				}
			})
		}

		// 如果已经初始化过语音客户端，则不重复初始化
		if (this.voiceClient) return

		// 初始化语音客户端 (Web Worker 版本)
		try {
			logger.log(this.createLogContext("初始化：正在初始化Web Worker语音客户端用于后台操作"))
			this.voiceClient = new VoiceClientProxy(() => this.refreshToken())
			this.bindVoiceClientEvents()
		} catch (error) {
			logger.error(
				this.createLogContext("初始化失败：初始化Web Worker语音客户端失败", {
					error: String(error),
				}),
			)
			throw new Error(
				`Web Worker VoiceClient initialization failed: ${(error as Error).message}`,
			)
		}
	}

	private async refreshToken() {
		try {
			const data = await ChatApi.getVoiceInputToken({ refresh: true })
			if (data?.token) {
				const config = merge(DEFAULT_CONFIG, this.options.config)
				config.authToken = data.token
				config.apiAppId = data.app_id
				config.organizationCode = data.user?.organization_code
				return config
			} else {
				logger.warn(this.createLogContext("Token警告：刷新Token返回空，使用默认配置"))
			}
		} catch (error) {
			logger.error(
				this.createLogContext("Token错误：刷新Token失败", {
					error: String(error),
				}),
			)
		}
		return merge(DEFAULT_CONFIG, this.options.config)
	}

	private bindVoiceClientEvents() {
		if (!this.voiceClient) return

		this.voiceClient.on("open", async () => {
			this.isConnected = true
			// 保存重试状态，因为 resetRetryState() 会重置它
			const wasRetrying = this.isRetrying
			this.resetRetryState() // Reset retry state on successful connection
			logger.log(this.createLogContext("连接成功：语音客户端已连接"))
			// 上报连接成功事件
			logger.report(this.createLogContext("连接成功：语音客户端已连接"))

			// 如果正在录制，启动 Worker 队列发送
			if (this.isRecording) {
				try {
					// 只在重试场景中处理缓存的音频块
					// 其他场景（网络恢复、页面恢复）会在各自的处理函数中调用 processPendingChunks()
					if (wasRetrying) {
						await this.processPendingChunks()
					}

					// 然后启动发送模式
					await this.voiceClient?.startSending()

					logger.log(this.createLogContext("重连后恢复：已启动音频发送模式"))
				} catch (error) {
					logger.error(this.createLogContext("连接失败：启动发送模式失败", { error }))
				}
			}
		})

		this.voiceClient.on("close", () => {
			this.isConnected = false

			const wasRecordingAtClose = this.status === "recording" || this.isRecording
			// 当页面冻结/网络恢复流程需要自动恢复时，不要清空录音状态和录制ID
			let shouldPreserveRecording =
				this.shouldResumeAfterPageResume ||
				this.resumeRecordingAfterNetwork ||
				this.pageLifecycleReconnectInProgress ||
				this.networkReconnectInProgress

			// 追加保护：若在录制中且非预期关闭（无停止流程），推断需在恢复后继续
			if (!shouldPreserveRecording && wasRecordingAtClose && !this.stopPromise) {
				this.shouldResumeAfterPageResume = true
				shouldPreserveRecording = true
				logger.log(this.createLogContext("连接关闭：推断录制中断，标记为恢复后继续"))
			}

			if (!this.isRetrying && !shouldPreserveRecording) {
				this.isRecording = false
			}

			// Queue management now handled in Worker

			// Clean up network, visibility change, and page lifecycle handlers when connection closes unexpectedly
			this.teardownNetworkListeners()
			this.teardownVisibilityChangeHandler()
			this.teardownPageLifecycleHandlers()

			// Reject pending stop promise if it exists
			if (this.stopPromise) {
				this.stopPromise.reject(new Error("Voice client connection closed"))
				this.stopPromise = null
			}

			// 仅在不需要恢复时重置录制ID，避免中断恢复流程
			if (this.currentRecordingId && !shouldPreserveRecording) this.resetRecordingId()
		})

		this.voiceClient.on("result", (result) => {
			if (this.currentRecordingId) {
				this.options.onResult?.({
					result: result,
					recordingId: this.currentRecordingId,
				})
			}
		})

		this.voiceClient.on("error", (message, code) => {
			// Enhanced error handling for Web Worker specific errors
			let error = new Error(message)

			// Add error codes for better error identification
			if (code) {
				Object.assign(error, { code })
			}

			// Handle Worker-specific error types
			if (typeof code === "string") {
				switch (code) {
					case "WORKER_ERROR":
						logger.error(
							this.createLogContext("Worker错误：Web Worker内部错误", {
								error: message,
								code,
							}),
						)
						error = new Error(`Web Worker error: ${message}`)
						break
					case "WORKER_MESSAGE_ERROR":
						logger.error(
							this.createLogContext("Worker错误：Web Worker消息通信错误", {
								error: message,
								code,
							}),
						)
						error = new Error(`Web Worker communication error: ${message}`)
						break
					case "CONNECTION_ERROR":
						logger.error(
							this.createLogContext("Worker错误：Web Worker连接错误", {
								error: message,
								code,
							}),
						)
						break
					default:
						logger.error(
							this.createLogContext("Worker错误：Web Worker语音客户端错误", {
								error: message,
								code,
							}),
						)
				}
			}

			this.handleError(error)
		})

		this.voiceClient.on("status", (_, state) => {
			switch (state) {
				case "connecting":
					this.isConnected = false
					this.updateStatus("connecting")
					break
				case "connected":
					this.isConnected = true
					this.updateStatus("recording")
					break
				case "error":
					this.isConnected = false
					this.updateStatus("error")
					break
				case "stop":
					this.isConnected = false
					this.updateStatus("idle")
					break
			}
		})
	}

	private updateStatus(newStatus: VoiceInputStatus) {
		// 幂等：状态未变化则不触发回调
		if (this.status === newStatus) return
		this.status = newStatus
		this.options.onStatusChange?.(newStatus)
	}

	private handleError(error: Error) {
		console.trace("handleError", error)
		void this.logErrorWithPendingSnapshot("错误捕获：记录待发送队列快照", error)
		// 若已处于安全的错误态且无录制会话，忽略重复错误，避免日志洪泛
		if (
			this.status === "error" &&
			!this.isRecording &&
			!this.isConnected &&
			!this.currentRecordingId &&
			!this.isRetrying
		)
			return

		// 检查是否是不可重试的错误(如权限拒绝)
		if (this.isNonRetryableError(error)) {
			logger.error(
				this.createLogContext("错误：遇到不可重试的错误", {
					error: String(error),
					errorName: error.name,
					errorMessage: error.message,
				}),
			)
			this.handleFinalError(error)
			return
		}

		if (this.networkStatus === "offline") {
			logger.warn(this.createLogContext("错误：网络离线，延迟错误处理到网络恢复流程"))
			if (this.isRecording) this.resumeRecordingAfterNetwork = true
			if (this.isConnected || this.status === "connecting" || this.isRetrying)
				this.shouldReconnectAfterNetwork = true
			return
		}

		logger.error(
			this.createLogContext("错误：语音转文字服务错误", {
				error: String(error),
				errorName: error.name,
				errorMessage: error.message,
				retryCount: this.retryCount,
				maxRetries: this.maxRetries,
			}),
		)

		// Try to retry if we haven't exceeded the max retry count
		if (this.retryCount < this.maxRetries && !this.isRetrying) {
			this.attemptRetry()
			return
		}

		// Max retries exceeded, handle as final error
		this.handleFinalError(error)
	}

	/**
	 * Check if an error is non-retryable (like permission errors)
	 * 检查错误是否为不可重试的错误（如权限错误）
	 */
	private isNonRetryableError(error: Error): boolean {
		// 权限相关错误 - 用户拒绝麦克风权限
		if (error.name === "NotAllowedError" || error.name === "PermissionDeniedError") {
			return true
		}

		// 没有麦克风设备
		if (error.name === "NotFoundError" || error.name === "DevicesNotFoundError") {
			return true
		}

		// 安全上下文错误 (非HTTPS环境)
		if (error.name === "NotSupportedError" && error.message?.includes("secure")) {
			return true
		}

		// 检查错误消息中的权限相关关键词
		const errorMessage = error.message?.toLowerCase() || ""
		if (
			errorMessage.includes("permission denied") ||
			errorMessage.includes("permission dismissed") ||
			errorMessage.includes("user denied") ||
			errorMessage.includes("not allowed") ||
			errorMessage.includes("no device found") ||
			errorMessage.includes("requested device not found")
		) {
			return true
		}

		return false
	}

	/**
	 * Attempt to retry the connection
	 * 尝试重试连接
	 */
	private attemptRetry() {
		if (this.networkStatus === "offline") {
			logger.warn(this.createLogContext("重试：网络离线，延迟重试直到连接恢复"))
			if (this.isRecording) this.resumeRecordingAfterNetwork = true
			if (this.isConnected || this.status === "connecting" || this.isRetrying)
				this.shouldReconnectAfterNetwork = true
			return
		}

		this.isRetrying = true
		this.retryCount++

		// Calculate retry delay with exponential backoff if enabled
		const delay = this.exponentialBackoff
			? this.retryDelay * Math.pow(2, this.retryCount - 1)
			: this.retryDelay

		logger.log(
			this.createLogContext(`重试连接：第 ${this.retryCount}/${this.maxRetries} 次重试`, {
				delay,
			}),
		)
		// 上报重试事件
		logger.report(
			this.createLogContext(`重试连接：第 ${this.retryCount}/${this.maxRetries} 次重试`, {
				delay,
			}),
		)
		this.updateStatus("connecting")

		// Clear existing connections
		this.voiceClient?.disconnect()
		this.isConnected = false
		// Queue state preserved in Worker for retry

		// Clear any pending stop promise during retry
		if (this.stopPromise) {
			this.stopPromise.reject(new Error("Connection retry in progress"))
			this.stopPromise = null
		}

		// Set retry timer
		this.retryTimer = setTimeout(() => {
			this.connect()
		}, delay)
	}

	/**
	 * Handle final error when retries are exhausted
	 * 处理重试耗尽后的最终错误
	 */
	private handleFinalError(error: Error) {
		logger.error(
			this.createLogContext("错误：重试耗尽后的最终错误", {
				error: String(error),
				errorName: error.name,
				errorMessage: error.message,
				retryCount: this.retryCount,
				maxRetries: this.maxRetries,
			}),
		)
		void this.logErrorWithPendingSnapshot("错误：重试耗尽后的最终错误", error, {
			wasRecording: this.isRecording,
		})

		// Clean up everything
		this.voiceClient?.disconnect()
		this.isConnected = false

		// Clean up audio processor and event listeners (regardless of recording state)
		// PS: 连接断开时，音频处理器应该继续收集
		// this.cleanupAudioProcessor()
		this.isRecording = false
		// Queue management now handled in Worker
		this.clearRetryTimer()
		this.isRetrying = false

		// Clean up network, visibility change, and page lifecycle handlers when error occurs
		this.teardownNetworkListeners()
		this.teardownVisibilityChangeHandler()
		this.teardownPageLifecycleHandlers()

		// Reject pending stop promise if it exists
		if (this.stopPromise) {
			this.stopPromise.reject(error)
			this.stopPromise = null
		}

		if (this.currentRecordingId) this.resetRecordingId()
		this.updateStatus("error")

		// Pass error to callback with retry context
		const errorWithContext = new Error(
			`${error.message} (failed after ${this.retryCount} retries)`,
		)
		errorWithContext.stack = error.stack
		this.options.onError?.(errorWithContext)
	}

	/**
	 * Clear retry timer
	 * 清除重试定时器
	 */
	private clearRetryTimer() {
		if (this.retryTimer) {
			clearTimeout(this.retryTimer)
			this.retryTimer = null
		}
	}

	/**
	 * Reset retry state
	 * 重置重试状态
	 */
	private resetRetryState() {
		this.retryCount = 0
		this.isRetrying = false
		this.clearRetryTimer()
	}

	private setupVisibilityChangeHandler(): void {
		if (typeof document === "undefined") return
		if (typeof document.addEventListener !== "function") return
		if (this.visibilityChangeHandler) return

		const handler = () => this.handleVisibilityRestore()
		document.addEventListener("visibilitychange", handler)
		this.visibilityChangeHandler = handler
	}

	private teardownVisibilityChangeHandler(): void {
		if (typeof document === "undefined") return
		if (!this.visibilityChangeHandler) return
		document.removeEventListener("visibilitychange", this.visibilityChangeHandler)
		this.visibilityChangeHandler = null
	}

	/**
	 * Setup Page Lifecycle API event handlers
	 * 设置页面生命周期 API 事件处理器
	 */
	private setupPageLifecycleHandlers(): void {
		if (typeof document === "undefined") return
		if (typeof document.addEventListener !== "function") return
		if (this.pageFreezeHandler || this.pageResumeHandler) return

		const freezeHandler = () => this.handlePageFreeze()
		const resumeHandler = () => this.handlePageResume()

		document.addEventListener("freeze", freezeHandler)
		document.addEventListener("resume", resumeHandler)

		this.pageFreezeHandler = freezeHandler
		this.pageResumeHandler = resumeHandler
	}

	/**
	 * Teardown Page Lifecycle API event handlers
	 * 清理页面生命周期 API 事件处理器
	 */
	private teardownPageLifecycleHandlers(): void {
		if (typeof document === "undefined") return

		if (this.pageFreezeHandler) {
			document.removeEventListener("freeze", this.pageFreezeHandler)
			this.pageFreezeHandler = null
		}

		if (this.pageResumeHandler) {
			document.removeEventListener("resume", this.pageResumeHandler)
			this.pageResumeHandler = null
		}
	}

	/**
	 * Handle page freeze event (system going to sleep/hibernation)
	 * 处理页面冻结事件（系统即将休眠/休眠）
	 */
	private handlePageFreeze(): void {
		logger.warn(this.createLogContext("页面冻结：页面已冻结，系统即将休眠，保存状态"))
		logger.report(
			this.createLogContext("页面冻结：上报状态切换", {
				event: "page_freeze",
			}),
		)

		// 判断是否正在录制：在网络断开后 status/isRecording 可能已被置为非录制状态
		const wasRecording =
			this.status === "recording" ||
			this.isRecording ||
			this.resumeRecordingAfterNetwork ||
			Boolean(this.offlineRecordingState?.recordingId)

		if (wasRecording) {
			this.shouldResumeAfterPageResume = true
			// 优先使用当前录制ID，其次使用离线记录或已保存的冻结状态
			const recordingIdToSave =
				this.currentRecordingId ??
				this.offlineRecordingState?.recordingId ??
				this.frozenRecordingState?.recordingId ??
				null
			const chunkIndexToSave =
				this.chunkIndex ??
				this.offlineRecordingState?.chunkIndex ??
				this.frozenRecordingState?.chunkIndex ??
				0

			if (recordingIdToSave) {
				this.frozenRecordingState = {
					recordingId: recordingIdToSave,
					chunkIndex: chunkIndexToSave,
				}
				logger.log(
					this.createLogContext("页面冻结：录音状态已保存", {
						frozenRecordingId: recordingIdToSave,
						frozenChunkIndex: chunkIndexToSave,
					}),
				)
			}
		} else {
			logger.log(this.createLogContext("页面冻结：当前未检测到录音，无需保存状态"))
		}

		// Perform cleanup asynchronously
		void this.performPageFreezeCleanup()
	}

	/**
	 * Perform cleanup when page is frozen
	 * 页面冻结时执行清理
	 */
	private async performPageFreezeCleanup(): Promise<void> {
		try {
			// Save current session to persistence
			await this.saveCurrentSession()

			// Stop sending mode to prevent buffering during freeze
			// Note: AudioProcessor will be paused by the browser automatically during freeze
			// Any audio during the freeze period will be lost (browser limitation)
			if (this.voiceClient && this.isConnected) {
				try {
					await this.voiceClient.stopSending()
				} catch (error) {
					logger.warn(
						this.createLogContext("页面冻结：冻结期间停止发送失败", {
							error: String(error),
						}),
					)
				}
			}
		} catch (error) {
			logger.error(
				this.createLogContext("页面冻结错误：冻结清理失败", {
					error: String(error),
				}),
			)
		}
	}

	/**
	 * Handle page resume event (system waking up from sleep)
	 * 处理页面恢复事件（系统从休眠唤醒）
	 */
	private handlePageResume(): void {
		logger.log(this.createLogContext("页面恢复：系统从休眠唤醒，尝试恢复"))

		if (!this.shouldResumeAfterPageResume) {
			logger.log(this.createLogContext("页面恢复：无需恢复录音"))
			logger.report(this.createLogContext("页面恢复：无需恢复录音", { event: "page_resume" }))
			return
		}

		if (this.pageLifecycleReconnectInProgress) {
			logger.log(this.createLogContext("页面恢复：恢复操作已在进行中"))
			return
		}

		this.pageLifecycleReconnectInProgress = true
		// 上报页面恢复事件
		logger.report(this.createLogContext("页面恢复：系统从休眠唤醒"))
		void this.performPageResumeReconnect()
	}

	/**
	 * Perform reconnection when page resumes
	 * 页面恢复时执行重连
	 */
	private async performPageResumeReconnect(): Promise<void> {
		let shouldCleanupState = true

		try {
			logger.log(this.createLogContext("页面恢复：开始恢复重连流程"))

			// Check network status first
			if (this.networkStatus === "offline") {
				logger.warn(this.createLogContext("页面恢复：网络离线，延迟恢复到网络恢复流程"))
				// Keep shouldResumeAfterPageResume flag set
				// Network recovery flow will handle the resume
				this.resumeRecordingAfterNetwork = true
				shouldCleanupState = false // Don't clean up state, network recovery will handle it
				return
			}

			// Check if we need to reinitialize clients
			await this.initializeClients()

			// Restore recording state（优先冻结状态，其次离线记录，最后当前状态）
			const restoredRecordingId =
				this.frozenRecordingState?.recordingId ??
				this.offlineRecordingState?.recordingId ??
				this.currentRecordingId
			const restoredChunkIndex =
				this.frozenRecordingState?.chunkIndex ??
				this.offlineRecordingState?.chunkIndex ??
				this.chunkIndex

			if (restoredRecordingId) {
				this.currentRecordingId = restoredRecordingId
				this.chunkIndex = restoredChunkIndex

				logger.log(
					this.createLogContext("页面恢复：录音状态已恢复", {
						restoredRecordingId,
						restoredChunkIndex,
					}),
				)
			} else {
				logger.warn(this.createLogContext("页面恢复：无录音状态可恢复，重新开始"))
			}

			// Reconnect if needed
			if (!this.isConnected) {
				this.updateStatus("connecting")
				try {
					await this.voiceClient?.connect(restoredRecordingId ?? undefined)
				} catch (error) {
					logger.error(
						this.createLogContext("页面恢复失败：重连失败", {
							error: String(error),
						}),
					)
					throw error
				}
			}

			// Process any pending chunks that were collected during freeze
			await this.processPendingChunks()

			// Resume recording if needed
			if (this.shouldResumeAfterPageResume) {
				// Restart audio processor if not already recording
				if (!this.audioProcessor?.isRecording) {
					await this.audioProcessor?.start(this.externalAudioStream ?? undefined)
				}

				// Resume sending mode if connected
				if (this.isConnected) {
					await this.voiceClient?.startSending()
				} else {
					logger.warn(this.createLogContext("页面恢复：连接未建立，音频将被缓冲"))
				}

				// Update recording state
				this.isRecording = true
				await this.saveCurrentSession()
				this.updateStatus("recording")

				logger.log(this.createLogContext("页面恢复：录音已成功恢复"))
				// 上报页面恢复后录音恢复成功
				logger.report(this.createLogContext("页面恢复：录音已成功恢复"))
				await this.logPendingChunksSnapshot("页面恢复：恢复完成快照")
			} else {
				logger.report(
					this.createLogContext("页面恢复：无录音需要恢复", { event: "page_resume" }),
				)
			}
		} catch (error) {
			logger.error(
				this.createLogContext("页面恢复失败：页面唤醒后恢复失败", {
					error: String(error),
				}),
			)
			this.handleError(error as Error)
		} finally {
			// Clean up page lifecycle state conditionally
			if (shouldCleanupState) {
				this.shouldResumeAfterPageResume = false
				this.frozenRecordingState = null
			}
			// Always reset reconnect progress flag
			this.pageLifecycleReconnectInProgress = false
			logger.log("[PageLifecycle] Resume flow completed")
		}
	}

	private setupNetworkListeners(): void {
		if (typeof window === "undefined") return
		if (typeof window.addEventListener !== "function") return
		if (this.networkOfflineHandler || this.networkOnlineHandler) return

		const handleOffline = () => this.handleNetworkOffline()
		const handleOnline = () => this.handleNetworkOnline()

		const isOnline = typeof navigator === "undefined" ? true : navigator.onLine !== false
		this.networkStatus = isOnline ? "online" : "offline"

		window.addEventListener("offline", handleOffline)
		window.addEventListener("online", handleOnline)

		this.networkOfflineHandler = handleOffline
		this.networkOnlineHandler = handleOnline
	}

	private teardownNetworkListeners(): void {
		if (typeof window === "undefined") return
		if (typeof window.removeEventListener !== "function") return

		if (this.networkOfflineHandler) {
			window.removeEventListener("offline", this.networkOfflineHandler)
			this.networkOfflineHandler = null
		}

		if (this.networkOnlineHandler) {
			window.removeEventListener("online", this.networkOnlineHandler)
			this.networkOnlineHandler = null
		}
	}

	private handleNetworkOffline(): void {
		if (this.networkStatus === "offline") return
		this.networkStatus = "offline"

		logger.warn(this.createLogContext("网络离线：检测到网络离线，暂停语音传输"))
		logger.report(this.createLogContext("网络离线：上报状态切换", { event: "offline" }))

		const wasRecording = this.status === "recording" || this.isRecording
		this.resumeRecordingAfterNetwork = wasRecording
		this.shouldReconnectAfterNetwork =
			this.isConnected || this.status === "connecting" || this.isRetrying

		if (!this.offlineRecordingState) {
			this.offlineRecordingState = {
				recordingId: this.currentRecordingId,
				chunkIndex: this.chunkIndex,
			}
		} else {
			this.offlineRecordingState.recordingId = this.currentRecordingId
			this.offlineRecordingState.chunkIndex = this.chunkIndex
		}

		this.networkReconnectInProgress = false
		this.clearRetryTimer()
		this.isRetrying = false

		if (this.stopPromise) {
			this.stopPromise.reject(new Error("Network connection lost"))
			this.stopPromise = null
		}

		this.updateStatus("error")
		this.options.onError?.(new Error("Network connection lost"))
		// 上报网络离线事件
		logger.report(this.createLogContext("网络离线：网络连接丢失"))

		void this.performNetworkOfflineCleanup()
	}

	private async performNetworkOfflineCleanup(): Promise<void> {
		try {
			if (this.voiceClient) {
				try {
					await this.voiceClient.stopSending()
				} catch (error) {
					logger.warn(
						this.createLogContext("网络离线：清理时停止发送失败", {
							error: String(error),
						}),
					)
					void this.logErrorWithPendingSnapshot(
						"网络离线：停止发送失败，记录待发送快照",
						error,
					)
				}

				try {
					await this.voiceClient.disconnect()
				} catch (error) {
					logger.warn(
						this.createLogContext("网络离线：清理时断开连接失败", {
							error: String(error),
						}),
					)
					void this.logErrorWithPendingSnapshot(
						"网络离线：断开连接失败，记录待发送快照",
						error,
					)
				}
			}

			this.isConnected = false
			this.isRecording = false

			await this.saveCurrentSession()
		} catch (error) {
			logger.error(
				this.createLogContext("网络离线：离线清理失败", {
					error: String(error),
				}),
			)
			void this.logErrorWithPendingSnapshot("网络离线：离线清理失败", error)
		}
	}

	private handleNetworkOnline(): void {
		if (this.networkStatus === "online") return
		this.networkStatus = "online"

		logger.log(this.createLogContext("网络恢复：检测到网络已连接，尝试恢复语音传输"))
		// 上报网络恢复事件
		logger.report(this.createLogContext("网络恢复：检测到网络已连接"))

		if (!this.shouldReconnectAfterNetwork && !this.resumeRecordingAfterNetwork) return
		if (this.networkReconnectInProgress) return

		this.networkReconnectInProgress = true
		void this.performNetworkReconnect()
	}

	private async performNetworkReconnect(): Promise<void> {
		try {
			if (this.networkStatus === "offline") {
				logger.warn(
					this.createLogContext("网络恢复：状态仍为离线，保留恢复标志等待下一次online"),
				)
				this.networkReconnectInProgress = false
				return
			}

			await this.initializeClients()

			if (this.shouldReconnectAfterNetwork) {
				this.updateStatus("connecting")
				await this.voiceClient?.connect(this.currentRecordingId ?? undefined)
			}

			if (this.resumeRecordingAfterNetwork) {
				const restoredRecordingId = this.offlineRecordingState?.recordingId
				const restoredChunkIndex = this.offlineRecordingState?.chunkIndex ?? this.chunkIndex

				if (restoredRecordingId) {
					this.currentRecordingId = restoredRecordingId
					logger.log(
						this.createLogContext("网络恢复：恢复录音状态", {
							restoredRecordingId,
						}),
					)
				} else {
					logger.warn(this.createLogContext("网络恢复：网络恢复后无录音状态可恢复"))
				}
				this.chunkIndex = restoredChunkIndex

				// Process any pending chunks from the session
				await this.processPendingChunks()

				if (!this.audioProcessor?.isRecording) {
					try {
						await this.audioProcessor?.start(this.externalAudioStream ?? undefined)
					} catch (error) {
						logger.error(
							this.createLogContext("网络恢复：重启音频处理器失败", {
								error: String(error),
							}),
						)
						throw error
					}
				}

				if (this.isConnected) {
					try {
						await this.voiceClient?.startSending()
					} catch (error) {
						logger.error(
							this.createLogContext("网络恢复：恢复发送失败", {
								error: String(error),
							}),
						)
						throw error
					}
				} else {
					logger.warn(this.createLogContext("网络恢复：未连接，录音将被缓冲"))
				}

				this.options.onConnect?.()

				this.isRecording = true
				await this.saveCurrentSession()
				this.updateStatus("recording")
				logger.log(this.createLogContext("网络恢复：录音已成功恢复"))
				// 上报网络恢复后录音恢复成功
				logger.report(this.createLogContext("网络恢复：录音已成功恢复"))
				await this.logPendingChunksSnapshot("网络恢复：恢复完成快照")
			} else if (this.shouldReconnectAfterNetwork) {
				this.updateStatus("idle")
			}
		} catch (error) {
			logger.error(
				this.createLogContext("网络恢复失败：网络恢复后恢复失败", {
					error: String(error),
				}),
			)
			this.handleError(error as Error)
		} finally {
			this.shouldReconnectAfterNetwork = false
			this.resumeRecordingAfterNetwork = false
			this.networkReconnectInProgress = false
			this.offlineRecordingState = null
		}
	}

	private handleVisibilityRestore(): void {
		if (typeof document === "undefined") return
		if (document.visibilityState !== "visible") return
		void this.attemptVisibilityReconnect()
	}

	private shouldAttemptVisibilityReconnect(): boolean {
		// const exceededRetries = this.maxRetries > 0 && this.retryCount >= this.maxRetries
		const disconnected = !this.isConnected
		// if (!exceededRetries) return false
		if (!disconnected) return false
		if (this.isRetrying) return false
		if (this.visibilityReconnectInProgress) return false
		return true
	}

	private async attemptVisibilityReconnect(): Promise<void> {
		if (!this.shouldAttemptVisibilityReconnect()) return

		this.visibilityReconnectInProgress = true
		logger.log(this.createLogContext("可见性恢复：尝试自动重连"))

		try {
			await this.retry()
		} catch (error) {
			logger.error(
				this.createLogContext("可见性恢复失败：自动重连失败", {
					error: String(error),
				}),
			)
		}

		this.visibilityReconnectInProgress = false
	}

	/**
	 * Manual retry method for external use
	 * 手动重试方法，供外部调用
	 */
	async retry(): Promise<void> {
		if (this.isRetrying) {
			throw new Error("Retry already in progress")
		}
		this.visibilityReconnectInProgress = false

		// Save current recording state before retry
		const wasRecording = this.isRecording
		const previousRecordingId = this.currentRecordingId
		const previousChunkIndex = this.chunkIndex

		this.resetRetryState()

		try {
			await this.initializeClients()

			await this.connect()

			// If we were previously recording, restore the recording state
			if (wasRecording && previousRecordingId) {
				// Restore recording state
				this.currentRecordingId = previousRecordingId
				this.chunkIndex = previousChunkIndex
				this.isRecording = true

				// Start sending mode in worker
				await this.voiceClient?.startSending()

				// Save restored session
				await this.saveCurrentSession()

				this.updateStatus("recording")
			} else {
				// No previous recording, just ensure sending is ready
				if (this.isConnected) {
					this.voiceClient?.startSending()
				}
				this.updateStatus("idle")
			}

			if (!this.audioProcessor?.isRecording) {
				try {
					await this.audioProcessor?.start(this.externalAudioStream ?? undefined)
				} catch (error) {
					logger.error(
						this.createLogContext("重试失败：重启音频处理器失败", {
							error: String(error),
						}),
					)
					throw error
				}
			}

			if (!this.isRecording) {
				this.isRecording = true
			}
		} catch (error) {
			logger.error(
				this.createLogContext("重试失败：手动重试失败", {
					error: String(error),
				}),
			)
			this.handleError(error as Error)
			throw error
		}
	}

	// ===== Queue Management Methods Moved to Worker =====
	// All queue management logic has been moved to VoiceClientWorker for better performance
	// and to avoid blocking the main thread.

	// ===== Persistence Methods =====

	/**
	 * Save current recording session to persistence storage
	 * 保存当前录制会话到持久化存储
	 */
	private async saveCurrentSession(): Promise<void> {
		if (!this.persistenceEnabled || !this.persistenceStorage || !this.currentRecordingId) {
			return
		}

		try {
			const session: RecordingSession = {
				recordingId: this.currentRecordingId,
				createdAt: Date.now(),
				updatedAt: Date.now(),
				chunkIndex: this.chunkIndex,
				isRecording: this.isRecording,
				// pendingChunks managed in Worker now
			}

			await this.persistenceStorage.saveSession(session)
		} catch (error) {
			logger.warn(
				this.createLogContext("持久化警告：保存录制会话失败", {
					error: String(error),
				}),
			)
		}
	}

	/**
	 * Restore recording session from persistence storage
	 * 从持久化存储恢复录制会话
	 */
	private async restoreSession(recordingId: string): Promise<RecordingSession | null> {
		if (!this.persistenceEnabled || !this.persistenceStorage) {
			return null
		}

		try {
			const session = await this.persistenceStorage.getSession(recordingId)
			if (session) {
				logger.log(
					this.createLogContext("持久化：会话已恢复", {
						restoredRecordingId: recordingId,
					}),
				)
				return session
			}
		} catch (error) {
			logger.warn(
				this.createLogContext("持久化警告：恢复会话失败", {
					recordingId,
					error: String(error),
				}),
			)
		}

		return null
	}

	/**
	 * Clean expired recording sessions
	 * 清理过期的录制会话
	 */
	private async cleanExpiredSessions(): Promise<void> {
		if (!this.persistenceEnabled || !this.persistenceStorage) {
			return
		}

		try {
			await this.persistenceStorage.cleanExpiredSessions(this.sessionTTL)

			// Also limit total number of sessions
			const allSessions = await this.persistenceStorage.getAllSessions()
			if (allSessions.length > this.maxSessions) {
				// Sort by updatedAt and remove oldest sessions
				allSessions.sort(
					(a: RecordingSession, b: RecordingSession) => b.updatedAt - a.updatedAt,
				)
				const sessionsToRemove = allSessions.slice(this.maxSessions)

				for (const session of sessionsToRemove) {
					await this.persistenceStorage.deleteSession(session.recordingId)
				}

				logger.log(
					this.createLogContext("持久化：已清理过期会话", {
						cleanedCount: sessionsToRemove.length,
						maxSessions: this.maxSessions,
					}),
				)
			}
		} catch (error) {
			logger.warn(
				this.createLogContext("持久化警告：清理过期会话失败", {
					error: String(error),
				}),
			)
		}
	}

	/**
	 * Get all stored recording sessions
	 * 获取所有存储的录制会话
	 */
	async getAllStoredSessions(): Promise<RecordingSession[]> {
		if (!this.persistenceEnabled || !this.persistenceStorage) {
			return []
		}

		try {
			return await this.persistenceStorage.getAllSessions()
		} catch (error) {
			logger.warn(
				this.createLogContext("持久化警告：获取存储的会话失败", {
					error: String(error),
				}),
			)
			return []
		}
	}

	/**
	 * Remove a specific recording session
	 * 移除特定的录制会话
	 */
	async removeStoredSession(recordingId: string): Promise<void> {
		if (!this.persistenceEnabled || !this.persistenceStorage) {
			return
		}

		try {
			await this.persistenceStorage.deleteSession(recordingId)
			logger.log(
				this.createLogContext("持久化：会话已移除", {
					removedRecordingId: recordingId,
				}),
			)
		} catch (error) {
			logger.warn(
				this.createLogContext("持久化警告：移除会话失败", {
					recordingId,
					error: String(error),
				}),
			)
			throw error
		}
	}

	/**
	 * Clear all stored recording sessions
	 * 清空所有存储的录制会话
	 */
	async clearAllStoredSessions(): Promise<void> {
		if (!this.persistenceEnabled || !this.persistenceStorage) {
			return
		}

		try {
			await this.persistenceStorage.clear()
			logger.log(this.createLogContext("持久化：所有存储的会话已清空"))
		} catch (error) {
			logger.warn(
				this.createLogContext("持久化警告：清空所有会话失败", {
					error: String(error),
				}),
			)
			throw error
		}
	}
}

export { VoiceToTextService }

import { Upload, UploadConfig as SDKUploadConfig } from "@dtyq/upload-sdk"
import type { UploadConfig, UploadEvents } from "@/types/recordSummary"
import { UploadTokenManager } from "./UploadTokenManager"
import { RecordingBatchSaveReporter } from "./RecordingBatchSaveReporter"
import { AudioChunkDB, type StoredAudioChunk } from "./MediaRecorderService/AudioChunkDB"
import { recordingLogger } from "./utils/RecordingLogger"
import { getSnowflakeUploadFileName } from "./utils/getSnowflakeUploadFileName"
import { isTaskEndError } from "./RecordingErrorManager"
import { getNetworkMonitor, type NetworkMonitor } from "./NetworkMonitor"

const logger = recordingLogger.namespace("Upload:Chunk")

export interface SessionUploadProgress {
	total: number
	pending: number
	uploaded: number
	failed: number
	settled: boolean
	completed: boolean
}

/**
 * Retry configuration for exponential backoff
 * 指数退避重试配置
 */
interface RetryConfig {
	baseDelayMs: number // Base delay for retry (default: 2000ms)
	maxDelayMs: number // Maximum delay for retry (default: 30000ms)
	exponentialFactor: number // Exponential factor for backoff (default: 2)
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
	baseDelayMs: 2000,
	maxDelayMs: 30000,
	exponentialFactor: 2,
}

const DEFAULT_UPLOAD_TIMEOUT_MS = 60000
export const PLACEHOLDER_UPLOAD_MAX_FAILED_CHUNKS = 30
export const PLACEHOLDER_UPLOAD_TIMEOUT_MS = 120000
export const PLACEHOLDER_UPLOAD_CONCURRENCY = 3

export interface PlaceholderUploadProgress {
	total: number
	completed: number
	failed: number
	active: number
}

interface PlaceholderUploadOptions {
	maxChunks?: number
	timeoutMs?: number
	concurrency?: number
	signal?: AbortSignal
	onProgress?: (progress: PlaceholderUploadProgress) => void
}

interface PlaceholderUploadAbortState {
	signal: AbortSignal
	abort: (reason: Error) => void
	getReason: () => Error
	cleanup: () => void
}

/**
 * Chunk uploader for uploading audio chunks from IndexedDB to OSS
 * 分片上传器，负责将IndexedDB中的音频分片上传到OSS
 */
export class ChunkUploader {
	private config: UploadConfig
	private events: Partial<UploadEvents>
	private sessionQueues = new Map<string, string[]>() // sessionId -> chunkIds[]
	private sessionActiveUploads = new Map<string, string | null>() // sessionId -> currentChunkId
	private activeUploads = new Map<string, StoredAudioChunk>() // Store chunk details
	private activeUploadIds = new Set<string>() // Tracks uploads before chunk details are loaded

	private uploadInstance: Upload = new Upload()
	private tokenManager: UploadTokenManager
	private batchSaveReporter: RecordingBatchSaveReporter
	private audioChunkDB: AudioChunkDB
	private sessionTopicMap = new Map<string, string>() // sessionId -> topicId mapping
	private sessionProjectMap = new Map<string, string>() // sessionId -> projectId mapping

	// Retry management
	private chunkRetries = new Map<string, number>() // chunkId -> retry count
	private retryConfig: RetryConfig = DEFAULT_RETRY_CONFIG
	private retryTimers = new Map<string, NodeJS.Timeout>() // chunkId -> timer

	// Network monitoring
	private networkMonitor: NetworkMonitor
	private networkUnsubscribe: (() => void) | null = null
	private wasOffline = false

	constructor(
		config: UploadConfig,
		batchSaveReporter: RecordingBatchSaveReporter,
		events: Partial<UploadEvents> = {},
	) {
		this.config = config
		this.batchSaveReporter = batchSaveReporter
		this.events = events
		// Initialize token manager with task end callback
		this.tokenManager = new UploadTokenManager(
			{},
			events.onTaskEnd
				? (sessionId: string) => {
						events.onTaskEnd?.(sessionId)
					}
				: undefined,
		)
		this.audioChunkDB = new AudioChunkDB()

		// Initialize network monitor
		this.networkMonitor = getNetworkMonitor()
		this.setupNetworkMonitoring()
	}

	/**
	 * Setup network status monitoring
	 * 设置网络状态监听
	 */
	private setupNetworkMonitoring() {
		this.networkUnsubscribe = this.networkMonitor.subscribe((isOnline) => {
			if (isOnline && this.wasOffline) {
				logger.report("Network restored, resuming uploads")
				this.handleNetworkOnline()
				this.wasOffline = false
			} else if (!isOnline) {
				logger.warn("Network offline detected")
				this.handleNetworkOffline()
				this.wasOffline = true
			}
		})

		// Set initial offline state
		if (!this.networkMonitor.isNetworkOnline()) {
			this.wasOffline = true
		}
	}

	/**
	 * Handle network offline event
	 * 处理网络离线事件
	 */
	private async handleNetworkOffline() {
		// Notify all active sessions about offline status
		const sessionIds = Array.from(this.sessionQueues.keys())
		for (const sessionId of sessionIds) {
			const progress = await this.audioChunkDB.getSessionUploadProgress(sessionId)
			this.events.onNetworkOffline?.(sessionId, progress.pending)
		}
	}

	/**
	 * Handle network online event
	 * 处理网络恢复在线事件
	 */
	private async handleNetworkOnline() {
		// Clear all retry timers and immediately retry
		this.retryTimers.forEach((timer) => clearTimeout(timer))
		this.retryTimers.clear()

		// Check if there are pending chunks and notify
		const sessionIds = Array.from(this.sessionQueues.keys())
		for (const sessionId of sessionIds) {
			const progress = await this.audioChunkDB.getSessionUploadProgress(sessionId)
			// Only notify if there are pending chunks
			if (progress.pending > 0) {
				this.events.onNetworkOnline?.(sessionId, progress.pending)
			}
		}

		// Immediately resume uploads
		this.processQueue()
	}

	/**
	 * Calculate retry delay using exponential backoff
	 * 使用指数退避计算重试延迟
	 */
	private calculateRetryDelay(retryCount: number): number {
		const delay = Math.min(
			this.retryConfig.baseDelayMs * Math.pow(this.retryConfig.exponentialFactor, retryCount),
			this.retryConfig.maxDelayMs,
		)
		return delay
	}

	/**
	 * Get retry count for a chunk
	 * 获取分片的重试次数
	 */
	private getRetryCount(chunkId: string): number {
		return this.chunkRetries.get(chunkId) || 0
	}

	/**
	 * Increment retry count for a chunk
	 * 增加分片的重试次数
	 */
	private incrementRetryCount(chunkId: string): number {
		const currentCount = this.getRetryCount(chunkId)
		const newCount = currentCount + 1
		this.chunkRetries.set(chunkId, newCount)
		return newCount
	}

	/**
	 * Clear retry count for a chunk
	 * 清除分片的重试次数
	 */
	private clearRetryCount(chunkId: string) {
		this.chunkRetries.delete(chunkId)
	}

	/**
	 * Check if chunk has exceeded max retries
	 * 检查分片是否超过最大重试次数
	 */
	private hasExceededMaxRetries(chunkId: string): boolean {
		return this.getRetryCount(chunkId) >= this.config.maxRetryCount
	}

	/**
	 * Start uploading all pending chunks for a session
	 * 开始上传会话的所有待上传分片
	 */
	async uploadSession(sessionId: string, topicId: string, projectId: string = ""): Promise<void> {
		// Store topic ID mapping
		this.sessionTopicMap.set(sessionId, topicId)
		this.sessionProjectMap.set(sessionId, projectId)

		// Get all pending chunks for the session
		const pendingChunks = await this.audioChunkDB.getChunksByUploadStatus(sessionId, "pending")

		// Sort by index to ensure correct order
		const sortedChunks = pendingChunks.sort((a, b) => a.index - b.index)

		logger.report("开始上传会话分片", {
			pendingCount: sortedChunks.length,
		})

		// Initialize session queue if not exists
		if (!this.sessionQueues.has(sessionId)) {
			this.sessionQueues.set(sessionId, [])
		}

		const sessionQueue = this.sessionQueues.get(sessionId)
		if (!sessionQueue) return

		const currentActiveChunkId = this.sessionActiveUploads.get(sessionId)

		// Add chunk IDs to session queue (avoid duplicates)
		let addedCount = 0
		for (const chunk of sortedChunks) {
			const isInQueue = sessionQueue.includes(chunk.id)
			const isActive = currentActiveChunkId === chunk.id
			if (!isInQueue && !isActive) {
				sessionQueue.push(chunk.id)
				addedCount++
			}
		}

		if (addedCount > 0) {
			logger.log("添加分片到上传队列", {
				addedCount,
				queueLength: sessionQueue.length,
			})
		}

		// Start processing queue
		this.processQueue()
	}

	/**
	 * Process upload queue with concurrency control
	 * 处理上传队列（并发控制）
	 */
	private async processQueue(): Promise<void> {
		// Skip if network is offline
		if (this.networkMonitor.isNetworkOffline()) {
			logger.log("Network is offline, skipping upload queue processing")
			return
		}

		// Check if we can start new uploads (total concurrent limit)
		while (this.activeUploadIds.size < this.config.maxConcurrentUploads) {
			let foundWork = false

			// Iterate through all session queues
			const sessionQueueEntries = Array.from(this.sessionQueues.entries())
			for (let i = 0; i < sessionQueueEntries.length; i++) {
				const [sessionId, queue] = sessionQueueEntries[i]
				// Skip if this session already has an active upload
				if (
					this.sessionActiveUploads.has(sessionId) &&
					this.sessionActiveUploads.get(sessionId)
				) {
					continue
				}

				// Skip if session queue is empty
				if (queue.length === 0) {
					continue
				}

				// Get next chunk ID from this session's queue
				const chunkId = queue.shift()
				if (chunkId) {
					this.activeUploadIds.add(chunkId)
					this.sessionActiveUploads.set(sessionId, chunkId)
					this.startUpload(chunkId, sessionId)
					foundWork = true
					break // Start one upload at a time to check concurrent limit
				}
			}

			// If no work was found, exit the loop
			if (!foundWork) {
				break
			}
		}
	}

	/**
	 * Start uploading a single chunk
	 * 开始上传单个分片
	 */
	private async startUpload(chunkId: string, sessionId: string): Promise<void> {
		// Double check network status before starting upload
		if (this.networkMonitor.isNetworkOffline()) {
			logger.log("Network is offline, skipping chunk upload", { chunkId })
			// Put chunk back to queue
			const chunk = await this.audioChunkDB.get(chunkId)
			if (chunk) {
				const sessionQueue = this.sessionQueues.get(chunk.sessionId)
				if (sessionQueue) {
					sessionQueue.unshift(chunkId)
				}
			}
			this.activeUploadIds.delete(chunkId)
			this.sessionActiveUploads.delete(sessionId)
			return
		}

		try {
			// Get chunk from IndexedDB
			const chunk = await this.audioChunkDB.get(chunkId)
			if (!chunk) {
				logger.error(`在 IndexedDB 中找不到分片 ${chunkId}`)
				// Clear session active status to unblock this session
				this.activeUploadIds.delete(chunkId)
				this.sessionActiveUploads.delete(sessionId)
				return
			}

			// Add to active uploads
			this.activeUploads.set(chunkId, chunk)

			// Sampling: log every 10 chunks
			if (chunk.index % 10 === 0) {
				const sessionQueue = this.sessionQueues.get(chunk.sessionId)
				logger.log("上传分片", {
					chunkIndex: chunk.index,
					chunkSize: Math.round(chunk.size / 1024) + "KB",
					queueRemaining: sessionQueue?.length || 0,
					activeUploads: this.activeUploads.size,
				})
			}

			const uploadUrl = await this.uploadChunk(chunk)
			await this.handleUploadSuccess(chunk, uploadUrl)
		} catch (error) {
			await this.handleUploadError(chunkId, error as Error)
		}
	}

	/**
	 * Upload single chunk using upload SDK
	 * 使用上传SDK上传单个分片
	 */
	public async uploadChunk(chunk: StoredAudioChunk): Promise<string> {
		// Auto-detect audio format based on data header or use default WebM
		const { mimeType, extension } = this.detectAudioFormat(chunk.chunk)

		const originalFileName = `${chunk.index}.${extension}`
		// Use a snowflake ID to avoid backend name collisions.
		const uploadFileName = await getSnowflakeUploadFileName()
		const audioFile = new File([chunk.chunk], originalFileName, {
			type: mimeType,
		})

		if (!chunk.sessionId) {
			throw new Error("Session ID is required")
		}

		// Get upload credentials
		const customCredentials = await this.getUploadCredentials(chunk.sessionId)

		return new Promise((resolve, reject) => {
			let settled = false
			// The SDK currently has no hard timeout, so guard the business queue
			// against XHRs that never call success/fail and would pin sessionActiveUploads.
			const timeout = setTimeout(() => {
				if (settled) return
				settled = true
				reject(new Error(`Upload timed out after ${DEFAULT_UPLOAD_TIMEOUT_MS}ms`))
			}, DEFAULT_UPLOAD_TIMEOUT_MS)
			const settle = (callback: () => void) => {
				if (settled) return
				settled = true
				clearTimeout(timeout)
				callback()
			}

			const { success, fail } = this.uploadInstance.upload({
				file: audioFile,
				fileName: uploadFileName,
				customCredentials,
				body: JSON.stringify({
					storage: "private",
					sts: true,
					content_type: mimeType,
				}),
			})

			success?.((res) => {
				if (res?.data?.path) {
					settle(() => {
						resolve(res.data.path)
					})
				} else {
					settle(() => {
						reject(new Error("Upload failed: No path returned"))
					})
				}
			})

			fail?.((error) => {
				settle(() => {
					reject(new Error(`Upload failed: ${error || "Unknown error"}`))
				})
			})
		})
	}

	/**
	 * Detect audio format from Blob header
	 * 从Blob头部检测音频格式
	 */
	private detectAudioFormat(blob: Blob): { mimeType: string; extension: string } {
		// If blob already has a type, use it
		if (blob.type) {
			const mimeType = blob.type
			const extension = this.getExtensionFromMimeType(mimeType)
			return { mimeType, extension }
		}

		// Default to WebM (most common from MediaRecorder)
		return { mimeType: "audio/webm", extension: "webm" }
	}

	/**
	 * Get file extension from MIME type
	 * 从MIME类型获取文件扩展名
	 */
	private getExtensionFromMimeType(mimeType: string): string {
		const mimeToExt: Record<string, string> = {
			"audio/webm": "webm",
			"audio/mp4": "mp4",
			"audio/wav": "wav",
			"audio/mpeg": "mp3",
			"audio/ogg": "ogg",
			"audio/pcm": "pcm",
		}

		// Handle codec specifications in MIME type
		const baseMimeType = mimeType.split(";")[0]
		return mimeToExt[baseMimeType] || "webm"
	}

	/**
	 * Handle successful upload
	 * 处理上传成功
	 */
	private async handleUploadSuccess(chunk: StoredAudioChunk, uploadUrl: string): Promise<void> {
		await this.reportUploadedChunk(chunk, uploadUrl, { requireBatchSave: true })

		// Mark chunk as uploaded (keep data in IndexedDB for export)
		try {
			await this.audioChunkDB.updateChunkUploadStatus(chunk.id, "uploaded")
		} catch (error) {
			logger.error(`Failed to update chunk status ${chunk.id}:`, error)
		}

		// Remove from active uploads
		this.activeUploads.delete(chunk.id)
		this.activeUploadIds.delete(chunk.id)

		// Clear session active status to allow next chunk in this session
		this.sessionActiveUploads.delete(chunk.sessionId)

		// Clear retry count on success
		this.clearRetryCount(chunk.id)

		// Sampling: log every 10 chunks for upload progress monitoring
		// Full traceability is handled by BatchSaveReporter's report log
		if (chunk.index % 10 === 0) {
			logger.report("分片上传成功", {
				chunkId: chunk.id,
				chunkIndex: chunk.index,
				chunkSize: chunk.size,
				uploadUrl,
				sessionId: chunk.sessionId,
			})
		}

		// Emit success event
		this.events.onSuccess?.(chunk.id, uploadUrl)

		// Continue processing queue (will pick next chunk from this session or other sessions)
		this.processQueue()
	}

	private async reportUploadedChunk(
		chunk: StoredAudioChunk,
		uploadUrl: string,
		options: { requireBatchSave?: boolean } = {},
	): Promise<void> {
		const topicId = this.sessionTopicMap.get(chunk.sessionId) || ""
		const projectId = this.sessionProjectMap.get(chunk.sessionId) || ""
		const hiddenDirectory = this.tokenManager.getDirectories(chunk.sessionId)?.asr_hidden_dir
		const fileName = this.getChunkFileName(chunk)

		if (!projectId || !topicId || !hiddenDirectory?.directory_id) {
			if (options.requireBatchSave) {
				throw new Error(
					`Missing batch save context for chunk ${chunk.id}: projectId=${projectId}, topicId=${topicId}, parentId=${hiddenDirectory?.directory_id}`,
				)
			}
			logger.warn("Skip chunk batch save: missing session context", {
				sessionId: chunk.sessionId,
				projectId,
				topicId,
				parentId: hiddenDirectory?.directory_id,
			})
			return
		}

		const reportFile = {
			sessionId: chunk.sessionId,
			projectId,
			topicId,
			parentId: hiddenDirectory.directory_id,
			fileKey: uploadUrl,
			fileName,
			fileSize: chunk.size,
		}

		if (options.requireBatchSave) {
			await this.batchSaveReporter.reportUploadedFileStrict(reportFile)
			return
		}

		await this.batchSaveReporter.reportUploadedFile(reportFile)
	}

	private getChunkFileName(chunk: StoredAudioChunk): string {
		const { extension } = this.detectAudioFormat(chunk.chunk)
		return `${chunk.index}.${extension}`
	}

	/**
	 * Handle upload error with exponential backoff retry logic
	 * 处理上传错误（包含指数退避重试逻辑）
	 */
	private async handleUploadError(chunkId: string, error: Error): Promise<void> {
		// Get chunk from IndexedDB first to have context
		const chunk = await this.audioChunkDB.get(chunkId)

		const retryCount = this.getRetryCount(chunkId)

		logger.error("分片上传失败", {
			chunkId,
			chunkIndex: chunk?.index,
			retryCount,
			error: error.message,
		})

		// Check if error is task end error (code 43200)
		// 检查是否为任务结束错误
		if (isTaskEndError(error)) {
			logger.warn("任务已结束，停止上传分片", {
				chunkId,
			})
			// Remove from active uploads
			this.activeUploads.delete(chunkId)
			this.activeUploadIds.delete(chunkId)
			// Clear retry info
			this.clearRetryCount(chunkId)
			// Clear session active status
			if (chunk) {
				this.sessionActiveUploads.delete(chunk.sessionId)
				// Clear session queue
				this.sessionQueues.delete(chunk.sessionId)
				// Emit task end event
				this.events.onTaskEnd?.(chunk.sessionId)
			}
			return
		}

		if (!chunk) {
			logger.error("错误处理过程中找不到分片", {
				chunkId,
			})
			this.activeUploads.delete(chunkId)
			this.activeUploadIds.delete(chunkId)
			this.clearRetryCount(chunkId)
			// Clear session active status
			const activeEntries = Array.from(this.sessionActiveUploads.entries())
			for (let i = 0; i < activeEntries.length; i++) {
				const [sessionId, activeChunkId] = activeEntries[i]
				if (activeChunkId === chunkId) {
					this.sessionActiveUploads.delete(sessionId)
					break
				}
			}
			return
		}

		// Check if max retries exceeded
		if (this.hasExceededMaxRetries(chunkId)) {
			logger.error(`分片 ${chunkId} 已达到最大重试次数 ${this.config.maxRetryCount}`, {
				chunkIndex: chunk.index,
				sessionId: chunk.sessionId,
			})

			// Remove from active uploads
			this.activeUploads.delete(chunkId)
			this.activeUploadIds.delete(chunkId)
			this.clearRetryCount(chunkId)

			try {
				await this.audioChunkDB.updateChunkUploadStatus(chunkId, "failed")
			} catch (error) {
				logger.error(`Failed to mark chunk ${chunkId} as failed:`, error)
			}

			// Clear session active status
			this.sessionActiveUploads.delete(chunk.sessionId)

			// Emit max retries reached event
			this.events.onMaxRetriesReached?.(chunkId, retryCount)

			// Continue with next chunk (don't block other uploads)
			this.processQueue()
			return
		}

		// Check if error is auth-related and force token refresh
		const isAuthError = this.isAuthenticationError(error)
		if (isAuthError) {
			logger.report(`检测到会话 ${chunk.sessionId} 认证错误，强制刷新令牌`)
			// Force refresh token in background, don't wait for it
			await this.tokenManager
				.forceRefreshToken(chunk.sessionId)
				.then(() => {
					logger.report(`认证错误后刷新令牌成功`, {
						sessionId: chunk.sessionId,
					})
				})
				.catch((refreshError) => {
					logger.error(`认证错误后刷新令牌失败：`, refreshError)
				})
		} else {
			logger.error(`不是认证错误，分片 ${chunkId} 上传失败，错误：`, error)
		}

		// Increment retry count
		const newRetryCount = this.incrementRetryCount(chunkId)

		// Calculate retry delay with exponential backoff
		const retryDelay = this.calculateRetryDelay(newRetryCount - 1)

		logger.log(`将分片 ${chunkId} 重新加入会话 ${chunk.sessionId} 的队列等待重试`, {
			retryCount: newRetryCount,
			retryDelayMs: retryDelay,
			maxRetries: this.config.maxRetryCount,
		})

		// Remove from active uploads
		this.activeUploads.delete(chunkId)
		this.activeUploadIds.delete(chunkId)

		// Clear session active status to allow retry
		this.sessionActiveUploads.delete(chunk.sessionId)

		// Add back to front of session queue for priority retry
		const sessionQueue = this.sessionQueues.get(chunk.sessionId)
		if (sessionQueue) {
			sessionQueue.unshift(chunkId)
		} else {
			// If session queue doesn't exist, create it
			this.sessionQueues.set(chunk.sessionId, [chunkId])
		}

		// Emit error event
		this.events.onError?.(chunkId, error)
		this.events.onRetry?.(chunkId, newRetryCount)

		// Schedule retry with exponential backoff
		const timer = setTimeout(() => {
			this.retryTimers.delete(chunkId)
			this.processQueue()
		}, retryDelay)

		this.retryTimers.set(chunkId, timer)
	}

	/**
	 * Check if error is authentication-related
	 * 检查错误是否为认证相关错误
	 */
	private isAuthenticationError(error: Error): boolean {
		const errorMessage = error.message.toLowerCase()

		// Check common auth error patterns
		const authErrorPatterns = [
			"unauthorized",
			"forbidden",
			"access denied",
			"invalid credentials",
			"credentials information has expired",
			"credentials configuration",
			"token expired",
			"initexception",
			"auth",
			"403",
			"401",
			"status: 400",
		]

		return authErrorPatterns.some((pattern) => errorMessage.includes(pattern))
	}

	/**
	 * Get upload credentials using token manager with caching and refresh
	 * 使用Token管理器获取上传凭证（支持缓存和刷新）
	 */
	private async getUploadCredentials(
		sessionId: string,
	): Promise<SDKUploadConfig["customCredentials"]> {
		try {
			const topicId = this.sessionTopicMap.get(sessionId)
			if (!topicId) {
				throw new Error(`No topicId found for session ${sessionId}`)
			}
			return await this.tokenManager.getToken(sessionId, topicId)
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)
			logger.error(`获取会话 ${sessionId} 上传凭证失败：`, error)
			throw new Error(`Failed to get upload credentials: ${errorMessage}`)
		}
	}

	/**
	 * Get current queue status
	 * 获取当前队列状态
	 */
	async getQueueStatus(sessionId?: string) {
		if (sessionId) {
			const progress = await this.audioChunkDB.getSessionUploadProgress(sessionId)
			const sessionQueue = this.sessionQueues.get(sessionId)
			const queueLength = sessionQueue ? sessionQueue.length : 0
			const isUploading =
				this.sessionActiveUploads.has(sessionId) &&
				this.sessionActiveUploads.get(sessionId) !== null

			return {
				pending: progress.pending,
				queuePending: queueLength,
				uploading: isUploading ? 1 : 0,
				completed: progress.uploaded,
				failed: progress.failed,
				totalTasks: progress.total,
			}
		}

		// Aggregate status across all sessions
		let totalPending = 0
		this.sessionQueues.forEach((queue) => {
			totalPending += queue.length
		})

		return {
			pending: totalPending,
			uploading: this.activeUploadIds.size,
			completed: 0, // Would need to aggregate across all sessions from DB
			failed: 0,
			totalTasks: totalPending + this.activeUploadIds.size,
		}
	}

	/**
	 * 等待所有上传完成
	 * @param sessionId 会话ID
	 * @param maxWaitTime 最大等待时间
	 * @returns
	 */
	async waitForAllUploadsCompleted(
		sessionId: string,
		maxWaitTime: number = 10000,
	): Promise<boolean> {
		return new Promise((resolve, reject) => {
			const timers: { interval?: NodeJS.Timeout; timeout?: NodeJS.Timeout } = {}
			const cleanup = () => {
				if (timers.interval) clearInterval(timers.interval)
				if (timers.timeout) clearTimeout(timers.timeout)
			}
			const checkProgress = async () => {
				try {
					const progress = await this.audioChunkDB.getSessionUploadProgress(sessionId)
					logger.log(`会话 ${sessionId} 上传进度：`, progress)

					if (progress.completed) {
						cleanup()
						resolve(true)
					}
				} catch (error) {
					logger.error(`检查上传进度时出错：`, error)
					cleanup()
					reject(error)
				}
			}

			timers.interval = setInterval(checkProgress, 1000)

			// Initial check
			checkProgress()

			timers.timeout = setTimeout(() => {
				cleanup()
				reject(new Error("等待所有上传完成超时"))
			}, maxWaitTime)
		})
	}

	async waitForSessionUploadsSettled(
		sessionId: string,
		maxWaitTime: number = 10000,
		onProgress?: (progress: SessionUploadProgress) => void,
	): Promise<SessionUploadProgress> {
		return new Promise((resolve, reject) => {
			const timers: { interval?: NodeJS.Timeout; timeout?: NodeJS.Timeout } = {}
			const cleanup = () => {
				if (timers.interval) clearInterval(timers.interval)
				if (timers.timeout) clearTimeout(timers.timeout)
			}
			const checkProgress = async () => {
				try {
					const progress = await this.audioChunkDB.getSessionUploadProgress(sessionId)
					logger.log(`会话 ${sessionId} 上传终态进度：`, progress)
					onProgress?.(progress)

					if (progress.settled) {
						cleanup()
						resolve(progress)
					}
				} catch (error) {
					logger.error(`检查上传终态进度时出错：`, error)
					cleanup()
					reject(error)
				}
			}

			timers.interval = setInterval(checkProgress, 1000)
			checkProgress()

			timers.timeout = setTimeout(() => {
				cleanup()
				reject(new Error("等待所有上传结束超时"))
			}, maxWaitTime)
		})
	}

	async retryFailedChunks(
		sessionId: string,
		topicId: string,
		projectId: string = "",
	): Promise<number> {
		const failedChunks = await this.audioChunkDB.getChunksByUploadStatus(sessionId, "failed")
		for (const chunk of failedChunks) {
			await this.audioChunkDB.updateChunkUploadStatus(chunk.id, "pending")
			this.clearRetryCount(chunk.id)
		}

		if (failedChunks.length > 0) {
			await this.uploadSession(sessionId, topicId, projectId)
		}

		return failedChunks.length
	}

	async uploadEmptyPlaceholdersForFailedChunks(
		sessionId: string,
		topicId: string,
		projectId: string = "",
		options: PlaceholderUploadOptions = {},
	): Promise<number> {
		this.sessionTopicMap.set(sessionId, topicId)
		this.sessionProjectMap.set(sessionId, projectId)

		const {
			maxChunks = PLACEHOLDER_UPLOAD_MAX_FAILED_CHUNKS,
			timeoutMs = PLACEHOLDER_UPLOAD_TIMEOUT_MS,
			concurrency = PLACEHOLDER_UPLOAD_CONCURRENCY,
			signal,
			onProgress,
		} = options

		const failedChunks = (
			await this.audioChunkDB.getChunksByUploadStatus(sessionId, "failed")
		).sort((a, b) => a.index - b.index)

		if (failedChunks.length > maxChunks) {
			throw new Error(
				`Too many failed placeholder chunks: ${failedChunks.length}, limit: ${maxChunks}`,
			)
		}

		const abortState = this.createPlaceholderUploadAbortState(signal, timeoutMs)
		let completed = 0
		let failed = 0
		let active = 0
		let cursor = 0
		let stopError: unknown

		const emitProgress = () => {
			onProgress?.({
				total: failedChunks.length,
				completed,
				failed,
				active,
			})
		}

		emitProgress()

		const uploadNext = async (): Promise<void> => {
			while (cursor < failedChunks.length) {
				this.throwIfPlaceholderUploadAborted(abortState)
				if (stopError) throw stopError

				const chunk = failedChunks[cursor]
				cursor += 1
				active += 1
				emitProgress()

				try {
					await this.uploadEmptyPlaceholderChunk(chunk, abortState)
					completed += 1
					emitProgress()
				} catch (error) {
					failed += 1
					emitProgress()
					stopError = error
					abortState.abort(error instanceof Error ? error : new Error(String(error)))
					throw error
				} finally {
					active -= 1
					emitProgress()
				}
			}
		}

		try {
			const workerCount = Math.min(Math.max(1, concurrency), failedChunks.length)
			await Promise.all(Array.from({ length: workerCount }, () => uploadNext()))
			return failedChunks.length
		} finally {
			abortState.cleanup()
		}
	}

	async getSessionUploadProgress(sessionId: string): Promise<SessionUploadProgress> {
		return this.audioChunkDB.getSessionUploadProgress(sessionId)
	}

	/**
	 * 清除会话的所有分片
	 * @param sessionId 会话ID
	 */
	clearSessionChunks(sessionId: string) {
		// Clear retry info for this session
		this.clearSessionRetryInfo(sessionId)
		// Clear session queue
		this.sessionQueues.delete(sessionId)
		// Clear session active upload
		this.sessionActiveUploads.delete(sessionId)
		// Clear topic mapping
		this.sessionTopicMap.delete(sessionId)
		this.sessionProjectMap.delete(sessionId)
		return this.audioChunkDB.deletePendingSessionChunks(sessionId)
	}

	/**
	 * Check if all chunks for a session are uploaded
	 * 检查某个会话的所有分片是否已上传完成
	 */
	async isSessionUploadCompleted(sessionId: string): Promise<boolean> {
		const progress = await this.audioChunkDB.getSessionUploadProgress(sessionId)
		return progress.completed
	}

	/**
	 * Get session upload status with detailed information
	 * 获取会话上传状态的详细信息
	 */
	async getSessionUploadStatus(sessionId: string) {
		const progress = await this.audioChunkDB.getSessionUploadProgress(sessionId)
		return {
			total: progress.total,
			completed: progress.uploaded,
			pending: progress.pending,
			failed: progress.failed,
			uploading: 0, // Would need to track per session
			cancelled: 0, // Not supported
			isCompleted: progress.completed,
			completionRate: progress.total > 0 ? (progress.uploaded / progress.total) * 100 : 0,
		}
	}

	private createEmptyAudioPlaceholderBlob(chunk: StoredAudioChunk): Blob {
		const mimeType = (chunk.mimeType || chunk.chunk.type || "audio/wav").split(";")[0]
		if (mimeType === "audio/wav") {
			return this.createEmptyWavBlob()
		}
		if (mimeType === "audio/pcm") {
			return new Blob([], { type: "audio/pcm" })
		}

		throw new Error(`Unsupported placeholder audio format: ${mimeType}`)
	}

	private async uploadEmptyPlaceholderChunk(
		chunk: StoredAudioChunk,
		abortState: PlaceholderUploadAbortState,
	): Promise<void> {
		this.throwIfPlaceholderUploadAborted(abortState)
		const placeholderBlob = this.createEmptyAudioPlaceholderBlob(chunk)
		const placeholderChunk: StoredAudioChunk = {
			...chunk,
			chunk: placeholderBlob,
			size: placeholderBlob.size,
			mimeType: placeholderBlob.type || chunk.mimeType,
			uploadStatus: "pending",
		}

		const uploadUrl = await this.racePlaceholderUploadWithAbort(
			this.uploadChunk(placeholderChunk),
			abortState,
		)
		await this.racePlaceholderUploadWithAbort(
			this.reportUploadedChunk(placeholderChunk, uploadUrl, { requireBatchSave: true }),
			abortState,
		)
		await this.racePlaceholderUploadWithAbort(
			this.audioChunkDB.updateChunkUploadStatus(chunk.id, "uploaded"),
			abortState,
		)
		this.clearRetryCount(chunk.id)
	}

	private createPlaceholderUploadAbortState(
		externalSignal: AbortSignal | undefined,
		timeoutMs: number,
	): PlaceholderUploadAbortState {
		const controller = new AbortController()
		let reason = new Error("Placeholder chunk upload cancelled")
		let timeout: ReturnType<typeof setTimeout> | undefined

		const abort = (nextReason: Error) => {
			if (controller.signal.aborted) return
			reason = nextReason
			controller.abort()
		}

		const abortFromExternalSignal = () => abort(new Error("Placeholder chunk upload cancelled"))

		if (externalSignal?.aborted) {
			abortFromExternalSignal()
		} else {
			externalSignal?.addEventListener("abort", abortFromExternalSignal, { once: true })
		}

		if (timeoutMs > 0) {
			timeout = setTimeout(() => {
				abort(new Error(`Placeholder chunk upload timed out after ${timeoutMs}ms`))
			}, timeoutMs)
		}

		return {
			signal: controller.signal,
			abort,
			getReason: () => reason,
			cleanup: () => {
				if (timeout) clearTimeout(timeout)
				externalSignal?.removeEventListener("abort", abortFromExternalSignal)
			},
		}
	}

	private throwIfPlaceholderUploadAborted(abortState: PlaceholderUploadAbortState): void {
		if (abortState.signal.aborted) {
			throw abortState.getReason()
		}
	}

	private async racePlaceholderUploadWithAbort<T>(
		promise: Promise<T>,
		abortState: PlaceholderUploadAbortState,
	): Promise<T> {
		this.throwIfPlaceholderUploadAborted(abortState)

		return new Promise<T>((resolve, reject) => {
			const cleanup = () => {
				abortState.signal.removeEventListener("abort", handleAbort)
			}
			const handleAbort = () => {
				cleanup()
				reject(abortState.getReason())
			}

			abortState.signal.addEventListener("abort", handleAbort, { once: true })
			promise.then(
				(value) => {
					cleanup()
					if (abortState.signal.aborted) {
						reject(abortState.getReason())
						return
					}
					resolve(value)
				},
				(error) => {
					cleanup()
					reject(error)
				},
			)
		})
	}

	private createEmptyWavBlob(): Blob {
		const buffer = new ArrayBuffer(44)
		const view = new DataView(buffer)
		this.writeAscii(view, 0, "RIFF")
		view.setUint32(4, 36, true)
		this.writeAscii(view, 8, "WAVE")
		this.writeAscii(view, 12, "fmt ")
		view.setUint32(16, 16, true)
		view.setUint16(20, 1, true)
		view.setUint16(22, 1, true)
		view.setUint32(24, 16000, true)
		view.setUint32(28, 16000 * 2, true)
		view.setUint16(32, 2, true)
		view.setUint16(34, 16, true)
		this.writeAscii(view, 36, "data")
		view.setUint32(40, 0, true)
		return new Blob([buffer], { type: "audio/wav" })
	}

	private writeAscii(view: DataView, offset: number, text: string): void {
		for (let i = 0; i < text.length; i++) {
			view.setUint8(offset + i, text.charCodeAt(i))
		}
	}

	/**
	 * Pause all uploads
	 * 暂停所有上传
	 */
	pauseAll(): void {
		// Move active uploads back to their session queues
		this.activeUploads.forEach((chunk, chunkId) => {
			const sessionQueue = this.sessionQueues.get(chunk.sessionId)
			if (sessionQueue) {
				sessionQueue.unshift(chunkId)
			} else {
				// If session queue doesn't exist, create it
				this.sessionQueues.set(chunk.sessionId, [chunkId])
			}
		})

		// Clear all active uploads
		this.activeUploads.clear()
		this.activeUploadIds.clear()
		this.sessionActiveUploads.clear()
	}

	/**
	 * Resume all uploads
	 * 恢复所有上传
	 */
	resumeAll(): void {
		this.processQueue()
	}

	/**
	 * Get token manager for direct access
	 * 获取Token管理器以便直接访问
	 */
	getTokenManager(): UploadTokenManager {
		return this.tokenManager
	}

	/**
	 * Force refresh token for a specific session
	 * 强制刷新特定会话的Token
	 */
	async refreshSessionToken(sessionId: string): Promise<void> {
		try {
			await this.tokenManager.forceRefreshToken(sessionId)
		} catch (error) {
			logger.error(`刷新会话 ${sessionId} 令牌失败：`, error)
			throw error
		}
	}

	/**
	 * Get token information for debugging
	 * 获取Token信息用于调试
	 */
	getTokenInfo(sessionId: string) {
		return this.tokenManager.getTokenInfo(sessionId)
	}

	/**
	 * Clean up expired tokens from cache
	 * 清理缓存中的过期Token
	 */
	cleanupExpiredTokens(): number {
		return this.tokenManager.cleanupExpiredTokens()
	}

	/**
	 * Clear session chunks and retry info
	 * 清除会话分片和重试信息
	 */
	private clearSessionRetryInfo(sessionId: string) {
		// Clear retry timers for this session's chunks
		const sessionQueue = this.sessionQueues.get(sessionId)
		if (sessionQueue) {
			for (const chunkId of sessionQueue) {
				const timer = this.retryTimers.get(chunkId)
				if (timer) {
					clearTimeout(timer)
					this.retryTimers.delete(chunkId)
				}
				this.clearRetryCount(chunkId)
			}
		}

		// Clear active chunk retry info
		const activeChunkId = this.sessionActiveUploads.get(sessionId)
		if (activeChunkId) {
			const timer = this.retryTimers.get(activeChunkId)
			if (timer) {
				clearTimeout(timer)
				this.retryTimers.delete(activeChunkId)
			}
			this.clearRetryCount(activeChunkId)
		}
	}

	/**
	 * Dispose the uploader and cleanup resources
	 * 释放上传器并清理资源
	 */
	dispose(): void {
		// Clear all upload queues
		this.pauseAll()
		this.sessionQueues.clear()
		this.sessionActiveUploads.clear()
		this.activeUploads.clear()
		this.activeUploadIds.clear()
		this.sessionTopicMap.clear()
		this.sessionProjectMap.clear()

		// Clear all retry timers
		this.retryTimers.forEach((timer) => clearTimeout(timer))
		this.retryTimers.clear()
		this.chunkRetries.clear()

		// Unsubscribe from network monitoring
		if (this.networkUnsubscribe) {
			this.networkUnsubscribe()
			this.networkUnsubscribe = null
		}

		// Dispose token manager
		this.tokenManager.dispose()
	}
}

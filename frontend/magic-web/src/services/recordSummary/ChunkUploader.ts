import { Upload, UploadConfig as SDKUploadConfig } from "@dtyq/upload-sdk"
import type { UploadConfig, UploadEvents } from "@/types/recordSummary"
import { UploadTokenManager } from "./UploadTokenManager"
import { RecordingBatchSaveReporter } from "./RecordingBatchSaveReporter"
import { AudioChunkDB, type StoredAudioChunk } from "./MediaRecorderService/AudioChunkDB"
import { recordingLogger } from "./utils/RecordingLogger"
import { getSnowflakeUploadFileName } from "./utils/getSnowflakeUploadFileName"
import { getBusinessErrorCode, isTaskEndError } from "./RecordingErrorManager"
import { getNetworkMonitor, type NetworkMonitor } from "./NetworkMonitor"
import { WasmOpusEncoder } from "./MediaRecorderService/encoders/WasmOpusEncoder"
import { redactUploadErrorMessage } from "./utils/sanitizeUploadError"

const logger = recordingLogger.namespace("Upload:Chunk")

/** Report one upload lifecycle transition with stable fields for production correlation. */
const reportUploadLifecycle = (event: string, data: Record<string, unknown>): void => {
	logger.report({
		namespace: "recordingUploadLifecycle",
		data: { event, ...data },
	})
}

export interface SessionUploadProgress {
	total: number
	pending: number
	uploaded: number
	failed: number
	settled: boolean
	completed: boolean
}

export type UploadQueueStallReason =
	"healthy" | "pending_not_queued" | "idle_with_pending" | "stale_active_upload" | "has_failed"

export interface UploadQueueHealth {
	pending: number
	queuePending: number
	uploading: number
	completed: number
	failed: number
	totalTasks: number
	stalled: boolean
	reason: UploadQueueStallReason
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

const getUploadPathLogData = (uploadPath: string) => ({
	hasUploadPath: Boolean(uploadPath),
	isAbsoluteUrl: /^https?:\/\//i.test(uploadPath),
})
export const PLACEHOLDER_UPLOAD_CONCURRENCY = 3

let emptyOggOpusPlaceholderPromise: Promise<Blob> | null = null

interface UploadErrorDetails {
	name?: string
	message: string
	status?: number | string
	code?: string | number
	requestId?: string
}

const getUploadErrorDetails = (error: unknown): UploadErrorDetails => {
	if (error instanceof Error) {
		const candidate = error as Error & {
			status?: number | string
			code?: string | number
			requestId?: string
			request_id?: string
		}
		const statusFromMessage = error.message.match(/\bstatus\s*[:=]\s*(\d+)\b/i)?.[1]
		return {
			name: error.name,
			message: redactUploadErrorMessage(error.message || "Unknown upload error"),
			status: candidate.status ?? statusFromMessage,
			code: candidate.code,
			requestId: candidate.requestId || candidate.request_id,
		}
	}

	if (error && typeof error === "object") {
		const candidate = error as {
			name?: unknown
			message?: unknown
			status?: unknown
			code?: unknown
			requestId?: unknown
			request_id?: unknown
		}
		const message = redactUploadErrorMessage(
			typeof candidate.message === "string" ? candidate.message : "Unknown upload error",
		)
		const statusFromMessage = message.match(/\bstatus\s*[:=]\s*(\d+)\b/i)?.[1]
		return {
			name: typeof candidate.name === "string" ? candidate.name : undefined,
			message,
			status:
				typeof candidate.status === "number" || typeof candidate.status === "string"
					? candidate.status
					: statusFromMessage,
			code:
				typeof candidate.code === "number" || typeof candidate.code === "string"
					? candidate.code
					: undefined,
			requestId:
				typeof candidate.requestId === "string"
					? candidate.requestId
					: typeof candidate.request_id === "string"
						? candidate.request_id
						: undefined,
		}
	}

	return {
		message: redactUploadErrorMessage(
			typeof error === "string" ? error : "Unknown upload error",
		),
	}
}

const getUploadErrorKind = (error: unknown): string => {
	const { status, message } = getUploadErrorDetails(error)
	const normalizedStatus = String(status ?? "")
	const normalizedMessage = message.toLowerCase()
	if (normalizedStatus === "401" || normalizedStatus === "403") return "permission"
	if (
		normalizedStatus === "0" ||
		normalizedMessage.includes("network") ||
		normalizedMessage.includes("request failed") ||
		normalizedMessage.includes("timeout")
	) {
		return "network"
	}
	return "unknown"
}

const createUploadError = (error: unknown): Error => {
	const details = getUploadErrorDetails(error)
	const uploadError = new Error(`Upload failed: ${details.message}`)
	if (details.name) uploadError.name = details.name
	const numericStatus = Number(details.status)
	const numericCode = Number(details.code)
	const code =
		(Number.isFinite(numericCode) ? numericCode : undefined) ??
		(numericStatus >= 43200 && numericStatus < 43400 ? numericStatus : undefined)
	Object.assign(uploadError, {
		...(details.status !== undefined ? { status: details.status } : {}),
		...(code !== undefined ? { code } : {}),
		...(details.requestId ? { requestId: details.requestId } : {}),
	})
	return uploadError
}

const UPLOAD_PROGRESS_LOG_COOLDOWN_MS = 10_000

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

/** Encode one reusable silent Ogg/Opus artifact for failed-chunk compensation. */
async function createEmptyOggOpusPlaceholderBlob(): Promise<Blob> {
	if (!emptyOggOpusPlaceholderPromise) {
		emptyOggOpusPlaceholderPromise = (async () => {
			const encoder = new WasmOpusEncoder()
			try {
				await encoder.initialize()
				const encoded = await encoder.encode({
					pcmData: new Int16Array(320),
					sampleRate: 16_000,
					bitRate: 16,
					duration: 0.02,
				})
				return new Blob([encoded.data], { type: encoded.mimeType })
			} finally {
				await encoder.close()
			}
		})().catch((error) => {
			// Allow a later compensation attempt to retry after a transient WASM failure.
			emptyOggOpusPlaceholderPromise = null
			throw error
		})
	}

	return emptyOggOpusPlaceholderPromise
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
	private sessionCleanupRequested = new Set<string>()
	private activeUploadCancels = new Map<string, () => void>()
	private directUploadChunks = new Map<string, StoredAudioChunk>()
	private activeUploadAttempts = new Map<string, string>()
	private ignoredUploadAttempts = new Set<string>()
	private uploadAttemptSeq = 0
	private resumeLocks = new Map<string, Promise<UploadQueueHealth>>()

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
				? (sessionId: string, code?: number) => {
						return events.onTaskEnd?.(sessionId, code)
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
		const startedAt = Date.now()
		if (this.sessionCleanupRequested.has(sessionId)) {
			logger.report("忽略已清理会话的上传请求", {
				sessionId,
				topicId,
				projectId,
				reason: "session_cleanup_requested",
			})
			return
		}
		// Store topic ID mapping
		this.sessionTopicMap.set(sessionId, topicId)
		this.sessionProjectMap.set(sessionId, projectId)

		// Get all pending chunks for the session
		const pendingChunks = await this.audioChunkDB.getChunksByUploadStatus(sessionId, "pending")
		// Stop can run while IndexedDB lookup is pending; do not rebuild the queue afterward.
		if (this.sessionCleanupRequested.has(sessionId)) {
			logger.report("忽略查询期间已停止会话的上传请求", {
				sessionId,
				reason: "session_cleanup_requested",
			})
			return
		}

		// Sort by index to ensure correct order
		const sortedChunks = pendingChunks.sort((a, b) => a.index - b.index)

		logger.report("开始上传会话分片", {
			sessionId,
			pendingCount: sortedChunks.length,
			topicId,
			projectId,
			lookupDurationMs: Date.now() - startedAt,
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
		const addedChunks: StoredAudioChunk[] = []
		for (const chunk of sortedChunks) {
			const isInQueue = sessionQueue.includes(chunk.id)
			const isActive = currentActiveChunkId === chunk.id
			if (!isInQueue && !isActive) {
				sessionQueue.push(chunk.id)
				addedChunks.push(chunk)
				addedCount++
			}
		}

		if (addedCount > 0) {
			reportUploadLifecycle("session_pending_chunks_restored", {
				sessionId,
				pendingCount: addedCount,
				minChunkIndex: addedChunks[0]?.index,
				maxChunkIndex: addedChunks[addedChunks.length - 1]?.index,
				restoreSource: "indexeddb",
			})
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
		const startedAt = Date.now()
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

		let attemptId: string | undefined
		try {
			// Get chunk from IndexedDB
			const chunk = await this.audioChunkDB.get(chunkId)
			if (!chunk) {
				logger.error({
					eventKey: "indexed_db_chunk_failed",
					errorKind: "storage",
					message: `在 IndexedDB 中找不到分片 ${chunkId}`,
					context: { chunkId, sessionId, stage: "indexeddb_read" },
				})
				this.cleanupChunkRuntimeState(chunkId, sessionId)
				return
			}

			// Add to active uploads
			this.activeUploads.set(chunkId, chunk)
			attemptId = this.beginUploadAttempt(chunkId)
			if (this.getRetryCount(chunk.id) > 0) {
				reportUploadLifecycle("chunk_retry_started", {
					sessionId: chunk.sessionId,
					chunkId: chunk.id,
					chunkIndex: chunk.index,
					retryCount: this.getRetryCount(chunk.id),
					attemptId,
				})
			}
			logger.log("Audio chunk upload started", {
				sessionId: chunk.sessionId,
				chunkId: chunk.id,
				chunkIndex: chunk.index,
				size: chunk.size,
				uploadStatus: chunk.uploadStatus,
				retryCount: this.getRetryCount(chunk.id),
				queueRemaining: this.sessionQueues.get(chunk.sessionId)?.length || 0,
				activeUploads: this.activeUploads.size,
			})

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

			if (this.sessionCleanupRequested.has(sessionId)) {
				this.invalidateUploadAttempt(chunkId)
				this.releaseActiveUpload(chunkId, sessionId)
				return
			}

			const uploadUrl = await this.uploadChunk(chunk, attemptId)
			if (this.shouldIgnoreUploadAttempt(chunkId, attemptId)) {
				return
			}
			if (this.sessionCleanupRequested.has(sessionId)) {
				logger.report("Audio chunk upload completed after cleanup request", {
					sessionId,
					chunkId: chunk.id,
					chunkIndex: chunk.index,
					...getUploadPathLogData(uploadUrl),
				})
				this.releaseActiveUpload(chunkId, sessionId)
				return
			}
			logger.log("Audio chunk object upload succeeded", {
				sessionId: chunk.sessionId,
				chunkId: chunk.id,
				chunkIndex: chunk.index,
				...getUploadPathLogData(uploadUrl),
				uploadDurationMs: Date.now() - startedAt,
			})
			await this.handleUploadSuccess(chunk, uploadUrl, attemptId)
		} catch (error) {
			if (attemptId && this.shouldIgnoreUploadAttempt(chunkId, attemptId)) {
				return
			}
			if (this.sessionCleanupRequested.has(sessionId)) {
				logger.report("Audio chunk upload ignored after cleanup request", {
					sessionId,
					chunkId,
					reason: "session_cleanup_requested",
				})
				this.releaseActiveUpload(chunkId, sessionId)
				return
			}
			logger.warn("Audio chunk upload pipeline failed", {
				sessionId,
				chunkId,
				uploadDurationMs: Date.now() - startedAt,
				retryCount: this.getRetryCount(chunkId),
			})
			await this.handleUploadError(chunkId, error as Error, attemptId)
		}
	}

	/**
	 * Upload single chunk using upload SDK
	 * 使用上传SDK上传单个分片
	 */
	public async uploadChunk(chunk: StoredAudioChunk, attemptId?: string): Promise<string> {
		const uploadStartedAt = Date.now()
		// Auto-detect audio format based on data header or use default WebM
		const { mimeType, extension } = this.detectAudioFormat(chunk.chunk, chunk.mimeType)

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
		if (this.sessionCleanupRequested.has(chunk.sessionId)) {
			throw new Error("Session upload stopped")
		}
		logger.log("Audio chunk upload request started", {
			sessionId: chunk.sessionId,
			chunkId: chunk.id,
			chunkIndex: chunk.index,
			size: chunk.size,
			mimeType,
			fileName: originalFileName,
			uploadFileName,
			credentialDurationMs: Date.now() - uploadStartedAt,
		})

		return new Promise((resolve, reject) => {
			let settled = false
			const uploadTask = this.uploadInstance.upload({
				file: audioFile,
				fileName: uploadFileName,
				customCredentials,
				body: JSON.stringify({
					storage: "private",
					sts: true,
					content_type: mimeType,
				}),
			})
			if (typeof uploadTask.cancel === "function") {
				this.activeUploadCancels.set(chunk.id, uploadTask.cancel.bind(uploadTask))
			}
			// The SDK currently has no hard timeout, so guard the business queue
			// against XHRs that never call success/fail and would pin sessionActiveUploads.
			const timeout = setTimeout(() => {
				if (settled) return
				if (attemptId && this.shouldIgnoreUploadAttempt(chunk.id, attemptId)) {
					settled = true
					reject(new Error("Upload attempt superseded"))
					return
				}
				settled = true
				this.cancelActiveUpload(chunk.id, chunk.sessionId, "timeout")
				logger.warn("Audio chunk upload request timed out", {
					sessionId: chunk.sessionId,
					chunkId: chunk.id,
					chunkIndex: chunk.index,
					timeoutMs: DEFAULT_UPLOAD_TIMEOUT_MS,
					uploadDurationMs: Date.now() - uploadStartedAt,
				})
				reject(
					createUploadError(
						new Error(`Upload timed out after ${DEFAULT_UPLOAD_TIMEOUT_MS}ms`),
					),
				)
			}, DEFAULT_UPLOAD_TIMEOUT_MS)
			const settle = (callback: () => void) => {
				if (settled) return
				settled = true
				clearTimeout(timeout)
				if (!attemptId || !this.shouldIgnoreUploadAttempt(chunk.id, attemptId)) {
					this.activeUploadCancels.delete(chunk.id)
				}
				callback()
			}
			const rejectIfStaleAttempt = (): boolean => {
				if (!attemptId || !this.shouldIgnoreUploadAttempt(chunk.id, attemptId)) {
					return false
				}
				settle(() => reject(new Error("Upload attempt superseded")))
				return true
			}

			const { success, fail } = uploadTask

			success?.((res) => {
				if (rejectIfStaleAttempt()) return
				if (res?.data?.path) {
					settle(() => {
						logger.log("Audio chunk upload request completed", {
							sessionId: chunk.sessionId,
							chunkId: chunk.id,
							chunkIndex: chunk.index,
							uploadDurationMs: Date.now() - uploadStartedAt,
						})
						resolve(res.data.path)
					})
				} else {
					settle(() => {
						logger.warn("Audio chunk upload request returned no path", {
							sessionId: chunk.sessionId,
							chunkId: chunk.id,
							chunkIndex: chunk.index,
							uploadDurationMs: Date.now() - uploadStartedAt,
						})
						reject(new Error("Upload failed: No path returned"))
					})
				}
			})

			fail?.((error) => {
				if (rejectIfStaleAttempt()) return
				settle(() => {
					const details = getUploadErrorDetails(error)
					logger.report({
						namespace: "recordingUpload",
						data: {
							event: "request_failed",
							sessionId: chunk.sessionId,
							chunkId: chunk.id,
							chunkIndex: chunk.index,
							uploadDurationMs: Date.now() - uploadStartedAt,
							...details,
						},
					})
					logger.warn("Audio chunk upload request failed", {
						sessionId: chunk.sessionId,
						chunkId: chunk.id,
						chunkIndex: chunk.index,
						uploadDurationMs: Date.now() - uploadStartedAt,
					})
					reject(createUploadError(error))
				})
			})
		})
	}

	/**
	 * Detect audio format from Blob header
	 * 从Blob头部检测音频格式
	 */
	private detectAudioFormat(
		blob: Blob,
		preferredMimeType?: string,
	): { mimeType: string; extension: string } {
		// Prefer stored MIME after persistence, then fall back to Blob.type.
		const sourceMimeType = preferredMimeType || blob.type
		if (sourceMimeType) {
			const mimeType = sourceMimeType.split(";")[0]
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
			"audio/opus": "opus",
			"audio/pcm": "pcm",
		}

		// Handle codec specifications in MIME type
		const baseMimeType = mimeType.split(";")[0]
		// The recording contract uses Ogg pages with Opus packets, so an Ogg MIME
		// value must be uploaded with the backend's `.opus` extension.
		if (baseMimeType === "audio/ogg") return "opus"
		return mimeToExt[baseMimeType] || "webm"
	}

	/**
	 * Handle successful upload
	 * 处理上传成功
	 */
	private async handleUploadSuccess(
		chunk: StoredAudioChunk,
		uploadUrl: string,
		attemptId?: string,
	): Promise<void> {
		if (attemptId && this.shouldIgnoreUploadAttempt(chunk.id, attemptId)) {
			logger.report("Ignore stale upload success callback", {
				sessionId: chunk.sessionId,
				chunkId: chunk.id,
				attemptId,
			})
			return
		}

		if (this.sessionCleanupRequested.has(chunk.sessionId)) {
			logger.report("忽略取消后的分片成功回调", {
				sessionId: chunk.sessionId,
				chunkId: chunk.id,
				chunkIndex: chunk.index,
				reason: "session_cleanup_requested",
			})
			this.releaseActiveUpload(chunk.id, chunk.sessionId)
			return
		}

		await this.reportUploadedChunk(chunk, uploadUrl, { requireBatchSave: true })

		if (attemptId && this.shouldIgnoreUploadAttempt(chunk.id, attemptId)) {
			logger.report("Ignore stale upload after batch save", {
				sessionId: chunk.sessionId,
				chunkId: chunk.id,
				attemptId,
			})
			return
		}

		if (this.sessionCleanupRequested.has(chunk.sessionId)) {
			logger.report("分片 BatchSave 后检测到会话已清理", {
				sessionId: chunk.sessionId,
				chunkId: chunk.id,
				chunkIndex: chunk.index,
				reason: "session_cleanup_requested",
			})
			this.releaseActiveUpload(chunk.id, chunk.sessionId)
			return
		}

		// Mark chunk as uploaded (keep data in IndexedDB for export)
		try {
			await this.audioChunkDB.updateChunkUploadStatus(chunk.id, "uploaded")
			logger.log("Audio chunk upload status completed", {
				sessionId: chunk.sessionId,
				chunkId: chunk.id,
				chunkIndex: chunk.index,
				uploadStatus: "uploaded",
				...getUploadPathLogData(uploadUrl),
			})
		} catch (error) {
			logger.error({
				eventKey: "update_chunk_status_failed",
				errorKind: "unknown",
				error: error,
				message: `Failed to update chunk status ${chunk.id}:`,
			})
		}

		this.cleanupChunkRuntimeState(chunk.id, chunk.sessionId)

		// Clear retry count on success
		this.clearRetryCount(chunk.id)

		// Sampling: log every 10 chunks for upload progress monitoring
		// Full traceability is handled by BatchSaveReporter's report log
		if (chunk.index % 10 === 0) {
			logger.report("分片上传成功", {
				chunkId: chunk.id,
				chunkIndex: chunk.index,
				chunkSize: chunk.size,
				...getUploadPathLogData(uploadUrl),
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
		// Batch-save belongs to the sandbox task, so use the sandbox topic returned by upload-tokens.
		// Keep the request topic as a fallback for older cached token responses.
		const topicId =
			this.tokenManager.getSandboxTopicId(chunk.sessionId) ||
			this.sessionTopicMap.get(chunk.sessionId) ||
			""
		const projectId = this.sessionProjectMap.get(chunk.sessionId) || ""
		const hiddenDirectory = this.tokenManager.getDirectories(chunk.sessionId)?.asr_hidden_dir
		const sandboxTaskId = this.tokenManager.getSandboxTaskId(chunk.sessionId) || ""
		const fileName = this.getChunkFileName(chunk)

		if (!projectId || !topicId || !hiddenDirectory?.directory_id) {
			if (options.requireBatchSave) {
				logger.error({
					eventKey: "audio_chunk_batch_save_context_missing",
					errorKind: "invalid_state",
					message: "Audio chunk batch save context is missing",
					context: {
						sessionId: chunk.sessionId,
						chunkId: chunk.id,
						chunkIndex: chunk.index,
						projectId,
						topicId,
						parentId: hiddenDirectory?.directory_id,
					},
				})
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
			taskId: sandboxTaskId,
			parentId: hiddenDirectory.directory_id,
			fileKey: uploadUrl,
			fileName,
			fileSize: chunk.size,
		}

		if (options.requireBatchSave) {
			logger.log("Audio chunk batch save started", {
				sessionId: chunk.sessionId,
				chunkId: chunk.id,
				chunkIndex: chunk.index,
				...getUploadPathLogData(uploadUrl),
				fileName,
				fileSize: chunk.size,
			})
			await this.batchSaveReporter.reportUploadedFileStrict(reportFile)
			logger.log("Audio chunk batch save completed", {
				sessionId: chunk.sessionId,
				chunkId: chunk.id,
				chunkIndex: chunk.index,
				...getUploadPathLogData(uploadUrl),
				fileName,
				fileSize: chunk.size,
			})
			return
		}

		await this.batchSaveReporter.reportUploadedFile(reportFile)
	}

	private getChunkFileName(chunk: StoredAudioChunk): string {
		const { extension } = this.detectAudioFormat(chunk.chunk, chunk.mimeType)
		return `${chunk.index}.${extension}`
	}

	/**
	 * Handle upload error with exponential backoff retry logic
	 * 处理上传错误（包含指数退避重试逻辑）
	 */
	private async handleUploadError(
		chunkId: string,
		error: Error,
		attemptId?: string,
	): Promise<void> {
		if (attemptId && this.shouldIgnoreUploadAttempt(chunkId, attemptId)) {
			logger.report("Ignore stale upload failure callback", {
				chunkId,
				attemptId,
			})
			return
		}

		const activeSessionId = this.activeUploads.get(chunkId)?.sessionId
		if (activeSessionId && this.sessionCleanupRequested.has(activeSessionId)) {
			this.releaseActiveUpload(chunkId, activeSessionId)
			return
		}

		// Get chunk from IndexedDB first to have context
		const chunk = await this.audioChunkDB.get(chunkId)
		if (!chunk) {
			logger.error({
				eventKey: "process_chunk_failed",
				errorKind: "storage",
				error: new Error(getUploadErrorDetails(error).message),
				message: "错误处理过程中找不到分片",
				context: {
					chunkId,
					sessionId: activeSessionId,
					...getUploadErrorDetails(error),
				},
			})
			this.clearRetryCount(chunkId)
			this.cleanupChunkRuntimeState(chunkId, activeSessionId)
			return
		}

		if (this.sessionCleanupRequested.has(chunk.sessionId)) {
			this.releaseActiveUpload(chunkId, chunk.sessionId)
			return
		}

		const retryCount = this.getRetryCount(chunkId)

		logger.error({
			eventKey: "chunk_upload_failed",
			errorKind: getUploadErrorKind(error),
			error: new Error(getUploadErrorDetails(error).message),
			message: "分片上传失败",
			context: {
				chunkId,
				sessionId: chunk.sessionId,
				chunkIndex: chunk.index,
				retryCount,
				...getUploadErrorDetails(error),
			},
		})

		// Check if error is task end error (code 43200)
		// 检查是否为任务结束错误
		if (isTaskEndError(error)) {
			logger.warn("任务已结束，停止上传分片", {
				chunkId,
			})
			this.clearRetryCount(chunkId)
			this.cleanupChunkRuntimeState(chunkId, chunk.sessionId)
			this.sessionQueues.delete(chunk.sessionId)
			void this.events.onTaskEnd?.(chunk.sessionId, getBusinessErrorCode(error))
			return
		}

		// Check if max retries exceeded
		if (this.hasExceededMaxRetries(chunkId)) {
			logger.error({
				eventKey: "chunk_retry_failed",
				errorKind: "unknown",
				message: `分片 ${chunkId} 已达到最大重试次数 ${this.config.maxRetryCount}`,
				context: { chunkIndex: chunk.index, sessionId: chunk.sessionId },
			})

			this.clearRetryCount(chunkId)
			this.cleanupChunkRuntimeState(chunkId, chunk.sessionId)

			try {
				await this.audioChunkDB.updateChunkUploadStatus(chunkId, "failed")
			} catch (error) {
				logger.error({
					eventKey: "mark_chunk_as_failed",
					errorKind: "unknown",
					error: error,
					message: `Failed to mark chunk ${chunkId} as failed:`,
				})
			}

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
					logger.error({
						eventKey: "refresh_token_failed",
						errorKind: "permission",
						error: new Error(getUploadErrorDetails(refreshError).message),
						message: `认证错误后刷新令牌失败：`,
					})
				})
		}

		if (this.sessionCleanupRequested.has(chunk.sessionId)) {
			this.releaseActiveUpload(chunkId, chunk.sessionId)
			return
		}

		// Increment retry count
		const newRetryCount = this.incrementRetryCount(chunkId)

		// Calculate retry delay with exponential backoff
		const retryDelay = this.calculateRetryDelay(newRetryCount - 1)

		reportUploadLifecycle("chunk_retry_scheduled", {
			sessionId: chunk.sessionId,
			chunkId,
			chunkIndex: chunk.index,
			retryCount: newRetryCount,
			retryDelayMs: retryDelay,
			maxRetries: this.config.maxRetryCount,
			errorStatus: getUploadErrorDetails(error).status,
			errorKind: getUploadErrorKind(error),
		})

		this.cleanupChunkRuntimeState(chunkId, chunk.sessionId)

		// Add back to front of session queue for priority retry
		const sessionQueue = this.sessionQueues.get(chunk.sessionId)
		if (sessionQueue) {
			sessionQueue.unshift(chunkId)
		} else {
			// If session queue doesn't exist, create it
			this.sessionQueues.set(chunk.sessionId, [chunkId])
		}

		// Emit error event
		this.events.onError?.(chunkId, createUploadError(error))
		this.events.onRetry?.(chunkId, newRetryCount)

		// Schedule retry with exponential backoff
		const timer = setTimeout(() => {
			this.retryTimers.delete(chunkId)
			if (this.sessionCleanupRequested.has(chunk.sessionId)) return
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
			const errorMessage = getUploadErrorDetails(error).message
			logger.error({
				eventKey: "get_session_upload_failed",
				errorKind: "unknown",
				error: new Error(errorMessage),
				message: `获取会话 ${sessionId} 上传凭证失败：`,
			})
			const uploadError = createUploadError(error) as Error & { sessionId?: string }
			// Preserve the existing caller-facing message while retaining terminal-error metadata.
			uploadError.message = `Failed to get upload credentials: ${errorMessage}`
			if (!uploadError.sessionId) uploadError.sessionId = sessionId
			throw uploadError
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

	async inspectQueueHealth(sessionId: string): Promise<UploadQueueHealth> {
		const status = await this.getQueueStatus(sessionId)
		const activeChunkId = this.sessionActiveUploads.get(sessionId) || null
		const hasRetryTimer = this.hasSessionRetryTimer(sessionId)
		const isActiveMissing =
			Boolean(activeChunkId) &&
			!this.activeUploadIds.has(activeChunkId!) &&
			!this.activeUploads.has(activeChunkId!)

		let reason: UploadQueueStallReason = "healthy"
		if (isActiveMissing) reason = "stale_active_upload"
		else if (
			status.pending > 0 &&
			!activeChunkId &&
			status.queuePending === 0 &&
			!hasRetryTimer
		)
			reason = "pending_not_queued"
		else if (status.pending > 0 && !activeChunkId && !hasRetryTimer)
			reason = "idle_with_pending"
		else if (status.failed > 0 && status.pending === 0 && !activeChunkId && !hasRetryTimer)
			reason = "has_failed"

		return {
			pending: status.pending,
			queuePending: status.queuePending ?? 0,
			uploading: status.uploading,
			completed: status.completed,
			failed: status.failed,
			totalTasks: status.totalTasks,
			stalled: reason !== "healthy",
			reason,
		}
	}

	async resumeStalledSessionUploads(
		sessionId: string,
		topicId: string,
		projectId: string = "",
		options: { force?: boolean } = {},
	): Promise<UploadQueueHealth> {
		const pendingResume = this.resumeLocks.get(sessionId)
		if (pendingResume) return pendingResume

		const resumeTask = this.runResumeStalledSessionUploads(
			sessionId,
			topicId,
			projectId,
			options,
		)
		this.resumeLocks.set(sessionId, resumeTask)
		try {
			return await resumeTask
		} finally {
			if (this.resumeLocks.get(sessionId) === resumeTask) {
				this.resumeLocks.delete(sessionId)
			}
		}
	}

	private async runResumeStalledSessionUploads(
		sessionId: string,
		topicId: string,
		projectId: string,
		options: { force?: boolean },
	): Promise<UploadQueueHealth> {
		const health = await this.inspectQueueHealth(sessionId)
		if (this.sessionCleanupRequested.has(sessionId)) {
			logger.report("Skip resume for cleaned-up session", { sessionId, ...health })
			return health
		}

		const shouldUnblock = Boolean(options.force) || health.stalled
		if (!shouldUnblock) {
			await this.uploadSession(sessionId, topicId, projectId)
			return health
		}

		logger.report("Resuming stalled session uploads", {
			sessionId,
			topicId,
			projectId,
			force: Boolean(options.force),
			...health,
		})

		// Recheck cleanup after inspect so cancel can win the race.
		if (this.sessionCleanupRequested.has(sessionId)) {
			logger.report("Skip resume after cleanup during inspect", { sessionId })
			return health
		}

		const activeChunkId = this.sessionActiveUploads.get(sessionId)
		if (activeChunkId) {
			// Invalidate first so late SDK callbacks cannot mutate state.
			this.invalidateUploadAttempt(activeChunkId)
			this.cancelActiveUpload(activeChunkId, sessionId, "user_retry")
			this.releaseActiveUpload(activeChunkId, sessionId)
		}
		this.clearSessionRetryInfo(sessionId)

		if (this.sessionCleanupRequested.has(sessionId)) return health

		if (health.failed > 0) {
			await this.retryFailedChunks(sessionId, topicId, projectId)
		}

		await this.uploadSession(sessionId, topicId, projectId)
		return health
	}

	private hasSessionRetryTimer(sessionId: string): boolean {
		const queue = this.sessionQueues.get(sessionId) ?? []
		const activeChunkId = this.sessionActiveUploads.get(sessionId)
		const chunkIds = activeChunkId ? [...queue, activeChunkId] : queue
		return chunkIds.some((chunkId) => this.retryTimers.has(chunkId))
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
			let lastProgressSignature: string | null = null
			let lastProgressLogTimestamp = 0
			const cleanup = () => {
				if (timers.interval) clearInterval(timers.interval)
				if (timers.timeout) clearTimeout(timers.timeout)
			}
			const checkProgress = async () => {
				try {
					const progress = await this.audioChunkDB.getSessionUploadProgress(sessionId)
					const progressSignature = `${progress.pending}:${progress.uploaded}:${progress.failed}`
					const now = Date.now()
					if (
						progressSignature !== lastProgressSignature ||
						now - lastProgressLogTimestamp >= UPLOAD_PROGRESS_LOG_COOLDOWN_MS
					) {
						logger.log(`会话 ${sessionId} 上传进度：`, progress)
						lastProgressSignature = progressSignature
						lastProgressLogTimestamp = now
					}

					if (progress.completed) {
						cleanup()
						resolve(true)
					}
				} catch (error) {
					logger.error({
						eventKey: "check_upload_failed",
						errorKind: "unknown",
						error: error,
						message: `检查上传进度时出错：`,
					})
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
			let lastProgressSignature: string | null = null
			let lastProgressLogTimestamp = 0
			const cleanup = () => {
				if (timers.interval) clearInterval(timers.interval)
				if (timers.timeout) clearTimeout(timers.timeout)
			}
			const checkProgress = async () => {
				try {
					const progress = await this.audioChunkDB.getSessionUploadProgress(sessionId)
					const progressSignature = `${progress.pending}:${progress.uploaded}:${progress.failed}`
					const now = Date.now()
					if (
						progressSignature !== lastProgressSignature ||
						now - lastProgressLogTimestamp >= UPLOAD_PROGRESS_LOG_COOLDOWN_MS
					) {
						logger.log(`会话 ${sessionId} 上传终态进度：`, progress)
						lastProgressSignature = progressSignature
						lastProgressLogTimestamp = now
					}
					onProgress?.(progress)

					if (progress.settled) {
						cleanup()
						resolve(progress)
					}
				} catch (error) {
					logger.error({
						eventKey: "check_upload_failed",
						errorKind: "unknown",
						error: error,
						message: `检查上传终态进度时出错：`,
					})
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
		if (this.sessionCleanupRequested.has(sessionId)) {
			logger.report("忽略已停止会话的失败分片重试", {
				sessionId,
				reason: "session_cleanup_requested",
			})
			return 0
		}

		const failedChunks = await this.audioChunkDB.getChunksByUploadStatus(sessionId, "failed")
		// Stop can interleave with the lookup, so check again before changing persisted status.
		if (this.sessionCleanupRequested.has(sessionId)) return 0
		for (const chunk of failedChunks) {
			if (this.sessionCleanupRequested.has(sessionId)) return 0
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
		if (this.sessionCleanupRequested.has(sessionId)) {
			logger.report("忽略已停止会话的占位分片上传", {
				sessionId,
				reason: "session_cleanup_requested",
			})
			return 0
		}

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
		// Do not restore upload context after a stop that raced with the IndexedDB lookup.
		if (this.sessionCleanupRequested.has(sessionId)) return 0

		this.sessionTopicMap.set(sessionId, topicId)
		this.sessionProjectMap.set(sessionId, projectId)

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
	clearSessionChunks(sessionId: string, reason: string = "session_cleanup"): Promise<void> {
		const queueLength = this.sessionQueues.get(sessionId)?.length || 0
		const activeChunkId = this.sessionActiveUploads.get(sessionId) || null
		this.stopSessionUploads(sessionId, reason, true)

		return this.audioChunkDB
			.deletePendingSessionChunks(sessionId)
			.then(async () => {
				const progress = await this.audioChunkDB.getSessionUploadProgress(sessionId)
				logger.log("Audio chunk cleanup completed", {
					sessionId,
					queueLength,
					activeChunkId,
					remainingChunks: progress.total,
					remainingPending: progress.pending,
				})
			})
			.catch((error) => {
				logger.error({
					eventKey: "audio_chunk_cleanup_failed",
					errorKind: "storage",
					error,
					message: "Failed to clear pending audio chunks",
					context: { sessionId, queueLength, activeChunkId },
				})
				throw error
			})
	}

	private beginUploadAttempt(chunkId: string): string {
		const previousAttemptId = this.activeUploadAttempts.get(chunkId)
		if (previousAttemptId) this.ignoredUploadAttempts.add(previousAttemptId)
		const attemptId = `${chunkId}:${++this.uploadAttemptSeq}`
		this.activeUploadAttempts.set(chunkId, attemptId)
		return attemptId
	}

	private invalidateUploadAttempt(chunkId: string): void {
		const attemptId = this.activeUploadAttempts.get(chunkId)
		if (!attemptId) return
		this.ignoredUploadAttempts.add(attemptId)
		this.activeUploadAttempts.delete(chunkId)
	}

	private shouldIgnoreUploadAttempt(chunkId: string, attemptId: string): boolean {
		if (this.ignoredUploadAttempts.has(attemptId)) return true
		return this.activeUploadAttempts.get(chunkId) !== attemptId
	}

	private cleanupChunkRuntimeState(chunkId: string, sessionId?: string): void {
		const attemptId = this.activeUploadAttempts.get(chunkId)
		if (attemptId) {
			this.ignoredUploadAttempts.delete(attemptId)
			this.activeUploadAttempts.delete(chunkId)
		}
		const retryTimer = this.retryTimers.get(chunkId)
		if (retryTimer) {
			clearTimeout(retryTimer)
			this.retryTimers.delete(chunkId)
		}
		this.activeUploads.delete(chunkId)
		this.activeUploadIds.delete(chunkId)
		this.activeUploadCancels.delete(chunkId)
		if (sessionId) {
			if (this.sessionActiveUploads.get(sessionId) === chunkId) {
				this.sessionActiveUploads.delete(sessionId)
			}
			return
		}
		const activeEntries = Array.from(this.sessionActiveUploads.entries())
		for (let i = 0; i < activeEntries.length; i++) {
			const [activeSessionId, activeChunkId] = activeEntries[i]
			if (activeChunkId === chunkId) {
				this.sessionActiveUploads.delete(activeSessionId)
				break
			}
		}
	}

	private releaseActiveUpload(chunkId: string, sessionId: string): void {
		this.cleanupChunkRuntimeState(chunkId, sessionId)
	}

	private cancelActiveUpload(chunkId: string, sessionId: string, reason: string): void {
		const cancel = this.activeUploadCancels.get(chunkId)
		if (!cancel) return

		try {
			cancel()
		} catch (error) {
			logger.warn("取消上传请求失败", {
				sessionId,
				chunkId,
				reason,
				errorName: error instanceof Error ? error.name : "unknown",
			})
		} finally {
			this.activeUploadCancels.delete(chunkId)
		}
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

	/** Create a valid placeholder artifact matching the failed chunk's persisted format. */
	private async createEmptyAudioPlaceholderBlob(chunk: StoredAudioChunk): Promise<Blob> {
		const mimeType = (chunk.mimeType || chunk.chunk.type || "audio/wav").split(";")[0]
		if (mimeType === "audio/wav") {
			return this.createEmptyWavBlob()
		}
		if (mimeType === "audio/pcm") {
			return new Blob([], { type: "audio/pcm" })
		}
		if (mimeType === "audio/ogg" || mimeType === "audio/opus") {
			return createEmptyOggOpusPlaceholderBlob()
		}

		throw new Error(`Unsupported placeholder audio format: ${mimeType}`)
	}

	private async uploadEmptyPlaceholderChunk(
		chunk: StoredAudioChunk,
		abortState: PlaceholderUploadAbortState,
	): Promise<void> {
		this.throwIfPlaceholderUploadAborted(abortState)
		const placeholderBlob = await this.createEmptyAudioPlaceholderBlob(chunk)
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
		if (this.sessionCleanupRequested.has(chunk.sessionId)) {
			throw new Error("Session upload stopped")
		}
		await this.racePlaceholderUploadWithAbort(
			this.reportUploadedChunk(placeholderChunk, uploadUrl, { requireBatchSave: true }),
			abortState,
		)
		if (this.sessionCleanupRequested.has(chunk.sessionId)) {
			throw new Error("Session upload stopped")
		}
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
		for (const chunk of this.directUploadChunks.values()) {
			this.invalidateUploadAttempt(chunk.id)
			this.cancelActiveUpload(chunk.id, chunk.sessionId, "pause_all")
			this.cleanupChunkRuntimeState(chunk.id, chunk.sessionId)
			this.directUploadChunks.delete(chunk.id)
		}

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
		this.activeUploadCancels.clear()
		this.activeUploadAttempts.clear()
		this.ignoredUploadAttempts.clear()
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
			logger.error({
				eventKey: "refresh_session_token_failed",
				errorKind: "permission",
				error: new Error(getUploadErrorDetails(error).message),
				message: `刷新会话 ${sessionId} 令牌失败：`,
			})
			throw createUploadError(error)
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

		for (const chunk of this.directUploadChunks.values()) {
			if (chunk.sessionId !== sessionId) continue
			const timer = this.retryTimers.get(chunk.id)
			if (timer) {
				clearTimeout(timer)
				this.retryTimers.delete(chunk.id)
			}
			this.clearRetryCount(chunk.id)
		}
	}

	/**
	 * Stop a session's queue while preserving IndexedDB chunks for export.
	 * 服务端结束任务时停止后续上传，但保留 IndexedDB 分片供导出。
	 */
	stopSessionUploads(
		sessionId: string,
		reason: string = "session_stop",
		clearIndexedDB = false,
	): void {
		this.sessionCleanupRequested.add(sessionId)
		const sessionQueue = this.sessionQueues.get(sessionId) ?? []
		const queueLength = sessionQueue.length
		const activeChunkId = this.sessionActiveUploads.get(sessionId) || null
		const directChunkIds = Array.from(this.directUploadChunks.values())
			.filter((chunk) => chunk.sessionId === sessionId)
			.map((chunk) => chunk.id)
		reportUploadLifecycle("session_upload_cleanup", {
			sessionId,
			reason,
			queueLength,
			activeChunkId,
			retryTimerCount: this.countSessionRetryTimers(sessionId),
			clearIndexedDB,
		})
		for (const chunkId of [
			...new Set([
				...sessionQueue,
				...(activeChunkId ? [activeChunkId] : []),
				...directChunkIds,
			]),
		]) {
			const activeChunk = this.activeUploads.get(chunkId)
			reportUploadLifecycle("chunk_removed_from_queue", {
				sessionId,
				chunkId,
				chunkIndex: activeChunk?.index ?? null,
				reason,
				queueState: chunkId === activeChunkId ? "active" : "queued",
				uploadStatus: activeChunk?.uploadStatus ?? null,
			})
		}
		if (activeChunkId) {
			this.invalidateUploadAttempt(activeChunkId)
			this.cancelActiveUpload(activeChunkId, sessionId, reason)
		}
		for (const chunkId of directChunkIds) {
			this.invalidateUploadAttempt(chunkId)
			this.cancelActiveUpload(chunkId, sessionId, reason)
			this.cleanupChunkRuntimeState(chunkId, sessionId)
			this.directUploadChunks.delete(chunkId)
		}
		this.clearSessionRetryInfo(sessionId)
		if (activeChunkId) {
			// Invalidate and release runtime state before late SDK callbacks can run.
			this.cleanupChunkRuntimeState(activeChunkId, sessionId)
		}
		this.sessionQueues.delete(sessionId)
		this.sessionTopicMap.delete(sessionId)
		this.sessionProjectMap.delete(sessionId)
		logger.report("停止会话分片上传但保留本地数据", {
			sessionId,
			queueLength,
			activeChunkId,
			reason,
		})
	}

	/** Count pending retry timers for one session before cleanup removes them. */
	private countSessionRetryTimers(sessionId: string): number {
		const queue = this.sessionQueues.get(sessionId) ?? []
		const activeChunkId = this.sessionActiveUploads.get(sessionId)
		const chunkIds = activeChunkId ? [...queue, activeChunkId] : queue
		const directChunkIds = Array.from(this.directUploadChunks.values())
			.filter((chunk) => chunk.sessionId === sessionId)
			.map((chunk) => chunk.id)
		return [...new Set([...chunkIds, ...directChunkIds])].filter((chunkId) =>
			this.retryTimers.has(chunkId),
		).length
	}

	/** Upload a non-persisted chunk and still register it in the workspace directory. */
	async uploadChunkAndSave(chunk: StoredAudioChunk): Promise<void> {
		if (this.sessionCleanupRequested.has(chunk.sessionId)) return
		this.directUploadChunks.set(chunk.id, chunk)
		await this.runDirectUpload(chunk)
	}

	/** Upload a non-persisted chunk through the same retry and cleanup lifecycle as queued work. */
	private async runDirectUpload(chunk: StoredAudioChunk): Promise<void> {
		if (this.sessionCleanupRequested.has(chunk.sessionId)) return

		const attemptId = this.beginUploadAttempt(chunk.id)
		this.activeUploads.set(chunk.id, chunk)
		this.activeUploadIds.add(chunk.id)
		if (this.getRetryCount(chunk.id) > 0) {
			reportUploadLifecycle("chunk_retry_started", {
				sessionId: chunk.sessionId,
				chunkId: chunk.id,
				chunkIndex: chunk.index,
				retryCount: this.getRetryCount(chunk.id),
				attemptId,
			})
		}

		try {
			const uploadUrl = await this.uploadChunk(chunk, attemptId)
			if (
				this.shouldIgnoreUploadAttempt(chunk.id, attemptId) ||
				this.sessionCleanupRequested.has(chunk.sessionId)
			) {
				return
			}
			await this.reportUploadedChunk(chunk, uploadUrl, { requireBatchSave: true })
			this.cleanupChunkRuntimeState(chunk.id, chunk.sessionId)
			this.clearRetryCount(chunk.id)
			this.directUploadChunks.delete(chunk.id)
		} catch (error) {
			if (
				this.shouldIgnoreUploadAttempt(chunk.id, attemptId) ||
				this.sessionCleanupRequested.has(chunk.sessionId)
			) {
				return
			}

			const currentRetryCount = this.getRetryCount(chunk.id)
			if (currentRetryCount >= this.config.maxRetryCount) {
				logger.error({
					eventKey: "direct_chunk_upload_failed",
					errorKind: getUploadErrorKind(error),
					error,
					message: "IndexedDB fallback chunk upload failed after max retries",
					context: {
						sessionId: chunk.sessionId,
						chunkId: chunk.id,
						chunkIndex: chunk.index,
						persisted: false,
						retryCount: currentRetryCount,
					},
				})
				this.cleanupChunkRuntimeState(chunk.id, chunk.sessionId)
				this.directUploadChunks.delete(chunk.id)
				this.clearRetryCount(chunk.id)
				return
			}

			const retryCount = this.incrementRetryCount(chunk.id)
			const retryDelay = this.calculateRetryDelay(retryCount - 1)
			reportUploadLifecycle("chunk_retry_scheduled", {
				sessionId: chunk.sessionId,
				chunkId: chunk.id,
				chunkIndex: chunk.index,
				retryCount,
				retryDelayMs: retryDelay,
				maxRetries: this.config.maxRetryCount,
				errorStatus: getUploadErrorDetails(error).status,
				errorKind: getUploadErrorKind(error),
			})
			this.cleanupChunkRuntimeState(chunk.id, chunk.sessionId)
			const timer = setTimeout(() => {
				this.retryTimers.delete(chunk.id)
				if (this.sessionCleanupRequested.has(chunk.sessionId)) return
				void this.runDirectUpload(chunk)
			}, retryDelay)
			this.retryTimers.set(chunk.id, timer)
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
		this.activeUploadAttempts.clear()
		this.ignoredUploadAttempts.clear()
		this.directUploadChunks.clear()
		this.sessionTopicMap.clear()
		this.sessionProjectMap.clear()
		this.sessionCleanupRequested.clear()

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

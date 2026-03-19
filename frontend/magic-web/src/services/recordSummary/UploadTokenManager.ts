import { UploadConfig as SDKUploadConfig } from "@dtyq/upload-sdk"
import { RecordingSummaryType } from "@/apis/modules/superMagic/recordSummary"
import { SuperMagicApi } from "@/apis"
import { RecordingDirectories, PresetFiles } from "@/types/recordSummary"
import {
	defaultErrorManager,
	isTaskEndError,
	createTaskEndError,
	type TaskEndError,
} from "./RecordingErrorManager"
import { recordingLogger } from "./utils/RecordingLogger"

const logger = recordingLogger.namespace("Upload:Token")

/**
 * Token cache entry interface
 * Token缓存条目接口
 */
interface TokenCacheEntry {
	token: SDKUploadConfig["customCredentials"]
	expiresAt: number // 过期时间戳（毫秒）
	refreshAt: number // 提前刷新时间戳（毫秒）
	isRefreshing: boolean // 是否正在刷新
	directories?: RecordingDirectories // 录音目录信息
	presetFiles?: PresetFiles // 预设文件信息
}

/**
 * Token refresh configuration
 * Token刷新配置
 */
interface TokenRefreshConfig {
	/** 提前刷新时间（秒），默认10分钟 */
	refreshBeforeExpiry: number
	/** Token有效期最小值（秒），如果API返回的过期时间小于此值会被拒绝，默认10分钟 */
	minValidDuration: number
	/** 刷新重试次数，默认3次 */
	maxRetries: number
	/** 刷新重试间隔（毫秒），默认1秒 */
	retryInterval: number
}

/**
 * Callback for task end event
 * 任务结束回调
 */
export interface TaskEndCallback {
	/** 当任务结束时调用，参数为 sessionId */
	(sessionId: string): void
}

/**
 * Upload token manager with caching and proactive refresh
 * 上传Token管理器，支持缓存和主动刷新
 */
export class UploadTokenManager {
	private tokenCache = new Map<string, TokenCacheEntry>()
	private refreshPromises = new Map<string, Promise<SDKUploadConfig["customCredentials"]>>()
	private sessionTopicMap = new Map<string, string>() // sessionId -> topicId mapping
	private refreshConfig: TokenRefreshConfig
	private onTaskEnd?: TaskEndCallback

	constructor(config: Partial<TokenRefreshConfig> = {}, onTaskEnd?: TaskEndCallback) {
		this.refreshConfig = {
			refreshBeforeExpiry: 600, // 10 minutes - earlier refresh for better reliability
			minValidDuration: 600, // 10 minutes
			maxRetries: 3,
			retryInterval: 1000,
			...config,
		}
		this.onTaskEnd = onTaskEnd

		logger.log("Token管理器初始化", {
			refreshBeforeExpiry: this.refreshConfig.refreshBeforeExpiry + "秒",
			minValidDuration: this.refreshConfig.minValidDuration + "秒",
			maxRetries: this.refreshConfig.maxRetries,
			hasTaskEndCallback: !!onTaskEnd,
		})
	}

	/**
	 * Get upload token with caching and refresh mechanism
	 * 获取上传Token（支持缓存和刷新机制）
	 */
	async getToken(
		sessionId: string,
		topicId: string,
	): Promise<SDKUploadConfig["customCredentials"]> {
		logger.log("开始获取Token", {
			sessionId,
			topicId,
		})

		// Store topic ID mapping
		this.sessionTopicMap.set(sessionId, topicId)

		const cacheKey = sessionId
		const cachedEntry = this.tokenCache.get(cacheKey)
		const now = Date.now()

		// Check if we have a valid cached token
		if (cachedEntry && now < cachedEntry.expiresAt) {
			const timeToExpiry = Math.round((cachedEntry.expiresAt - now) / 1000)
			const timeToRefresh = Math.round((cachedEntry.refreshAt - now) / 1000)

			logger.log("Token缓存命中", {
				timeToExpiry: timeToExpiry + "秒",
				timeToRefresh: timeToRefresh + "秒",
				isRefreshing: cachedEntry.isRefreshing,
			})

			// Check if we need to proactively refresh
			if (now >= cachedEntry.refreshAt && !cachedEntry.isRefreshing) {
				logger.report("触发Token后台刷新", {
					sessionId,
					timeToExpiry: timeToExpiry + "秒",
				})

				// Start background refresh without waiting
				this.refreshTokenInBackground(sessionId, cacheKey)
			}

			return cachedEntry.token
		}

		logger.log("Token缓存未命中，获取新Token", {
			sessionId,
			topicId,
			reason: cachedEntry ? "已过期" : "无缓存",
		})

		// No valid cache, fetch new token
		return this.fetchAndCacheToken(sessionId, cacheKey, topicId)
	}

	/**
	 * Fetch new token and update cache
	 * 获取新Token并更新缓存
	 */
	private async fetchAndCacheToken(
		sessionId: string,
		cacheKey: string,
		topicId: string,
	): Promise<SDKUploadConfig["customCredentials"]> {
		// Check if there's already a refresh in progress for this key
		const existingPromise = this.refreshPromises.get(cacheKey)
		if (existingPromise) {
			logger.log("等待进行中的Token请求", {
				sessionId,
			})
			return existingPromise
		}

		logger.log("发起新的Token请求", {
			sessionId,
			topicId,
		})

		const refreshPromise = this.performTokenFetch(sessionId, cacheKey, topicId)
		this.refreshPromises.set(cacheKey, refreshPromise)

		try {
			const token = await refreshPromise
			logger.report("Token请求完成", {
				sessionId,
			})
			return token
		} catch (error) {
			logger.error("Token请求失败", {
				sessionId,
				error: error instanceof Error ? error.message : String(error),
			})
			throw error
		} finally {
			this.refreshPromises.delete(cacheKey)
		}
	}

	/**
	 * Perform actual token fetch with retry mechanism
	 * 执行实际的Token获取（带重试机制）
	 */
	private async performTokenFetch(
		sessionId: string,
		cacheKey: string,
		topicId: string,
		retryCount: number = 0,
	): Promise<SDKUploadConfig["customCredentials"]> {
		try {
			logger.log("调用Token API", {
				sessionId,
				topicId,
				retryCount,
			})

			const response = await SuperMagicApi.getRecordingSummaryUploadToken({
				task_key: sessionId,
				topic_id: topicId,
				type: RecordingSummaryType.FrontendRecording,
			})

			// Validate response
			if (!response.sts_token || !response.expires_in) {
				throw new Error("Invalid token response: missing sts_token or expires_in")
			}

			// Check if token has sufficient validity duration
			if (response.expires_in < this.refreshConfig.minValidDuration) {
				logger.warn("Token有效期低于最小要求", {
					sessionId,
					validityDuration: response.expires_in + "秒",
					minRequired: this.refreshConfig.minValidDuration + "秒",
				})
			}

			const now = Date.now()
			const expiresAt = now + response.expires_in * 1000
			const idealRefreshAt =
				now + (response.expires_in - this.refreshConfig.refreshBeforeExpiry) * 1000

			// Calculate refresh time with proper safety margins
			// For short-lived tokens (< 2 minutes), use proportional buffer (1/3 of validity)
			// For longer tokens, use fixed 60-second buffer
			const safetyBuffer = response.expires_in < 120 ? response.expires_in * 333 : 60000 // 333ms per second ≈ 1/3
			const minRefreshTime = now + Math.min(60000, safetyBuffer) // At least 1 minute from now, or less for very short tokens
			const maxRefreshTime = Math.max(expiresAt - safetyBuffer, minRefreshTime) // Ensure maxRefreshTime >= minRefreshTime
			const refreshAt = Math.min(Math.max(idealRefreshAt, minRefreshTime), maxRefreshTime)

			// Update cache
			const cacheEntry: TokenCacheEntry = {
				token: response.sts_token,
				expiresAt,
				refreshAt,
				isRefreshing: false,
				directories: response.directories,
				presetFiles: response.preset_files,
			}

			this.tokenCache.set(cacheKey, cacheEntry)

			logger.report("获取Token成功", {
				sessionId,
				topicId,
				expiresAt: new Date(expiresAt).toISOString(),
				validDuration: response.expires_in + "秒",
				refreshIn: Math.round((refreshAt - now) / 1000) + "秒",
				hasDirectories: !!response.directories,
				hasPresetFiles: !!response.preset_files,
			})

			return response.sts_token
		} catch (error) {
			const taskEndErr = error as TaskEndError

			logger.error("获取Token失败", {
				topicId,
				retryCount,
				error,
			})

			if (isTaskEndError(error)) {
				// Task ended, need to force stop recording
				// 任务结束，需要强制停止录制
				logger.report("任务已结束，停止录音", {
					errorCode: taskEndErr.code,
				})

				// Clear cache for this session to prevent further token requests
				this.clearSession(sessionId)

				// Create task end error
				const taskEndError = createTaskEndError(sessionId)

				// Notify callback if registered (legacy support)
				if (this.onTaskEnd) {
					try {
						this.onTaskEnd(sessionId)
					} catch (callbackError) {
						logger.error("任务结束回调执行失败", {
							error: callbackError,
						})
					}
				}

				// Notify error manager (unified error handling)
				defaultErrorManager.handleTaskEnd(taskEndError).catch((handlerError) => {
					logger.error("错误管理器处理失败", {
						error: handlerError,
					})
				})

				// Throw a specific error to indicate task end (don't retry)
				throw taskEndError
			}

			// Retry logic
			if (retryCount < this.refreshConfig.maxRetries) {
				logger.warn("Token获取重试", {
					attempt: retryCount + 1,
					maxRetries: this.refreshConfig.maxRetries,
					retryInterval: this.refreshConfig.retryInterval + "ms",
				})

				await this.delay(this.refreshConfig.retryInterval)
				return this.performTokenFetch(sessionId, cacheKey, topicId, retryCount + 1)
			}

			// Max retries exceeded
			const errorMessage = error instanceof Error ? error.message : String(error)
			logger.report("Token获取重试次数已耗尽", {
				sessionId,
				maxRetries: this.refreshConfig.maxRetries,
				lastError: error,
			})
			throw new Error(
				`Failed to fetch token after ${this.refreshConfig.maxRetries} retries: ${errorMessage}`,
			)
		}
	}

	/**
	 * Refresh token in background without blocking current requests
	 * 在后台刷新Token不阻塞当前请求
	 */
	private async refreshTokenInBackground(sessionId: string, cacheKey: string): Promise<void> {
		const cachedEntry = this.tokenCache.get(cacheKey)
		if (!cachedEntry) {
			logger.warn("后台刷新取消：缓存条目不存在", {
				sessionId,
			})
			return
		}

		// Mark as refreshing
		cachedEntry.isRefreshing = true

		const topicId = this.sessionTopicMap.get(sessionId)
		if (!topicId) {
			logger.error("后台刷新Token失败：找不到topicId", {
				sessionId,
			})
			cachedEntry.isRefreshing = false
			return
		}

		const now = Date.now()
		const timeToExpiry = Math.round((cachedEntry.expiresAt - now) / 1000)

		try {
			logger.log("开始后台刷新Token", {
				sessionId,
				timeToExpiry: timeToExpiry + "秒",
			})
			await this.fetchAndCacheToken(sessionId, cacheKey, topicId)
			logger.report("后台刷新Token完成", {
				sessionId,
			})
		} catch (error) {
			logger.error("后台刷新Token失败", {
				sessionId,
				error: error instanceof Error ? error.message : String(error),
			})
			// Keep the current token and reset refresh flag
			cachedEntry.isRefreshing = false
			// Set next refresh attempt in 30 seconds
			const nextRetryTime = Date.now() + 30000
			cachedEntry.refreshAt = nextRetryTime
			logger.log("设置下次重试时间", {
				sessionId,
				retryAfter: "30秒",
			})
		}
	}

	/**
	 * Force refresh token (for error handling scenarios)
	 * 强制刷新Token（用于错误处理场景）
	 */
	async forceRefreshToken(sessionId: string): Promise<SDKUploadConfig["customCredentials"]> {
		const cacheKey = sessionId

		logger.report("强制刷新Token", {
			sessionId,
		})

		// Clear existing cache
		this.tokenCache.delete(cacheKey)
		this.refreshPromises.delete(cacheKey)

		const topicId = this.sessionTopicMap.get(sessionId)
		if (!topicId) {
			logger.error("强制刷新失败：找不到topicId", {
				sessionId,
			})
			throw new Error(`No topicId found for session ${sessionId}`)
		}

		try {
			// Fetch new token
			const token = await this.fetchAndCacheToken(sessionId, cacheKey, topicId)
			logger.report("强制刷新Token成功", {
				sessionId,
			})
			return token
		} catch (error) {
			logger.error("强制刷新Token失败", {
				sessionId,
				error: error instanceof Error ? error.message : String(error),
			})
			throw error
		}
	}

	/**
	 * Check if token exists and is valid
	 * 检查Token是否存在且有效
	 */
	hasValidToken(sessionId: string): boolean {
		const cachedEntry = this.tokenCache.get(sessionId)
		if (!cachedEntry) return false

		return Date.now() < cachedEntry.expiresAt
	}

	/**
	 * Get token expiration info
	 * 获取Token过期信息
	 */
	getTokenInfo(sessionId: string): {
		exists: boolean
		expiresAt?: number
		refreshAt?: number
		isRefreshing?: boolean
		timeToExpiry?: number
		timeToRefresh?: number
	} {
		const cachedEntry = this.tokenCache.get(sessionId)
		if (!cachedEntry) {
			return { exists: false }
		}

		const now = Date.now()
		return {
			exists: true,
			expiresAt: cachedEntry.expiresAt,
			refreshAt: cachedEntry.refreshAt,
			isRefreshing: cachedEntry.isRefreshing,
			timeToExpiry: cachedEntry.expiresAt - now,
			timeToRefresh: cachedEntry.refreshAt - now,
		}
	}

	/**
	 * Clear cache for specific session
	 * 清理指定会话的缓存
	 */
	clearCache(sessionId?: string): void {
		if (sessionId) {
			const hadCache = this.tokenCache.has(sessionId)
			this.tokenCache.delete(sessionId)
			this.refreshPromises.delete(sessionId)
			this.sessionTopicMap.delete(sessionId)

			if (hadCache) {
				logger.log("清除指定会话缓存", {
					sessionId,
				})
			}
		} else {
			// Clear all cache
			const cacheSize = this.tokenCache.size
			this.tokenCache.clear()
			this.refreshPromises.clear()
			this.sessionTopicMap.clear()

			logger.log("清除全部Token缓存", {
				clearedCount: cacheSize,
			})
		}
	}

	/**
	 * Clear session-specific cache
	 * 清除指定会话的缓存
	 */
	clearSession(sessionId: string): void {
		const hadCache = this.tokenCache.has(sessionId)
		this.tokenCache.delete(sessionId)
		this.sessionTopicMap.delete(sessionId)

		logger.log("清除会话Token缓存", {
			sessionId,
			hadCache,
		})
	}

	/**
	 * Clean up expired tokens from cache
	 * 清理缓存中的过期Token
	 */
	cleanupExpiredTokens(): number {
		const now = Date.now()
		const totalBefore = this.tokenCache.size
		let cleanedCount = 0

		for (const [key, entry] of this.tokenCache.entries()) {
			if (now >= entry.expiresAt) {
				this.tokenCache.delete(key)
				cleanedCount++
			}
		}

		if (cleanedCount > 0) {
			logger.log("清理过期Token", {
				cleanedCount,
				remainingCount: totalBefore - cleanedCount,
			})
		}

		return cleanedCount
	}

	/**
	 * Get cache statistics
	 * 获取缓存统计信息
	 */
	getCacheStats(): {
		totalTokens: number
		expiredTokens: number
		refreshingTokens: number
		validTokens: number
	} {
		const now = Date.now()
		let expiredCount = 0
		let refreshingCount = 0
		let validCount = 0

		for (const entry of this.tokenCache.values()) {
			if (now >= entry.expiresAt) {
				expiredCount++
			} else {
				validCount++
			}

			if (entry.isRefreshing) {
				refreshingCount++
			}
		}

		return {
			totalTokens: this.tokenCache.size,
			expiredTokens: expiredCount,
			refreshingTokens: refreshingCount,
			validTokens: validCount,
		}
	}

	/**
	 * Get note file information
	 * 获取笔记文件信息
	 */
	getNoteFile(sessionId: string): PresetFiles["note_file"] | undefined {
		const cachedEntry = this.tokenCache.get(sessionId)
		return cachedEntry?.presetFiles?.note_file
	}

	/**
	 * Get transcript file information
	 * 获取转写文件信息
	 */
	getTranscriptFile(sessionId: string): PresetFiles["transcript_file"] | undefined {
		const cachedEntry = this.tokenCache.get(sessionId)
		return cachedEntry?.presetFiles?.transcript_file
	}

	/**
	 * Get preset files information
	 * 获取预设文件信息
	 */
	getPresetFiles(sessionId: string): PresetFiles | undefined {
		const cachedEntry = this.tokenCache.get(sessionId)
		return cachedEntry?.presetFiles
	}

	/**
	 * Restore preset files to cache from persisted session data
	 * 从持久化的会话数据恢复预设文件到缓存
	 */
	restorePresetFiles(sessionId: string, presetFiles: PresetFiles): void {
		const cachedEntry = this.tokenCache.get(sessionId)

		if (cachedEntry) {
			// Update existing cache entry
			cachedEntry.presetFiles = presetFiles
			logger.log("更新现有缓存的预设文件", {
				sessionId,
				hasNoteFile: !!presetFiles.note_file,
				hasTranscriptFile: !!presetFiles.transcript_file,
			})
		} else {
			// Create minimal cache entry with presetFiles only
			// Token will be fetched when needed
			this.tokenCache.set(sessionId, {
				token: {} as SDKUploadConfig["customCredentials"], // Will be populated on next getToken call
				expiresAt: 0, // Force token refresh on next access
				refreshAt: 0,
				isRefreshing: false,
				presetFiles: presetFiles,
			})
			logger.log("创建新缓存条目并恢复预设文件", {
				sessionId,
				hasNoteFile: !!presetFiles.note_file,
				hasTranscriptFile: !!presetFiles.transcript_file,
			})
		}
	}

	/**
	 * Get hidden directory path (for audio chunks)
	 * 获取隐藏目录路径（用于音频分片）
	 */
	getHiddenDirectoryPath(sessionId: string): string | undefined {
		const cachedEntry = this.tokenCache.get(sessionId)
		return cachedEntry?.directories?.asr_hidden_dir?.directory_path
	}

	/**
	 * Get directories information
	 * 获取目录信息
	 */
	getDirectories(sessionId: string): RecordingDirectories | undefined {
		const cachedEntry = this.tokenCache.get(sessionId)
		return cachedEntry?.directories
	}

	/**
	 * Utility function for delays
	 * 延迟工具函数
	 */
	private delay(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms))
	}

	/**
	 * Dispose the token manager and cleanup resources
	 * 释放Token管理器并清理资源
	 */
	dispose(): void {
		const stats = this.getCacheStats()
		const sessionCount = this.sessionTopicMap.size

		this.tokenCache.clear()
		this.refreshPromises.clear()
		this.sessionTopicMap.clear()

		logger.report("Token管理器已释放", {
			clearedTokens: stats.totalTokens,
			clearedSessions: sessionCount,
		})
	}
}

// Export a default instance for easy usage
export const defaultTokenManager = new UploadTokenManager()

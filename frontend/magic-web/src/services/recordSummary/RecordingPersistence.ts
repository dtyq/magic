import type {
	RecordingSession,
	RestorationData,
	PersistenceOptions,
	AudioSourceConfig,
} from "@/types/recordSummary"
import { recordingLogger } from "./utils/RecordingLogger"

const logger = recordingLogger.namespace("Persistence")

/**
 * Recording persistence manager for storing and restoring recording data
 * 录制持久化管理器，负责存储和恢复录制数据
 */
export class RecordingPersistence {
	private options: PersistenceOptions
	private readonly STORAGE_KEYS = {
		CURRENT_SESSION: "currentSession",
		PENDING_CHUNKS: "pendingChunks",
	}

	constructor(options: PersistenceOptions) {
		this.options = options
	}

	/**
	 * Save current recording session
	 * 保存当前录制会话
	 */
	saveSession(session: RecordingSession) {
		try {
			const key = this.getStorageKey(this.STORAGE_KEYS.CURRENT_SESSION)
			localStorage.setItem(key, JSON.stringify(session))

			logger.log("保存录音会话", {
				status: session.status,
				duration: session.totalDuration,
				chunkIndex: session.currentChunkIndex,
			})
		} catch (error) {
			logger.error("保存会话失败", {
				error: error instanceof Error ? error.message : String(error),
			})
			throw new Error("Failed to save recording session")
		}
	}

	/**
	 * Load current recording session
	 * 加载当前录制会话
	 */
	loadSession(): RecordingSession | null {
		try {
			const key = this.getStorageKey(this.STORAGE_KEYS.CURRENT_SESSION)
			const data = localStorage.getItem(key)

			if (!data) {
				logger.log("无可加载的会话数据")
				return null
			}

			const session = JSON.parse(data) as RecordingSession
			const isValid = this.validateSession(session)

			if (isValid) {
				logger.log("加载录音会话", {
					status: session.status,
					duration: session.totalDuration,
					chunkIndex: session.currentChunkIndex,
				})
			} else {
				logger.warn("会话数据验证失败")
			}

			return isValid ? session : null
		} catch (error) {
			logger.error("加载会话失败", {
				error: error instanceof Error ? error.message : String(error),
			})
			return null
		}
	}

	/**
	 * Delete session from storage
	 * 从存储中删除会话
	 */
	deleteSession(sessionId: string) {
		const key = this.getStorageKey(this.STORAGE_KEYS.CURRENT_SESSION)
		const data = localStorage.getItem(key)
		if (!data) return

		const session = JSON.parse(data) as RecordingSession
		if (session.id !== sessionId) {
			logger.warn("删除会话ID不匹配", {
				requestedId: sessionId,
				actualId: session.id,
			})
			return
		}

		localStorage.removeItem(this.getStorageKey(this.STORAGE_KEYS.CURRENT_SESSION))

		logger.report("删除录音会话")
	}

	/**
	 * Get complete restoration data
	 * 获取完整的恢复数据
	 */
	async getRestorationData(): Promise<RestorationData> {
		const currentSession = this.loadSession()

		return {
			currentSession: currentSession || undefined,
		}
	}

	/**
	 * Clear all recording data
	 * 清除所有录制数据
	 */
	clearAll() {
		try {
			const keysCleared = Object.values(this.STORAGE_KEYS).map((key) => {
				const storageKey = this.getStorageKey(key)
				localStorage.removeItem(storageKey)
				return storageKey
			})

			logger.report("清除所有录音数据", {
				keysCleared: keysCleared.length,
			})
		} catch (error) {
			logger.error("清除数据失败", {
				error: error instanceof Error ? error.message : String(error),
			})
		}
	}

	/**
	 * Clear old data based on cleanup policy
	 * 根据清理策略清除旧数据
	 */
	cleanupOldData() {
		try {
			const cutoffTime = Date.now() - this.options.autoCleanupDays * 24 * 60 * 60 * 1000

			// Clean up sessions older than cutoff time
			const session = this.loadSession()
			if (session && session.lastActivityTime < cutoffTime) {
				const ageInDays = (Date.now() - session.lastActivityTime) / (24 * 60 * 60 * 1000)

				logger.report("清理过期会话数据", {
					ageInDays: ageInDays.toFixed(2),
					cutoffDays: this.options.autoCleanupDays,
				})

				this.clearAll()
			}
		} catch (error) {
			logger.error("清理旧数据失败", {
				error: error instanceof Error ? error.message : String(error),
			})
		}
	}

	/**
	 * Check if there is recoverable data
	 * 检查是否有可恢复的数据
	 */
	hasRecoverableData(): boolean {
		try {
			const session = this.loadSession()
			const hasRecoverable =
				session !== null && (session.status === "recording" || session.status === "paused")

			logger.log("检查可恢复数据", {
				hasRecoverable,
				status: session?.status || null,
			})

			return hasRecoverable
		} catch (error) {
			logger.error("检查可恢复数据失败", {
				error: error instanceof Error ? error.message : String(error),
			})
			return false
		}
	}

	/**
	 * Private: Utility methods
	 * 私有方法：工具方法
	 */
	private getStorageKey(key: string): string {
		return `${this.options.storagePrefix}_${key}`
	}

	private validateSession(session: unknown): session is RecordingSession {
		if (!session || typeof session !== "object" || session === null) {
			return false
		}

		const obj = session as Record<string, unknown>
		return (
			"id" in obj &&
			"startTime" in obj &&
			"status" in obj &&
			typeof obj.id === "string" &&
			typeof obj.startTime === "number" &&
			typeof obj.status === "string" &&
			["recording", "paused"].includes(obj.status as string)
		)
	}
	/**
	 * Update session audio source
	 * 更新会话音频源
	 */
	updateSessionAudioSource(audioSource: AudioSourceConfig) {
		const currentSession = this.loadSession()
		if (!currentSession) return
		currentSession.audioSource = audioSource
		this.saveSession(currentSession)
	}
}

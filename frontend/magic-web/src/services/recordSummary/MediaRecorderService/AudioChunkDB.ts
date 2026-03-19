import { GlobalBaseRepository } from "@/models/repository/GlobalBaseRepository"
import { recordingLogger } from "../utils/RecordingLogger"

const logger = recordingLogger.namespace("Storage:DB")

export type UploadStatus = "pending" | "uploaded"

export interface StoredAudioChunk {
	id: string // 唯一标识：${sessionId}_${index}
	sessionId: string // 会话ID
	chunk: Blob // 原始音频分片
	index: number // 分片索引
	timestamp: number // 创建时间戳
	size: number // 分片大小
	createdAt?: number
	updatedAt?: number
	// Upload related fields
	uploadStatus: UploadStatus // 上传状态
}

/**
 * Audio chunk repository based on GlobalBaseRepository
 * 基于GlobalBaseRepository的音频分片存储库
 */
export class AudioChunkDB extends GlobalBaseRepository<StoredAudioChunk> {
	static tableName = "audioChunks"
	private chunkCounter = 0 // Counter for sampling logs every 10 chunks

	constructor() {
		super(AudioChunkDB.tableName)
	}

	/**
	 * Save audio chunk to database
	 * 保存音频分片到数据库
	 */
	async saveChunk(chunk: StoredAudioChunk): Promise<void> {
		const chunkWithTimestamp = {
			...chunk,
			createdAt: chunk.createdAt || Date.now(),
			updatedAt: Date.now(),
			// Set default upload status if not provided
			uploadStatus: chunk.uploadStatus || ("pending" as UploadStatus),
		}
		await this.put(chunkWithTimestamp)

		// Sampling: log every 10 chunks to avoid performance impact
		this.chunkCounter++
		if (this.chunkCounter % 10 === 0) {
			logger.log("保存音频分片", {
				chunkIndex: chunk.index,
				chunkSize: Math.round(chunk.size / 1024) + "KB",
				totalSaved: this.chunkCounter,
			})
		}
	}

	/**
	 * Get all chunks for a session, sorted by index
	 * 获取会话的所有分片，按索引排序
	 */
	async getSessionChunks(sessionId: string): Promise<StoredAudioChunk[]> {
		const chunks = await this.getByIndex("sessionId", sessionId)
		// Sort by index to ensure correct order
		return chunks.sort((a, b) => a.index - b.index)
	}

	/**
	 * Get all unique session IDs that have chunks
	 * 获取所有有分片的会话ID
	 */
	async getAllSessionIds(): Promise<string[]> {
		const allChunks = await this.getAll()
		const sessionIds = new Set(allChunks.map((chunk) => chunk.sessionId))
		return Array.from(sessionIds)
	}

	/**
	 * Delete all chunks for a session
	 * 删除会话的所有分片
	 */
	async deleteSessionChunks(sessionId: string): Promise<void> {
		const chunks = await this.getSessionChunks(sessionId)

		// Delete chunks one by one using their IDs
		for (const chunk of chunks) {
			await this.delete(chunk.id)
		}

		logger.report("删除会话所有分片", {
			deletedCount: chunks.length,
		})
	}

	/**
	 * Get total size of chunks for a session
	 * 获取会话分片的总大小
	 */
	async getSessionSize(sessionId: string): Promise<number> {
		const chunks = await this.getSessionChunks(sessionId)
		return chunks.reduce((total, chunk) => total + chunk.size, 0)
	}

	/**
	 * Get session statistics
	 * 获取会话统计信息
	 */
	async getSessionStats(sessionId: string): Promise<{
		chunkCount: number
		totalSize: number
		firstChunkTime?: number
		lastChunkTime?: number
	}> {
		const chunks = await this.getSessionChunks(sessionId)

		if (chunks.length === 0) {
			return { chunkCount: 0, totalSize: 0 }
		}

		const totalSize = chunks.reduce((total, chunk) => total + chunk.size, 0)
		const timestamps = chunks.map((chunk) => chunk.timestamp).sort((a, b) => a - b)

		return {
			chunkCount: chunks.length,
			totalSize,
			firstChunkTime: timestamps[0],
			lastChunkTime: timestamps[timestamps.length - 1],
		}
	}

	/**
	 * Delete chunk from IndexedDB
	 * 从IndexedDB中删除分片
	 * @param chunkId
	 */
	async deleteChunk(chunkId: string): Promise<void> {
		await this.delete(chunkId)
	}

	/**
	 * Update chunk upload status
	 * 更新分片上传状态
	 */
	async updateChunkUploadStatus(chunkId: string, status: UploadStatus): Promise<void> {
		const chunk = await this.get(chunkId)
		if (!chunk) {
			logger.error("更新分片状态失败：分片不存在", {
				chunkId,
			})
			throw new Error(`Chunk ${chunkId} not found`)
		}

		const updatedChunk = {
			...chunk,
			uploadStatus: status,
			updatedAt: Date.now(),
		}

		await this.put(updatedChunk)
	}

	/**
	 * Get chunks by upload status for a session
	 * 根据上传状态获取会话分片
	 */
	async getChunksByUploadStatus(
		sessionId: string,
		status: UploadStatus,
	): Promise<StoredAudioChunk[]> {
		const chunks = await this.getSessionChunks(sessionId)
		return chunks.filter((chunk) => chunk.uploadStatus === status)
	}

	/**
	 * Get session upload progress
	 * 获取会话上传进度
	 */
	async getSessionUploadProgress(sessionId: string): Promise<{
		total: number
		pending: number
		uploaded: number
		completed: boolean
	}> {
		const chunks = await this.getSessionChunks(sessionId)

		const progress = {
			total: chunks.length,
			pending: 0,
			uploaded: 0,
			completed: false,
		}

		for (const chunk of chunks) {
			switch (chunk.uploadStatus) {
				case "pending":
					progress.pending++
					break
				case "uploaded":
					progress.uploaded++
					break
			}
		}

		progress.completed = progress.uploaded === progress.total

		// Sampling: log progress every 10 chunks
		if (chunks.length > 0 && chunks.length % 10 === 0) {
			logger.log("分片上传进度", {
				total: progress.total,
				uploaded: progress.uploaded,
				pending: progress.pending,
				progress: Math.round((progress.uploaded / progress.total) * 100) + "%",
			})
		}

		return progress
	}

	/**
	 * Clean up chunks older than specified days
	 * 清理指定天数之前的分片
	 */
	async cleanupOldChunks(days: number = 7): Promise<number> {
		const cutoffTime = Date.now() - days * 24 * 60 * 60 * 1000
		const allChunks = await this.getAll()

		const oldChunks = allChunks.filter(
			(chunk) => (chunk.createdAt || chunk.timestamp) < cutoffTime,
		)

		for (const chunk of oldChunks) {
			await this.delete(chunk.id)
		}

		if (oldChunks.length > 0) {
			logger.report("清理过期分片", {
				cleanedCount: oldChunks.length,
				cutoffDays: days,
			})
		}

		return oldChunks.length
	}
}

import type { RecordingSession } from "@/types/recordSummary"
import { GlobalBaseRepository } from "@/models/repository/GlobalBaseRepository"
import { recordingLogger } from "./utils/RecordingLogger"

const logger = recordingLogger.namespace("History:DB")

// Default retention window for historical sessions (days)
export const RECORDING_HISTORY_RETENTION_DAYS = 30

/**
 * Stored session entity adds lightweight audit timestamps
 * 存储态会话条目，额外携带 createdAt / updatedAt
 */
export interface StoredSessionHistory extends RecordingSession {
	createdAt: number
	updatedAt: number
}

/**
 * Repository for recording session history (magic-global DB)
 * 基于 GlobalBaseRepository 的会话历史仓库
 */
export class RecordingSessionHistoryDB extends GlobalBaseRepository<StoredSessionHistory> {
	static tableName = "recording-session-history"

	constructor() {
		super(RecordingSessionHistoryDB.tableName)
	}

	/**
	 * Upsert the session snapshot into history table
	 * 会话快照 upsert
	 */
	async upsert(session: RecordingSession): Promise<void> {
		const now = Date.now()
		const existing = await this.get(session.id).catch(() => undefined)
		const entity: StoredSessionHistory = {
			...(session as StoredSessionHistory),
			createdAt: existing?.createdAt ?? now,
			updatedAt: now,
		}
		await this.put(entity)
	}

	/**
	 * Get stored session by id
	 * 根据会话 id 获取历史条目
	 */
	async getById(id: string): Promise<StoredSessionHistory | undefined> {
		return this.get(id)
	}

	/**
	 * List sessions by user, newest first
	 * 按用户筛选并按 startTime 倒序返回
	 */
	async listByUser(userId: string): Promise<StoredSessionHistory[]> {
		const rows = await this.getByIndex("userId", userId)
		return rows.sort((a, b) => b.startTime - a.startTime)
	}

	/**
	 * List all history sessions, newest first
	 * 全量历史，按 startTime 倒序
	 */
	async listAll(): Promise<StoredSessionHistory[]> {
		const rows = await this.getAll()
		return rows.sort((a, b) => b.startTime - a.startTime)
	}

	/**
	 * Delete a history entry by session id
	 * 删除单条历史
	 */
	async deleteById(id: string): Promise<void> {
		await this.delete(id)
	}

	/**
	 * Remove entries whose lastActivityTime is older than retention days
	 * 清理过期历史
	 */
	async cleanupExpired(
		retentionDays: number = RECORDING_HISTORY_RETENTION_DAYS,
	): Promise<number> {
		const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000
		const rows = await this.getAll()
		const expired = rows.filter((row) => {
			const anchor = row.lastActivityTime ?? row.updatedAt ?? row.startTime
			return anchor < cutoff
		})

		for (const row of expired) {
			await this.delete(row.id)
		}

		if (expired.length > 0) {
			logger.report("清理过期历史会话", {
				cleanedCount: expired.length,
				cutoffDays: retentionDays,
			})
		}

		return expired.length
	}
}

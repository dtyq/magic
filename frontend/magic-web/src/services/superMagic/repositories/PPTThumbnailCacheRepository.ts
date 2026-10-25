import type Dexie from "dexie"
import type { Table } from "dexie"
import { GlobalBaseRepository } from "@/models/repository/GlobalBaseRepository"
import { isQuotaExceeded, reportCaughtStorageFailure } from "@/app/services/storage/storageFailure"

export const PPT_THUMBNAIL_CACHE_POLICY = {
	maxBytes: 100 * 1024 * 1024,
	maxEntries: 2000,
	maxEntryBytes: 1024 * 1024,
	maxIdleAgeMs: 30 * 24 * 60 * 60 * 1000,
	touchIntervalMs: 60 * 1000,
	quotaRecoveryRatio: 0.8,
} as const

export interface PPTThumbnailCacheKey {
	key: string
	scope: string
	slideIdentity: string
	path: string
}

interface ThumbnailMetadata extends PPTThumbnailCacheKey {
	byteSize: number
	mimeType: string
	createdAt: number
	lastAccessAt: number
}

interface ThumbnailBody {
	key: string
	bytes: ArrayBuffer
}

interface ThumbnailTables {
	metadata: Table<ThumbnailMetadata, string>
	bodies: Table<ThumbnailBody, string>
}

function isExpired(record: ThumbnailMetadata, now: number): boolean {
	return (
		!Number.isFinite(record.lastAccessAt) ||
		now - record.lastAccessAt >= PPT_THUMBNAIL_CACHE_POLICY.maxIdleAgeMs ||
		!Number.isFinite(record.byteSize) ||
		record.byteSize <= 0
	)
}

function isValidBody(
	record: ThumbnailMetadata,
	body: ThumbnailBody | undefined,
): body is ThumbnailBody {
	return (
		body?.bytes instanceof ArrayBuffer &&
		body.bytes.byteLength === record.byteSize &&
		record.byteSize <= PPT_THUMBNAIL_CACHE_POLICY.maxEntryBytes &&
		record.mimeType === "image/webp"
	)
}

/** Dexie may wrap QuotaExceededError; unwrap one level before the shared detector. */
function isQuotaError(error: unknown): boolean {
	if (isQuotaExceeded(error)) return true
	if (!error || typeof error !== "object" || !("inner" in error)) return false
	return isQuotaExceeded(error.inner)
}

/** 只管理可重建的 PPT 图片；容量统计读元数据，不把所有图片体加载进内存。 */
export class PPTThumbnailCacheRepository extends GlobalBaseRepository<ThumbnailMetadata> {
	static readonly tableName = "ppt-thumbnail-cache"
	static readonly bodyTableName = "ppt-thumbnail-cache-body"
	private sweepPending = true
	private pendingReads = 0
	private pendingAccessTimes = new Map<string, number>()
	private readonly invalidKeys = new Set<string>()
	private maintenanceScheduled = false
	private maintenanceRunning = false

	constructor() {
		super(PPTThumbnailCacheRepository.tableName)
	}

	async getThumbnail(key: string): Promise<Blob | null> {
		this.pendingReads += 1
		try {
			return await this.executeWithErrorHandling("getThumbnail", async () => {
				const db = await this.getDB()
				const tables = this.tables(db)
				// 多页命中可以并发读取；访问时间和损坏记录维护不能让读取申请写事务。
				return db.transaction("r", tables.metadata, tables.bodies, async () => {
					const record = await tables.metadata.get(key)
					if (!record) return null
					const now = Date.now()
					const body = isExpired(record, now) ? undefined : await tables.bodies.get(key)
					if (!isValidBody(record, body)) {
						if (this.invalidKeys.size < PPT_THUMBNAIL_CACHE_POLICY.maxEntries) {
							this.invalidKeys.add(key)
						}
						return null
					}
					if (
						now - record.lastAccessAt >= PPT_THUMBNAIL_CACHE_POLICY.touchIntervalMs &&
						(this.pendingAccessTimes.has(key) ||
							this.pendingAccessTimes.size < PPT_THUMBNAIL_CACHE_POLICY.maxEntries)
					) {
						this.pendingAccessTimes.set(
							key,
							Math.max(now, this.pendingAccessTimes.get(key) ?? now),
						)
					}
					return new Blob([body.bytes], { type: record.mimeType })
				})
			})
		} catch {
			return null
		} finally {
			this.pendingReads -= 1
			this.scheduleMaintenance()
		}
	}

	async putThumbnail(
		identity: PPTThumbnailCacheKey,
		blob: Blob,
		shouldCommit: () => boolean,
	): Promise<boolean> {
		if (
			!shouldCommit() ||
			blob.type !== "image/webp" ||
			blob.size === 0 ||
			blob.size > PPT_THUMBNAIL_CACHE_POLICY.maxEntryBytes
		) {
			return false
		}
		try {
			// 字节转换必须在事务外完成，避免等待非数据库 Promise 使事务提前提交。
			const bytes = await blob.arrayBuffer()
			return await this.executeWithErrorHandling("putThumbnail", async () => {
				const db = await this.getDB()
				const tables = this.tables(db)
				const write = () =>
					db.transaction("rw", tables.metadata, tables.bodies, async () => {
						if (!shouldCommit()) return false
						await this.pruneTables(tables, blob.size, identity.key)
						if (!shouldCommit()) return false
						const now = Date.now()
						await tables.metadata.put({
							...identity,
							byteSize: bytes.byteLength,
							mimeType: blob.type,
							createdAt: now,
							lastAccessAt: now,
						})
						await tables.bodies.put({ key: identity.key, bytes })
						return true
					})
				try {
					return await write()
				} catch (error) {
					// 在公共 Repository 包装错误前识别配额；恢复只淘汰本缓存，最多重试一次。
					if (!isQuotaError(error) || !shouldCommit()) throw error
					reportCaughtStorageFailure({
						eventKey: "ppt_thumbnail_cache_set_failed",
						error,
						message: "Failed to persist PPT thumbnail cache",
						key: PPTThumbnailCacheRepository.tableName,
					})
					await db.transaction("rw", tables.metadata, tables.bodies, () =>
						this.pruneTables(
							tables,
							0,
							undefined,
							PPT_THUMBNAIL_CACHE_POLICY.quotaRecoveryRatio,
						),
					)
					return write()
				}
			})
		} catch {
			return false
		}
	}

	async deleteThumbnail(key: string): Promise<void> {
		try {
			await this.executeWithErrorHandling("deleteThumbnail", async () => {
				const db = await this.getDB()
				const tables = this.tables(db)
				await db.transaction("rw", tables.metadata, tables.bodies, () =>
					this.remove(tables, [key]),
				)
			})
		} catch {
			// 清除损坏缓存失败不能阻断用户主动重新生成。
		}
	}

	private scheduleMaintenance(): void {
		if (
			this.pendingReads > 0 ||
			this.maintenanceScheduled ||
			this.maintenanceRunning ||
			(!this.sweepPending &&
				this.pendingAccessTimes.size === 0 &&
				this.invalidKeys.size === 0)
		)
			return

		this.maintenanceScheduled = true
		const run = () => {
			this.maintenanceScheduled = false
			// 等待期间若又开始读图，由最后一个读取的 finally 重新安排，不循环占用空闲帧。
			if (this.pendingReads === 0) void this.runMaintenance()
		}
		if (typeof window !== "undefined" && typeof window.requestIdleCallback === "function") {
			window.requestIdleCallback(run)
		} else {
			setTimeout(run, 0)
		}
	}

	private async runMaintenance(): Promise<void> {
		if (this.maintenanceRunning || this.pendingReads > 0) return
		this.maintenanceRunning = true
		let completed = false
		try {
			await this.executeWithErrorHandling("maintainThumbnails", async () => {
				const db = await this.getDB()
				if (this.pendingReads > 0) return
				const tables = this.tables(db)
				const invalidKeys = [...this.invalidKeys]
				const shouldSweep = this.sweepPending
				this.invalidKeys.clear()
				this.sweepPending = false
				await db.transaction("rw", tables.metadata, tables.bodies, async () => {
					await this.flushAccessTimes(tables)
					await this.removeInvalidRecords(tables, invalidKeys)
					if (shouldSweep) await this.pruneTables(tables)
				})
			})
			completed = true
		} catch {
			// 浏览器可能禁止持久存储；清理与读取失败都不改变预览可用性。
		} finally {
			this.maintenanceRunning = false
			// 失败不自动重试；成功后只处理执行期间新增的维护需求。
			if (completed) this.scheduleMaintenance()
		}
	}

	private async flushAccessTimes(tables: ThumbnailTables): Promise<void> {
		if (this.pendingAccessTimes.size === 0) return
		// 先取走本批。await 期间的新访问进入新 Map，不能在提交后整批 clear 而丢失。
		const accessTimes = this.pendingAccessTimes
		this.pendingAccessTimes = new Map()
		const records = await tables.metadata.bulkGet([...accessTimes.keys()])
		const updates = records.flatMap((record) => {
			if (!record) return []
			const accessedAt = accessTimes.get(record.key)
			if (
				accessedAt === undefined ||
				!Number.isFinite(record.lastAccessAt) ||
				accessedAt - record.lastAccessAt < PPT_THUMBNAIL_CACHE_POLICY.touchIntervalMs
			)
				return []
			return [{ ...record, lastAccessAt: accessedAt }]
		})
		// 调用方持有写事务：只更新仍存在的记录，不复活已删除的缓存，也不倒退新记录的时间。
		if (updates.length > 0) await tables.metadata.bulkPut(updates)
	}

	private async removeInvalidRecords(tables: ThumbnailTables, keys: string[]): Promise<void> {
		const invalidKeys: string[] = []
		for (const key of keys) {
			// 例：读取发现损坏后，同 key 已重新生成；必须检查当前字节，不能按旧结论删除。
			const record = await tables.metadata.get(key)
			if (!record || isExpired(record, Date.now())) {
				invalidKeys.push(key)
				continue
			}
			const body = await tables.bodies.get(key)
			if (!isValidBody(record, body)) invalidKeys.push(key)
		}
		await this.remove(tables, invalidKeys)
	}

	private tables(db: Dexie): ThumbnailTables {
		return {
			metadata: db.table(PPTThumbnailCacheRepository.tableName),
			bodies: db.table(PPTThumbnailCacheRepository.bodyTableName),
		}
	}

	private async remove(tables: ThumbnailTables, keys: string[]): Promise<void> {
		if (keys.length === 0) return
		await tables.metadata.bulkDelete(keys)
		await tables.bodies.bulkDelete(keys)
	}

	private async pruneTables(
		tables: ThumbnailTables,
		incomingBytes = 0,
		replacingKey?: string,
		budgetRatio = 1,
	): Promise<void> {
		// 新图片写入和空闲清理都先合并访问时间，避免按旧 LRU 时间淘汰刚刚命中的图。
		await this.flushAccessTimes(tables)
		const records = await tables.metadata.orderBy("lastAccessAt").toArray()
		const now = Date.now()
		const expired = records.filter((record) => isExpired(record, now))
		const active = records.filter(
			(record) => !isExpired(record, now) && record.key !== replacingKey,
		)
		const toDelete = expired.map((record) => record.key)
		let bytes = active.reduce((sum, record) => sum + record.byteSize, incomingBytes)
		let entries = active.length + (replacingKey ? 1 : 0)
		const maxBytes = PPT_THUMBNAIL_CACHE_POLICY.maxBytes * budgetRatio
		const maxEntries = Math.floor(PPT_THUMBNAIL_CACHE_POLICY.maxEntries * budgetRatio)
		for (const record of active) {
			if (bytes <= maxBytes && entries <= maxEntries) break
			toDelete.push(record.key)
			bytes -= record.byteSize
			entries -= 1
		}
		await this.remove(tables, toDelete)
	}
}

export const pptThumbnailCacheRepository = new PPTThumbnailCacheRepository()

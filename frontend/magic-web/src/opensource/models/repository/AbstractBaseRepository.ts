import type { IndexableType, Table, UpdateSpec } from "dexie"
import type Dexie from "dexie"
import { logger as Logger } from "@/opensource/utils/log"

const logger = Logger.createLogger("repository")

/**
 * @description repository层抽象基类
 */
export abstract class AbstractBaseRepository<T> {
	protected db: Dexie | undefined

	protected tableName: string

	constructor(tableName: string) {
		this.tableName = tableName
	}

	/**
	 * @description 获取数据库实例
	 */
	protected abstract getDB(): Promise<Dexie>

	/**
	 * @description 获取表对象
	 */
	protected async getTable(): Promise<Table<T, IndexableType>> {
		const db = await this.getDB()
		return db.table<T>(this.tableName)
	}

	/**
	 * 执行数据库操作并处理异常
	 */
	protected async executeWithErrorHandling<R>(
		operation: string,
		fn: () => Promise<R>,
		timeout: number = 2000,
	): Promise<R> {
		const startTime = Date.now()

		try {
			// 添加超时保护
			const timeoutPromise = new Promise<never>((_, reject) => {
				setTimeout(() => {
					reject(
						new Error(
							`Repository operation '${operation}' on table '${this.tableName}' timed out after ${timeout}ms`,
						),
					)
				}, timeout)
			})

			const result = await Promise.race([fn(), timeoutPromise])

			// 记录成功操作
			const duration = Date.now() - startTime
			if (duration > 500) {
				// 只记录较慢的操作
				logger.warn("slowRepositoryOperation", {
					operation,
					tableName: this.tableName,
					duration,
				})
			}

			return result
		} catch (error: any) {
			const duration = Date.now() - startTime

			// 增强错误日志，包含更多诊断信息
			const errorDetails = {
				operation,
				tableName: this.tableName,
				duration,
				domain: typeof location !== "undefined" ? location.hostname : "unknown",
				errorMessage: error instanceof Error ? error.message : String(error),
			}

			logger.error("repositoryOperationFailed", errorDetails, error)
			throw new Error(
				`Repository operation '${operation}' failed on table '${this.tableName}': ${error?.message}`,
			)
		}
	}

	/**
	 * @description 添加或更新数据
	 * @param data
	 */
	async put(data: T): Promise<void> {
		return this.executeWithErrorHandling("put", async () => {
			const table = await this.getTable()
			await table.put(data)
		})
	}

	/**
	 * @description 获取单个数据
	 * @param key
	 */
	async get(key: IndexableType): Promise<T | undefined> {
		return this.executeWithErrorHandling("get", async () => {
			const table = await this.getTable()
			return table.get(key)
		})
	}

	/**
	 * @description 获取所有数据
	 */
	async getAll(): Promise<T[]> {
		return this.executeWithErrorHandling("getAll", async () => {
			const table = await this.getTable()
			return table.toArray()
		})
	}

	/**
	 * @description 通过索引查询
	 * @param indexName
	 * @param value
	 */
	async getByIndex(indexName: string, value: IndexableType): Promise<T[]> {
		return this.executeWithErrorHandling("getByIndex", async () => {
			const table = await this.getTable()
			return table.where(indexName).equals(value).toArray()
		})
	}

	/**
	 * @description 删除数据
	 * @param key
	 */
	async delete(key: IndexableType): Promise<void> {
		return this.executeWithErrorHandling("delete", async () => {
			const table = await this.getTable()
			await table.delete(key)
		})
	}

	/**
	 * @description 清空表
	 */
	async clear(): Promise<void> {
		return this.executeWithErrorHandling("clear", async () => {
			const table = await this.getTable()
			await table.clear()
		})
	}

	/**
	 * @description 更新数据
	 * @param key 主键
	 * @param changes 需要更新的字段
	 */
	async update(key: IndexableType, changes: UpdateSpec<T>): Promise<number> {
		return this.executeWithErrorHandling("update", async () => {
			const table = await this.getTable()
			return table.update(key, changes)
		})
	}

	/**
	 * @description 批量获取数据
	 * @param keys 主键数组
	 */
	async bulkGet(keys: IndexableType[]): Promise<Array<T | undefined>> {
		return this.executeWithErrorHandling("bulkGet", async () => {
			const table = await this.getTable()
			return table.bulkGet(keys)
		})
	}

	/**
	 * @description 批量写入数据（单个事务）
	 * @param dataArray 数据数组
	 */
	async bulkPut(dataArray: T[]): Promise<void> {
		return this.executeWithErrorHandling("bulkPut", async () => {
			const table = await this.getTable()
			await table.bulkPut(dataArray)
		})
	}
}

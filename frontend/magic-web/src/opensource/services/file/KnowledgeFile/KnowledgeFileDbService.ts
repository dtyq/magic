import chatDb from "@/opensource/database/chat"
import type { KnowledgeFileCacheData } from "./KnowledgeFileService"

/**
 * 知识库文件数据库服务
 */
class KnowledgeFileDbService {
	private tableName = "knowledge_file_urls"

	/**
	 * 初始化数据库表
	 */
	async initTable() {
		try {
			// 检查表是否存在，如果不存在则创建
			if (!chatDb.getKnowledgeFileUrlsTable()) {
				await chatDb.changeSchema({
					[this.tableName]: "&file_key, expires, cached_at",
				})
			}
			return chatDb.getKnowledgeFileUrlsTable()
		} catch (error) {
			console.error("KnowledgeFileDbService: 初始化表失败", error)
			throw error
		}
	}

	getKnowledgeFileUrlsTable() {
		return chatDb.getKnowledgeFileUrlsTable()
	}

	/**
	 * 获取知识库文件缓存表
	 */
	private async getTable() {
		try {
			return chatDb.getKnowledgeFileUrlsTable()
		} catch (error) {
			// 表不存在，尝试创建
			return await this.initTable()
		}
	}

	/**
	 * 保存文件缓存到数据库
	 */
	async saveFileCache(cacheData: KnowledgeFileCacheData) {
		try {
			const table = await this.getTable()
			if (!table) {
				return
			}
			await table.put(cacheData)
			console.log("KnowledgeFileDbService: 保存缓存成功", cacheData.file_key)
		} catch (error) {
			console.error("KnowledgeFileDbService: 保存缓存失败", error)
			throw error
		}
	}

	/**
	 * 从数据库获取文件缓存
	 */
	async getFileCache(fileKey: string): Promise<KnowledgeFileCacheData | undefined> {
		try {
			const table = await this.getTable()
			if (!table) {
				return undefined
			}
			return await table.where("file_key").equals(fileKey).first()
		} catch (error) {
			console.error("KnowledgeFileDbService: 获取缓存失败", error)
			return undefined
		}
	}

	/**
	 * 批量获取文件缓存
	 */
	async getFileCaches(fileKeys: string[]): Promise<KnowledgeFileCacheData[]> {
		try {
			const table = await this.getTable()
			if (!table) {
				return []
			}
			return await table.where("file_key").anyOf(fileKeys).toArray()
		} catch (error) {
			console.error("KnowledgeFileDbService: 批量获取缓存失败", error)
			return []
		}
	}

	/**
	 * 获取所有文件缓存
	 */
	async getAllFileCaches(): Promise<KnowledgeFileCacheData[]> {
		try {
			const table = await this.getTable()
			if (!table) {
				return []
			}
			return await table.toArray()
		} catch (error) {
			console.error("KnowledgeFileDbService: 获取所有缓存失败", error)
			return []
		}
	}

	/**
	 * 删除文件缓存
	 */
	async deleteFileCache(fileKey: string) {
		try {
			const table = await this.getTable()
			if (!table) {
				return
			}
			await table.where("file_key").equals(fileKey).delete()
			console.log("KnowledgeFileDbService: 删除缓存成功", fileKey)
		} catch (error) {
			console.error("KnowledgeFileDbService: 删除缓存失败", error)
			throw error
		}
	}

	/**
	 * 批量删除文件缓存
	 */
	async deleteFileCaches(fileKeys: string[]) {
		try {
			const table = await this.getTable()
			if (!table) {
				return
			}
			await table.where("file_key").anyOf(fileKeys).delete()
			console.log("KnowledgeFileDbService: 批量删除缓存成功", fileKeys.length)
		} catch (error) {
			console.error("KnowledgeFileDbService: 批量删除缓存失败", error)
			throw error
		}
	}

	/**
	 * 删除过期的文件缓存
	 */
	async deleteExpiredCaches() {
		try {
			const table = await this.getTable()
			if (!table) {
				return 0
			}
			const now = Date.now()

			// 查找过期的缓存
			const expiredCaches = await table
				?.where("expires")
				.below(Math.floor(now / 1000))
				.toArray()

			if (expiredCaches.length > 0) {
				const expiredKeys = expiredCaches.map((cache) => cache.file_key)
				await this.deleteFileCaches(expiredKeys)
				console.log(`KnowledgeFileDbService: 删除了 ${expiredKeys.length} 个过期缓存`)
			}

			return expiredCaches.length
		} catch (error) {
			console.error("KnowledgeFileDbService: 删除过期缓存失败", error)
			return 0
		}
	}

	/**
	 * 清空所有文件缓存
	 */
	async clearAllCaches() {
		try {
			const table = await this.getTable()
			if (!table) {
				return
			}
			await table.clear()
			console.log("KnowledgeFileDbService: 清空所有缓存成功")
		} catch (error) {
			console.error("KnowledgeFileDbService: 清空所有缓存失败", error)
			throw error
		}
	}

	/**
	 * 获取缓存统计信息
	 */
	async getCacheStats() {
		try {
			const table = await this.getTable()
			if (!table) {
				return {
					total: 0,
					valid: 0,
					expired: 0,
				}
			}
			const total = await table.count()
			const now = Math.floor(Date.now() / 1000)
			const expired = await table?.where("expires").below(now).count()
			const valid = total - expired

			return {
				total,
				valid,
				expired,
			}
		} catch (error) {
			console.error("KnowledgeFileDbService: 获取缓存统计失败", error)
			return {
				total: 0,
				valid: 0,
				expired: 0,
			}
		}
	}
}

export default new KnowledgeFileDbService()

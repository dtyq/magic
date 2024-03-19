import { makeAutoObservable } from "mobx"
import { FileApi } from "@/opensource/apis"
import KnowledgeFileDbService from "./KnowledgeFileDbService"

/**
 * 知识库文件链接数据
 */
export interface KnowledgeFileUrlData {
	url: string
	expires: number
	name: string
	uid: string
	key: string
}

/**
 * 知识库文件缓存数据
 */
export interface KnowledgeFileCacheData extends KnowledgeFileUrlData {
	file_key: string
	cached_at: number
}

/**
 * 知识库文件业务服务
 */
class KnowledgeFileService {
	fileInfoCache: Map<string, KnowledgeFileCacheData> = new Map()
	// 正在进行的请求缓存，用于请求去重
	private pendingRequests: Map<string, Promise<KnowledgeFileCacheData | null>> = new Map()

	constructor() {
		makeAutoObservable(this, {}, { autoBind: true })
	}

	/**
	 * 初始化
	 */
	async init() {
		try {
			// 初始化数据库表
			await KnowledgeFileDbService.initTable()

			// 从 IndexedDB 加载缓存数据
			await this.loadCacheFromDB()

			// 清理过期缓存
			await this.clearExpiredCache()

			console.log("KnowledgeFileService: 初始化完成")
		} catch (error) {
			console.error("KnowledgeFileService: 初始化失败", error)
		}
	}

	/**
	 * 从数据库加载缓存
	 */
	private async loadCacheFromDB() {
		try {
			const caches = await KnowledgeFileDbService.getAllFileCaches()

			caches.forEach((cache) => {
				this.fileInfoCache.set(cache.file_key, cache)
			})

			console.log(`KnowledgeFileService: 从数据库加载了 ${caches.length} 个缓存`)
		} catch (error) {
			console.error("KnowledgeFileService: 加载缓存失败", error)
		}
	}

	/**
	 * 获取文件信息缓存
	 */
	getFileInfoCache(fileKey?: string) {
		if (!fileKey) return undefined
		return this.fileInfoCache.get(fileKey)
	}

	/**
	 * 缓存文件信息
	 */
	async cacheFileUrl(fileInfo: KnowledgeFileUrlData & { file_key: string }) {
		const cacheData: KnowledgeFileCacheData = {
			...fileInfo,
			cached_at: Date.now(),
		}

		// 更新内存缓存
		this.fileInfoCache.set(fileInfo.file_key, cacheData)

		// 持久化到 IndexedDB
		await this.saveCacheToDB(cacheData)
	}

	/**
	 * 保存缓存到数据库
	 */
	private async saveCacheToDB(cacheData: KnowledgeFileCacheData) {
		try {
			await KnowledgeFileDbService.saveFileCache(cacheData)
		} catch (error) {
			console.error("KnowledgeFileService: 保存缓存失败", error)
		}
	}

	/**
	 * 检查文件是否过期
	 * @param fileKey 文件key
	 * @param expiredTime 过期时间（毫秒），默认30分钟
	 */
	checkFileExpired(fileKey: string, expiredTime: number = 30 * 60 * 1000) {
		const fileInfo = this.fileInfoCache.get(fileKey)

		if (!fileInfo) return true

		// 如果还有半小时过期则认为过期
		return fileInfo.expires * 1000 < Date.now() + expiredTime
	}

	/**
	 * 获取单个文件信息
	 * @param fileKey 文件key
	 */
	async fetchFileUrl(fileKey: string): Promise<KnowledgeFileCacheData | null> {
		if (!fileKey) return null

		// 检查是否过期
		if (!this.checkFileExpired(fileKey)) {
			// 未过期，直接返回缓存
			return this.fileInfoCache.get(fileKey) || null
		}

		// 检查是否有正在进行的请求
		const pendingRequest = this.pendingRequests.get(fileKey)
		if (pendingRequest) {
			console.log(`KnowledgeFileService: 复用正在进行的请求 ${fileKey}`)
			return pendingRequest
		}

		// 创建新的请求
		const requestPromise = this.performFileRequest(fileKey)

		// 缓存请求 Promise
		this.pendingRequests.set(fileKey, requestPromise)

		try {
			const result = await requestPromise
			return result
		} finally {
			// 请求完成后清理 Promise 缓存
			this.pendingRequests.delete(fileKey)
		}
	}

	/**
	 * 执行实际的文件请求
	 * @param fileKey 文件key
	 */
	private async performFileRequest(fileKey: string): Promise<KnowledgeFileCacheData | null> {
		try {
			console.log(`KnowledgeFileService: 发起新请求 ${fileKey}`)

			// 过期或不存在，重新获取
			const response = await FileApi.getKnowledgeFileUrl(fileKey)

			if (response?.url) {
				await this.cacheFileUrl({
					...response,
					file_key: fileKey,
				})

				return this.fileInfoCache.get(fileKey) || null
			} else {
				console.error("KnowledgeFileService: 获取知识库文件链接失败", response)
				return null
			}
		} catch (error) {
			console.error("KnowledgeFileService: 获取知识库文件链接出错", error)
			return null
		}
	}

	/**
	 * 批量获取文件信息
	 * @param fileKeys 文件key数组
	 */
	async fetchFileUrls(
		fileKeys: string[],
	): Promise<Record<string, KnowledgeFileCacheData | null>> {
		if (!fileKeys || !fileKeys.length) return {}

		const result: Record<string, KnowledgeFileCacheData | null> = {}

		// 并发获取所有文件信息
		const promises = fileKeys.map(async (fileKey) => {
			const fileInfo = await this.fetchFileUrl(fileKey)
			result[fileKey] = fileInfo
		})

		await Promise.all(promises)

		return result
	}

	/**
	 * 清除过期缓存
	 */
	async clearExpiredCache() {
		try {
			const now = Date.now()
			const expiredKeys: string[] = []

			// 从内存缓存中找出过期的key
			this.fileInfoCache.forEach((fileInfo, fileKey) => {
				if (fileInfo.expires * 1000 < now) {
					expiredKeys.push(fileKey)
				}
			})

			// 从内存中删除过期缓存
			expiredKeys.forEach((key) => {
				this.fileInfoCache.delete(key)
			})

			// 从数据库中删除过期缓存
			const deletedCount = await KnowledgeFileDbService.deleteExpiredCaches()

			console.log(
				`KnowledgeFileService: 清除了 ${Math.max(
					expiredKeys.length,
					deletedCount,
				)} 个过期缓存`,
			)
		} catch (error) {
			console.error("KnowledgeFileService: 清除过期缓存失败", error)
		}
	}

	/**
	 * 清空所有缓存
	 */
	async clearAllCache() {
		try {
			// 清空内存缓存
			this.fileInfoCache.clear()

			// 清空正在进行的请求
			this.pendingRequests.clear()

			// 清空数据库缓存
			await KnowledgeFileDbService.clearAllCaches()

			console.log("KnowledgeFileService: 清空所有缓存成功")
		} catch (error) {
			console.error("KnowledgeFileService: 清空所有缓存失败", error)
		}
	}

	/**
	 * 获取缓存统计信息
	 */
	async getCacheStats() {
		try {
			const dbStats = await KnowledgeFileDbService.getCacheStats()
			const memoryCount = this.fileInfoCache.size

			return {
				memory: memoryCount,
				database: dbStats,
			}
		} catch (error) {
			console.error("KnowledgeFileService: 获取缓存统计失败", error)
			return {
				memory: this.fileInfoCache.size,
				database: {
					total: 0,
					valid: 0,
					expired: 0,
				},
			}
		}
	}

	/**
	 * 预加载文件信息（可选的性能优化）
	 * @param fileKeys 文件key数组
	 */
	async preloadFileUrls(fileKeys: string[]) {
		if (!fileKeys || !fileKeys.length) return

		// 过滤出需要加载的文件（未缓存或已过期的）
		const needLoadKeys = fileKeys.filter((fileKey) => this.checkFileExpired(fileKey))

		if (needLoadKeys.length > 0) {
			console.log(`KnowledgeFileService: 预加载 ${needLoadKeys.length} 个文件`)
			await this.fetchFileUrls(needLoadKeys)
		}
	}
}

export default new KnowledgeFileService()

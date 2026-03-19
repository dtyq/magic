import type { GetTemporaryDownloadUrlItem } from "@/pages/superMagic/utils/api"

/**
 * URL 缓存项接口
 */
export interface CachedUrlItem {
	url: string
	expiresAt: string
	/** 文件最后更新时间，用于判断文件是否已更新 */
	updatedAt?: string
}

/**
 * 检查 URL 是否过期
 * @param expiresAt 过期时间字符串，格式: "2026-03-11 17:16:12"，如果为 undefined 则返回 false（不缓存）
 * @returns 如果未过期返回 true，否则返回 false
 */
export function isUrlValid(expiresAt: string | undefined): boolean {
	// 如果 expires_at 为 undefined，不缓存，每次都使用最新的 URL
	if (!expiresAt) return false
	try {
		// 将过期时间字符串转换为 Date 对象
		// 格式: "2026-03-11 17:16:12"
		const expireDate = new Date(expiresAt.replace(/-/g, "/"))
		const now = new Date()
		// 提前 5 分钟过期，避免边界情况
		const bufferTime = 5 * 60 * 1000 // 5 分钟
		return expireDate.getTime() - now.getTime() > bufferTime
	} catch (error) {
		console.error("解析过期时间失败:", error)
		return false
	}
}

/**
 * 检查文件的 updatedAt 是否已变化
 * @param cachedUpdatedAt 缓存中的更新时间
 * @param currentUpdatedAt 当前的更新时间
 * @returns 如果未变化返回 true，否则返回 false
 */
export function checkUpdatedAtUnchanged(
	cachedUpdatedAt: string | undefined,
	currentUpdatedAt: string | undefined,
): boolean {
	// 如果没有提供当前更新时间，认为未变化
	if (!currentUpdatedAt) return true
	// 如果缓存中没有更新时间，认为已变化
	if (!cachedUpdatedAt) return false
	// 比较更新时间
	return cachedUpdatedAt === currentUpdatedAt
}

/**
 * URL 缓存管理器
 * 用于管理文件 ID 到 URL 缓存的映射
 */
export class UrlCacheManager {
	private cache = new Map<string, CachedUrlItem>()

	/**
	 * 从缓存中获取有效的 URL
	 * @param fileIds 文件 ID 列表
	 * @param fileUpdatedAtMap 文件 ID 到更新时间的映射，用于判断文件是否已更新
	 * @returns 返回 { cached: 缓存的 URL 数据, missing: 需要重新获取的 file_id 列表 }
	 */
	getCachedUrls(
		fileIds: string[],
		fileUpdatedAtMap?: Map<string, string>,
	): {
		cached: GetTemporaryDownloadUrlItem[]
		missing: string[]
	} {
		const cached: GetTemporaryDownloadUrlItem[] = []
		const missing: string[] = []

		for (const fileId of fileIds) {
			const cachedItem = this.cache.get(fileId)
			const currentUpdatedAt = fileUpdatedAtMap?.get(fileId)

			// 检查缓存是否有效：
			// 1. 缓存项存在
			// 2. URL 未过期
			// 3. 文件的 updatedAt 未变化（如果提供了 updatedAt）
			// 如果文件的 updatedAt 更新了，即使 URL 未过期，也要重新获取最新的 URL
			const isUrlNotExpired = cachedItem && isUrlValid(cachedItem.expiresAt)
			const isUpdatedAtUnchanged = checkUpdatedAtUnchanged(
				cachedItem?.updatedAt,
				currentUpdatedAt,
			)

			if (isUrlNotExpired && isUpdatedAtUnchanged) {
				// 缓存有效，使用缓存的 URL
				cached.push({
					file_id: fileId,
					url: cachedItem.url,
					expires_at: cachedItem.expiresAt,
				})
			} else {
				// 缓存不存在、已过期或文件已更新，需要重新获取最新的 URL
				missing.push(fileId)
				// 清理旧的缓存，确保使用最新的 URL
				if (cachedItem) {
					this.cache.delete(fileId)
				}
			}
		}

		return { cached, missing }
	}

	/**
	 * 更新 URL 缓存
	 * @param urlData API 返回的 URL 数据
	 * @param fileUpdatedAtMap 文件 ID 到更新时间的映射，用于保存文件的更新时间
	 * 注意：只有当 expires_at 存在时才会缓存，如果 expires_at 为 undefined，则不缓存（每次都使用最新的 URL）
	 * 当文件的 updated_at 更新时，会重新获取最新的 URL 并更新缓存中的 updatedAt
	 */
	updateUrlCache(
		urlData: GetTemporaryDownloadUrlItem[],
		fileUpdatedAtMap?: Map<string, string>,
	): void {
		for (const item of urlData) {
			// 只有当 url 和 expires_at 都存在时才缓存
			// 如果 expires_at 为 undefined，不缓存，确保每次都使用最新的 URL
			if (item.url && item.expires_at) {
				const updatedAt = fileUpdatedAtMap?.get(item.file_id)
				// 保存最新的 URL 和文件的更新时间，用于后续判断文件是否已更新
				this.cache.set(item.file_id, {
					url: item.url,
					expiresAt: item.expires_at,
					updatedAt,
				})
			}
		}
	}

	/**
	 * 获取缓存项
	 */
	get(fileId: string): CachedUrlItem | undefined {
		return this.cache.get(fileId)
	}

	/**
	 * 设置缓存项
	 */
	set(fileId: string, item: CachedUrlItem): void {
		this.cache.set(fileId, item)
	}

	/**
	 * 删除缓存项
	 */
	delete(fileId: string): void {
		this.cache.delete(fileId)
	}

	/**
	 * 清空所有缓存
	 */
	clear(): void {
		this.cache.clear()
	}

	/**
	 * 检查文件是否已更新（用于判断是否需要刷新）
	 * @param fileId 文件 ID
	 * @param currentUpdatedAt 当前的更新时间
	 * @returns 如果文件已更新返回 true，否则返回 false
	 */
	isFileUpdated(fileId: string, currentUpdatedAt: string | undefined): boolean {
		const cachedItem = this.cache.get(fileId)
		if (!cachedItem) return false
		if (!currentUpdatedAt) return false
		return cachedItem.updatedAt !== currentUpdatedAt
	}

	/**
	 * 获取所有缓存的文件 ID
	 */
	getAllFileIds(): string[] {
		return Array.from(this.cache.keys())
	}
}

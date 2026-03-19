import { useCallback, useRef, useState } from "react"
import { DetailType } from "../../../types"

interface TabCacheOptions {
	maxCacheSize?: number
	enableCache?: boolean
	cacheOfficeFiles?: boolean
}

interface TabCacheItem {
	id: string
	lastAccessed: number
	renderProps: any
}

/**
 * useTabCache - Tab 缓存管理 Hook
 * 实现 LRU 缓存策略，管理多个 Render 实例
 */
export function useTabCache(options: TabCacheOptions = {}) {
	const { maxCacheSize = 10, enableCache = true, cacheOfficeFiles = true } = options
	const cacheRef = useRef<Map<string, TabCacheItem>>(new Map())

	// 获取缓存的所有 tab IDs
	const [cachedTabIds, setCachedTabIds] = useState<string[]>([])

	// 更新缓存的 tab IDs
	const updateCachedTabIds = useCallback(() => {
		setCachedTabIds(Array.from(cacheRef.current.keys()))
	}, [])

	// 添加或更新缓存
	const addToCache = useCallback(
		(tabId: string, renderProps: any) => {
			if (!enableCache) return

			// 检查是否为 Office 文件类型
			const isOfficeFile = [
				DetailType.Docx,
				DetailType.Excel,
				DetailType.PowerPoint,
			].includes(renderProps?.type)

			// 如果不缓存 Office 文件且当前是 Office 文件，则不进行缓存
			if (!cacheOfficeFiles && isOfficeFile) {
				console.log("Office file caching is disabled, skipping:", renderProps?.type)
				return
			}

			console.log(renderProps, "renderProps")

			const cache = cacheRef.current
			const now = Date.now()

			// 添加新项或更新现有项
			cache.set(tabId, {
				id: tabId,
				lastAccessed: now,
				renderProps,
			})

			// 如果缓存超过大小限制，移除最久未使用的项
			while (cache.size > maxCacheSize) {
				let oldestKey = ""
				let oldestTime = Number.MAX_SAFE_INTEGER

				for (const [key, item] of cache.entries()) {
					if (item.lastAccessed < oldestTime) {
						oldestTime = item.lastAccessed
						oldestKey = key
					}
				}

				// 如果时间戳相同，选择第一个（最早添加的）
				if (!oldestKey && cache.size > 0) {
					oldestKey = Array.from(cache.keys())[0]
				}

				if (oldestKey) {
					cache.delete(oldestKey)
				} else {
					break // 防止无限循环
				}
			}

			// 更新缓存的 tab IDs
			updateCachedTabIds()
		},
		[enableCache, maxCacheSize, cacheOfficeFiles, updateCachedTabIds],
	)

	// 从缓存中获取
	const getFromCache = useCallback(
		(tabId: string) => {
			if (!enableCache) return null

			const cache = cacheRef.current
			const item = cache.get(tabId)

			if (item) {
				// 更新访问时间
				item.lastAccessed = Date.now()
				return item.renderProps
			}

			return null
		},
		[enableCache],
	)

	// 从缓存中移除
	const removeFromCache = useCallback(
		(tabId: string) => {
			cacheRef.current.delete(tabId)
			updateCachedTabIds()
		},
		[updateCachedTabIds],
	)

	// 清空缓存
	const clearCache = useCallback(() => {
		cacheRef.current.clear()
		updateCachedTabIds()
	}, [updateCachedTabIds])

	// 获取缓存统计信息
	const getCacheStats = useCallback(() => {
		const cache = cacheRef.current
		return {
			size: cache.size,
			maxSize: maxCacheSize,
			keys: Array.from(cache.keys()),
		}
	}, [maxCacheSize])

	// 检查是否已缓存
	const isCached = useCallback((tabId: string) => {
		return cacheRef.current.has(tabId)
	}, [])

	return {
		addToCache,
		getFromCache,
		removeFromCache,
		clearCache,
		getCacheStats,
		isCached,
		cachedTabIds,
	}
}

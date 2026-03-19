/**
 * LRU (Least Recently Used) Cache Implementation
 * 支持自定义key进行数据隔离的LRU缓存
 */

import { isNumber } from "lodash-es"

export interface LRUCacheItem<T = any> {
	/** 缓存项的唯一标识 */
	key: string
	/** 缓存的数据 */
	value: T
	/** 添加时间戳 */
	timestamp: number
	/** 最后访问时间戳 */
	lastAccessed: number
}

export interface LRUCacheOptions {
	/** 最大缓存容量 */
	maxSize: number
	/** 缓存命名空间，用于数据隔离 */
	namespace?: string
	/** 是否启用持久化存储 */
	enablePersistence?: boolean
	/** 存储前缀，用于localStorage key */
	storagePrefix?: string
}

/**
 * LRU缓存类
 * 使用双向链表 + Map 实现高效的LRU算法
 */
export class LRUCache<T = any> {
	private readonly maxSize: number
	private readonly namespace: string
	private readonly enablePersistence: boolean
	private readonly storageKey: string

	// 使用Map保存缓存数据，保持插入顺序
	private cache = new Map<string, LRUCacheItem<T>>()

	constructor(options: LRUCacheOptions) {
		this.maxSize = Math.max(1, options.maxSize)
		this.namespace = options.namespace || "default"
		this.enablePersistence = options.enablePersistence ?? true
		this.storageKey = `${options.storagePrefix || "mention-lru-cache"}/${this.namespace}`

		// 从持久化存储加载数据
		if (this.enablePersistence) {
			this.loadFromStorage()
		}
	}

	/**
	 * 添加或更新缓存项
	 * @param key 缓存键
	 * @param value 缓存值
	 */
	put(key: string, value: T): void {
		const now = Date.now()

		// 如果已存在，删除旧项（稍后重新添加到最前面）
		if (this.cache.has(key)) {
			this.cache.delete(key)
		} else if (this.cache.size >= this.maxSize) {
			// 缓存已满，删除最久未使用的项（Map的第一个元素）
			const firstKey = this.cache.keys().next().value
			if (firstKey) {
				this.cache.delete(firstKey)
			}
		}

		// 添加新项到最后（最近使用）
		const item: LRUCacheItem<T> = {
			key,
			value,
			timestamp: now,
			lastAccessed: now,
		}

		this.cache.set(key, item)

		// 持久化存储
		if (this.enablePersistence) {
			this.saveToStorage()
		}
	}

	/**
	 * 获取缓存项
	 * @param key 缓存键
	 * @returns 缓存值或undefined
	 */
	get(key: string): T | undefined {
		const item = this.cache.get(key)
		if (!item) return undefined

		// 更新访问时间并移动到最后（标记为最近使用）
		item.lastAccessed = Date.now()
		this.cache.delete(key)
		this.cache.set(key, item)

		// 持久化存储
		if (this.enablePersistence) {
			this.saveToStorage()
		}

		return item.value
	}

	/**
	 * 检查是否存在某个键
	 * @param key 缓存键
	 * @returns 是否存在
	 */
	has(key: string): boolean {
		return this.cache.has(key)
	}

	/**
	 * 删除缓存项
	 * @param key 缓存键
	 * @returns 是否删除成功
	 */
	delete(key: string): boolean {
		const deleted = this.cache.delete(key)

		if (deleted && this.enablePersistence) {
			this.saveToStorage()
		}

		return deleted
	}

	/**
	 * 获取所有缓存项（按最近使用顺序）
	 * @returns 缓存项数组，最近使用的在前面
	 */
	getAll(): LRUCacheItem<T>[] {
		return Array.from(this.cache.values()).reverse() // reverse因为Map中最后的是最近使用的
	}

	getCount(): number {
		return this.cache.size
	}

	/**
	 * 获取最近使用的N项
	 * @param count 数量
	 * @returns 最近使用的缓存项数组
	 */
	getRecent(count?: number, filter?: (item: LRUCacheItem<T>) => boolean): LRUCacheItem<T>[] {
		const all = this.getAll()
		const filtered = all.filter(filter ?? (() => true))

		if (isNumber(count)) {
			return filtered.slice(0, Math.min(count, filtered.length))
		}
		return filtered
	}

	/**
	 * 清空缓存
	 */
	clear(): void {
		this.cache.clear()

		if (this.enablePersistence) {
			this.clearStorage()
		}
	}

	/**
	 * 获取缓存大小
	 * @returns 当前缓存项数量
	 */
	size(): number {
		return this.cache.size
	}

	/**
	 * 获取缓存命中率统计
	 * @returns 统计信息
	 */
	getStats(): {
		size: number
		maxSize: number
		namespace: string
		oldestItem?: LRUCacheItem<T>
		newestItem?: LRUCacheItem<T>
	} {
		const items = Array.from(this.cache.values())

		return {
			size: this.cache.size,
			maxSize: this.maxSize,
			namespace: this.namespace,
			oldestItem: items[0], // 第一个是最旧的
			newestItem: items[items.length - 1], // 最后一个是最新的
		}
	}

	/**
	 * 从localStorage加载数据
	 */
	private loadFromStorage(): void {
		try {
			const stored = localStorage.getItem(this.storageKey)
			if (!stored) return

			const data = JSON.parse(stored) as Array<LRUCacheItem<T>>

			// 按时间顺序恢复缓存（最旧的先加入）
			data.sort((a, b) => a.lastAccessed - b.lastAccessed).forEach((item) => {
				if (this.cache.size < this.maxSize) {
					this.cache.set(item.key, item)
				}
			})
		} catch (error) {
			console.warn(`[LRUCache] Failed to load from storage:`, error)
		}
	}

	/**
	 * 保存数据到localStorage
	 */
	private saveToStorage(): void {
		try {
			const data = Array.from(this.cache.values())
			localStorage.setItem(this.storageKey, JSON.stringify(data))
		} catch (error) {
			console.warn(`[LRUCache] Failed to save to storage:`, error)
		}
	}

	/**
	 * 清空localStorage
	 */
	private clearStorage(): void {
		try {
			localStorage.removeItem(this.storageKey)
		} catch (error) {
			console.warn(`[LRUCache] Failed to clear storage:`, error)
		}
	}
}

/**
 * 创建LRU缓存实例的工厂函数
 */
export function createLRUCache<T = any>(options: LRUCacheOptions): LRUCache<T> {
	return new LRUCache<T>(options)
}

/**
 * 全局缓存管理器，用于管理多个命名空间的缓存
 */
export class LRUCacheManager {
	private static instance: LRUCacheManager
	private caches = new Map<string, LRUCache<any>>()

	static getInstance(): LRUCacheManager {
		if (!LRUCacheManager.instance) {
			LRUCacheManager.instance = new LRUCacheManager()
		}
		return LRUCacheManager.instance
	}

	/**
	 * 获取或创建指定命名空间的缓存
	 */
	getCache<T = any>(
		namespace: string,
		options?: Omit<LRUCacheOptions, "namespace">,
	): LRUCache<T> {
		if (!this.caches.has(namespace)) {
			const cache = new LRUCache<T>({
				maxSize: 10,
				enablePersistence: true,
				storagePrefix: "mention-lru-cache",
				...options,
				namespace,
			})
			this.caches.set(namespace, cache)
		}
		return this.caches.get(namespace)!
	}

	/**
	 * 清空所有缓存
	 */
	clearAll(): void {
		this.caches.forEach((cache) => cache.clear())
		this.caches.clear()
	}
}

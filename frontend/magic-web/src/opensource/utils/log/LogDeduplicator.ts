interface LogEntry {
	hash: string
	count: number
	firstSeen: number
	lastSeen: number
	namespace: string
}

interface DeduplicationConfig {
	// 时间窗口，默认5分钟内的重复日志会被去重
	timeWindow: number
	// 最大重复次数，超过此次数将停止发送
	maxDuplicates: number
	// 缓存大小限制
	cacheSize: number
	// 定期清理间隔
	cleanupInterval: number
}

/**
 * 日志去重管理器
 * 防止相同错误被频繁重复发送到服务器
 */
export class LogDeduplicator {
	private static instance: LogDeduplicator
	private logCache = new Map<string, LogEntry>()
	private config: DeduplicationConfig
	private cleanupTimer: NodeJS.Timeout | null = null

	private constructor(config: Partial<DeduplicationConfig> = {}) {
		this.config = {
			timeWindow: 5 * 60 * 1000, // 5分钟
			maxDuplicates: 10, // 最多重复10次
			cacheSize: 1000, // 最多缓存1000条记录
			cleanupInterval: 10 * 60 * 1000, // 10分钟清理一次
			...config,
		}
		this.startCleanupTimer()
	}

	static getInstance(config?: Partial<DeduplicationConfig>): LogDeduplicator {
		if (!LogDeduplicator.instance) {
			LogDeduplicator.instance = new LogDeduplicator(config)
		}
		return LogDeduplicator.instance
	}

	/**
	 * 生成日志的唯一hash
	 */
	private generateLogHash(logData: Record<string, any>): string {
		try {
			// 使用关键信息生成hash：namespace + 错误消息 + 堆栈信息
			const keyInfo = {
				namespace: logData.namespace,
				data: logData.data
					?.map((item: any) => {
						if (typeof item === "object" && item?.stack) {
							// 对于错误对象，只取堆栈的前几行作为特征
							return item.stack?.split("\n").slice(0, 3).join("\n")
						}
						if (typeof item === "string") {
							return item
						}
						return JSON.stringify(item)
					})
					.join("|"),
				url: logData.url,
			}

			// 简单的hash函数
			return JSON.stringify(keyInfo)
				.replace(/[-Z0-9]/g, "")
				.substring(0, 32)
		} catch (error) {
			return `${Date.now()}`
		}
	}

	/**
	 * 检查日志是否应该被发送
	 * @param logData 日志数据
	 * @returns 是否应该发送日志
	 */
	shouldSendLog(logData: Record<string, any>): boolean {
		const hash = this.generateLogHash(logData)
		const now = Date.now()
		const existingEntry = this.logCache.get(hash)

		if (!existingEntry) {
			// 首次出现的日志，直接发送
			this.logCache.set(hash, {
				hash,
				count: 1,
				firstSeen: now,
				lastSeen: now,
				namespace: logData.namespace,
			})
			this.enforceCache()
			return true
		}

		// 检查是否超出时间窗口
		if (now - existingEntry.firstSeen > this.config.timeWindow) {
			// 超出时间窗口，重置计数
			existingEntry.count = 1
			existingEntry.firstSeen = now
			existingEntry.lastSeen = now
			return true
		}

		// 在时间窗口内，增加计数
		existingEntry.count++
		existingEntry.lastSeen = now

		// 检查是否超过最大重复次数
		if (existingEntry.count > this.config.maxDuplicates) {
			return false
		}

		// 对于频繁的错误，采用指数退避策略
		return this.shouldSendWithBackoff(existingEntry.count)
	}

	/**
	 * 指数退避策略
	 * 第1次：立即发送
	 * 第2次：立即发送
	 * 第3-4次：每次都发送
	 * 第5-8次：每2次发送1次
	 * 第9次及以上：每4次发送1次
	 */
	private shouldSendWithBackoff(count: number): boolean {
		if (count <= 4) return true
		if (count <= 8) return count % 2 === 0
		return count % 4 === 0
	}

	/**
	 * 限制缓存大小
	 */
	private enforceCache(): void {
		if (this.logCache.size <= this.config.cacheSize) return

		const entries = Array.from(this.logCache.entries())
		// 按最后见到时间排序，删除最旧的条目
		entries.sort((a, b) => a[1].lastSeen - b[1].lastSeen)

		const toDelete = entries.slice(0, this.logCache.size - this.config.cacheSize)
		toDelete.forEach(([hash]) => this.logCache.delete(hash))
	}

	/**
	 * 清理过期的日志条目
	 */
	private cleanup(): void {
		const now = Date.now()
		const expiredEntries: string[] = []

		this.logCache.forEach((entry, hash) => {
			if (now - entry.lastSeen > this.config.timeWindow) {
				expiredEntries.push(hash)
			}
		})

		expiredEntries.forEach((hash) => this.logCache.delete(hash))
	}

	/**
	 * 启动定期清理
	 */
	private startCleanupTimer(): void {
		if (this.cleanupTimer) {
			clearInterval(this.cleanupTimer)
		}

		this.cleanupTimer = setInterval(() => {
			this.cleanup()
		}, this.config.cleanupInterval)
	}

	/**
	 * 获取统计信息
	 */
	getStats() {
		const now = Date.now()
		const stats = {
			totalCachedLogs: this.logCache.size,
			recentLogs: 0,
			duplicatesByNamespace: {} as Record<string, number>,
		}

		this.logCache.forEach((entry) => {
			if (now - entry.lastSeen < this.config.timeWindow) {
				stats.recentLogs++
			}

			const namespace = entry.namespace || "unknown"
			stats.duplicatesByNamespace[namespace] =
				(stats.duplicatesByNamespace[namespace] || 0) + (entry.count - 1)
		})

		return stats
	}

	/**
	 * 清空缓存
	 */
	clear(): void {
		this.logCache.clear()
	}

	/**
	 * 销毁实例
	 */
	destroy(): void {
		if (this.cleanupTimer) {
			clearInterval(this.cleanupTimer)
			this.cleanupTimer = null
		}
		this.clear()
	}
}

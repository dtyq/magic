import type { AudioChunk } from "@/opensource/types/recordSummary"

/**
 * IndexedDB helper for storing large audio chunks
 * IndexedDB辅助类，用于存储大的音频分片数据
 */
export class IndexedDBHelper {
	private dbName: string
	private dbVersion = 1
	private storeName = "audioChunks"
	private db: IDBDatabase | null = null

	constructor(dbName: string) {
		this.dbName = dbName
	}

	/**
	 * Initialize IndexedDB connection
	 * 初始化IndexedDB连接
	 */
	async init(): Promise<void> {
		return new Promise((resolve, reject) => {
			if (!("indexedDB" in window)) {
				reject(new Error("IndexedDB is not supported"))
				return
			}

			const request = indexedDB.open(this.dbName, this.dbVersion)

			request.onerror = () => {
				reject(new Error(`Failed to open IndexedDB: ${request.error?.message}`))
			}

			request.onsuccess = () => {
				this.db = request.result
				resolve()
			}

			request.onupgradeneeded = (event) => {
				const db = (event.target as IDBOpenDBRequest).result

				// Create object store for audio chunks
				if (!db.objectStoreNames.contains(this.storeName)) {
					const store = db.createObjectStore(this.storeName, { keyPath: "id" })

					// Create indexes for efficient querying
					store.createIndex("sessionId", "sessionId", { unique: false })
					store.createIndex("timestamp", "timestamp", { unique: false })
					store.createIndex("status", "status", { unique: false })
				}
			}
		})
	}

	/**
	 * Save audio chunks to IndexedDB
	 * 保存音频分片到IndexedDB
	 */
	async saveChunks(chunks: AudioChunk[]): Promise<void> {
		if (!this.db) {
			await this.init()
		}

		return new Promise((resolve, reject) => {
			if (!this.db) {
				reject(new Error("Database not initialized"))
				return
			}

			const transaction = this.db.transaction([this.storeName], "readwrite")
			const store = transaction.objectStore(this.storeName)

			if (chunks.length === 0) {
				resolve()
				return
			}

			transaction.onerror = () => {
				reject(new Error(`Transaction failed: ${transaction.error?.message}`))
			}

			transaction.oncomplete = () => {
				resolve()
			}

			chunks.forEach((chunk) => {
				const request = store.put(chunk)

				request.onerror = () => {
					reject(new Error(`Failed to save chunk ${chunk.id}: ${request.error?.message}`))
				}

				request.onsuccess = () => {
					// Individual chunk saved successfully
				}
			})
		})
	}

	/**
	 * Load audio chunks from IndexedDB
	 * 从IndexedDB加载音频分片
	 */
	async loadChunks(sessionId?: string): Promise<AudioChunk[]> {
		if (!this.db) {
			await this.init()
		}

		return new Promise((resolve, reject) => {
			if (!this.db) {
				reject(new Error("Database not initialized"))
				return
			}

			const transaction = this.db.transaction([this.storeName], "readonly")
			const store = transaction.objectStore(this.storeName)
			const chunks: AudioChunk[] = []

			let request: IDBRequest

			if (sessionId) {
				// Load chunks for specific session
				const index = store.index("sessionId")
				request = index.getAll(sessionId)
			} else {
				// Load all chunks
				request = store.getAll()
			}

			request.onerror = () => {
				reject(new Error(`Failed to load chunks: ${request.error?.message}`))
			}

			request.onsuccess = () => {
				const results = request.result as AudioChunk[]
				chunks.push(...results)
				resolve(chunks)
			}

			transaction.onerror = () => {
				reject(new Error(`Transaction failed: ${transaction.error?.message}`))
			}
		})
	}

	/**
	 * Delete chunks by session ID
	 * 根据会话ID删除分片
	 */
	async deleteChunksBySession(sessionId: string): Promise<void> {
		if (!this.db) {
			await this.init()
		}

		return new Promise((resolve, reject) => {
			if (!this.db) {
				reject(new Error("Database not initialized"))
				return
			}

			const transaction = this.db.transaction([this.storeName], "readwrite")
			const store = transaction.objectStore(this.storeName)
			const index = store.index("sessionId")

			// First, get all chunks for this session
			const getRequest = index.getAll(sessionId)

			getRequest.onerror = () => {
				reject(new Error(`Failed to get chunks: ${getRequest.error?.message}`))
			}

			getRequest.onsuccess = () => {
				const chunks = getRequest.result as AudioChunk[]

				if (chunks.length === 0) {
					resolve()
					return
				}

				// Delete each chunk
				let deletedCount = 0
				chunks.forEach((chunk) => {
					const deleteRequest = store.delete(chunk.id)

					deleteRequest.onerror = () => {
						reject(
							new Error(
								`Failed to delete chunk ${chunk.id}: ${deleteRequest.error?.message}`,
							),
						)
					}

					deleteRequest.onsuccess = () => {
						deletedCount++
						if (deletedCount === chunks.length) {
							resolve()
						}
					}
				})
			}

			transaction.onerror = () => {
				reject(new Error(`Transaction failed: ${transaction.error?.message}`))
			}
		})
	}

	/**
	 * Delete old chunks based on timestamp
	 * 根据时间戳删除旧的分片
	 */
	async deleteOldChunks(olderThanTimestamp: number): Promise<number> {
		if (!this.db) {
			await this.init()
		}

		return new Promise((resolve, reject) => {
			if (!this.db) {
				reject(new Error("Database not initialized"))
				return
			}

			const transaction = this.db.transaction([this.storeName], "readwrite")
			const store = transaction.objectStore(this.storeName)
			const index = store.index("timestamp")

			// Get chunks older than specified timestamp
			const range = IDBKeyRange.upperBound(olderThanTimestamp)
			const request = index.getAll(range)

			request.onerror = () => {
				reject(new Error(`Failed to get old chunks: ${request.error?.message}`))
			}

			request.onsuccess = () => {
				const oldChunks = request.result as AudioChunk[]

				if (oldChunks.length === 0) {
					resolve(0)
					return
				}

				// Delete old chunks
				let deletedCount = 0
				oldChunks.forEach((chunk) => {
					const deleteRequest = store.delete(chunk.id)

					deleteRequest.onerror = () => {
						reject(
							new Error(
								`Failed to delete old chunk ${chunk.id}: ${deleteRequest.error?.message}`,
							),
						)
					}

					deleteRequest.onsuccess = () => {
						deletedCount++
						if (deletedCount === oldChunks.length) {
							resolve(deletedCount)
						}
					}
				})
			}

			transaction.onerror = () => {
				reject(new Error(`Transaction failed: ${transaction.error?.message}`))
			}
		})
	}

	/**
	 * Get storage usage information
	 * 获取存储使用信息
	 */
	async getStorageInfo(): Promise<{
		totalChunks: number
		totalSize: number
		oldestTimestamp: number
		newestTimestamp: number
	}> {
		if (!this.db) {
			await this.init()
		}

		return new Promise((resolve, reject) => {
			if (!this.db) {
				reject(new Error("Database not initialized"))
				return
			}

			const transaction = this.db.transaction([this.storeName], "readonly")
			const store = transaction.objectStore(this.storeName)
			const request = store.getAll()

			request.onerror = () => {
				reject(new Error(`Failed to get storage info: ${request.error?.message}`))
			}

			request.onsuccess = () => {
				const chunks = request.result as AudioChunk[]

				if (chunks.length === 0) {
					resolve({
						totalChunks: 0,
						totalSize: 0,
						oldestTimestamp: 0,
						newestTimestamp: 0,
					})
					return
				}

				const totalSize = chunks.reduce((sum, chunk) => sum + chunk.size, 0)
				const timestamps = chunks.map((chunk) => chunk.timestamp)

				resolve({
					totalChunks: chunks.length,
					totalSize,
					oldestTimestamp: Math.min(...timestamps),
					newestTimestamp: Math.max(...timestamps),
				})
			}

			transaction.onerror = () => {
				reject(new Error(`Transaction failed: ${transaction.error?.message}`))
			}
		})
	}

	/**
	 * Clear all data from IndexedDB
	 * 清除IndexedDB中的所有数据
	 */
	async clear(): Promise<void> {
		if (!this.db) {
			await this.init()
		}

		return new Promise((resolve, reject) => {
			if (!this.db) {
				reject(new Error("Database not initialized"))
				return
			}

			const transaction = this.db.transaction([this.storeName], "readwrite")
			const store = transaction.objectStore(this.storeName)
			const request = store.clear()

			request.onerror = () => {
				reject(new Error(`Failed to clear store: ${request.error?.message}`))
			}

			request.onsuccess = () => {
				resolve()
			}

			transaction.onerror = () => {
				reject(new Error(`Transaction failed: ${transaction.error?.message}`))
			}
		})
	}

	/**
	 * Close database connection
	 * 关闭数据库连接
	 */
	close(): void {
		if (this.db) {
			this.db.close()
			this.db = null
		}
	}

	/**
	 * Delete the entire database
	 * 删除整个数据库
	 */
	async deleteDatabase(): Promise<void> {
		return new Promise((resolve, reject) => {
			// Close existing connection
			this.close()

			const deleteRequest = indexedDB.deleteDatabase(this.dbName)

			deleteRequest.onerror = () => {
				reject(new Error(`Failed to delete database: ${deleteRequest.error?.message}`))
			}

			deleteRequest.onsuccess = () => {
				resolve()
			}

			deleteRequest.onblocked = () => {
				reject(new Error("Database deletion blocked by other connections"))
			}
		})
	}
}

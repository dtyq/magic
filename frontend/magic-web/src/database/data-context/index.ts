import { platformKey } from "@/utils/storage"
import Dexie from "dexie"
import { logger as Logger } from "@/utils/log"
import { DataContextDb } from "./types"

const logger = Logger.createLogger("data-context-db")

export const DataContextDbName = (magicId: string, userId: string) =>
	platformKey(`data-content/${magicId}/${userId}`)

/**
 * Check if IndexedDB is available
 */
function isIndexedDBAvailable(): boolean {
	try {
		return typeof indexedDB !== "undefined" && !!indexedDB
	} catch {
		return false
	}
}

/**
 * IndexedDB unavailable error
 */
export class DataContextDBUnavailableError extends Error {
	constructor(message = "IndexedDB is not available for data context") {
		super(message)
		this.name = "DataContextDBUnavailableError"
	}
}

/**
 * Data Context Database Manager
 */
class DataContextDatabaseManager {
	private dbs: Map<string, DataContextDb> = new Map()
	private dbStatus: Map<string, boolean> = new Map()

	/**
	 * Get database key for caching
	 */
	private getDbKey(magicId: string, userId: string): string {
		return `${magicId}:${userId}`
	}

	/**
	 * Check database availability
	 */
	async checkDatabaseAvailability(db: DataContextDb): Promise<boolean> {
		try {
			const fn = async () => {
				await db?.open()
			}
			const timeoutPromise = new Promise<never>((_, reject) => {
				setTimeout(() => {
					reject(new DataContextDBUnavailableError("indexedDB connection failed"))
				}, 5000)
			})
			await Promise.race([fn(), timeoutPromise])
			return true
		} catch (error) {
			logger.error("Database availability check failed", error)
			return false
		}
	}

	/**
	 * Initialize data context database with error handling
	 */
	async initDataContextDb(magicId: string, userId: string): Promise<DataContextDb> {
		const dbKey = this.getDbKey(magicId, userId)

		// Return cached instance if available and working
		const cachedDb = this.dbs.get(dbKey)
		const cachedStatus = this.dbStatus.get(dbKey)

		if (cachedDb && cachedStatus) {
			return cachedDb
		}

		// Check if IndexedDB is available
		if (!isIndexedDBAvailable()) {
			logger.error("IndexedDB not available for data context", { magicId, userId })
			this.dbStatus.set(dbKey, false)
			throw new DataContextDBUnavailableError(
				"IndexedDB is not available. This may happen in private browsing mode or after browser updates.",
			)
		}

		try {
			const db = new Dexie(DataContextDbName(magicId, userId)) as DataContextDb

			// Set up database schema
			db.version(1).stores({
				user_info: "&user_id",
				group_info: "&id",
			})

			// Test database functionality
			const isAvailable = await this.checkDatabaseAvailability(db)

			if (!isAvailable) {
				this.dbStatus.set(dbKey, false)
				throw new DataContextDBUnavailableError("Database functionality test failed")
			}

			// Cache successful database instance
			this.dbs.set(dbKey, db)
			this.dbStatus.set(dbKey, true)

			logger.log("Data context database initialized successfully", { magicId, userId })
			return db
		} catch (error) {
			this.dbStatus.set(dbKey, false)
			logger.error("Failed to initialize data context database", { magicId, userId }, error)

			if (error instanceof DataContextDBUnavailableError) {
				throw error
			}

			throw new DataContextDBUnavailableError(
				`Failed to initialize data context database: ${error instanceof Error ? error.message : "Unknown error"
				}`,
			)
		}
	}

	/**
	 * Retry database initialization
	 */
	async retryInitialization(magicId: string, userId: string): Promise<DataContextDb | null> {
		const dbKey = this.getDbKey(magicId, userId)

		try {
			// Clear cached failed state
			this.dbs.delete(dbKey)
			this.dbStatus.delete(dbKey)

			// Retry initialization
			return await this.initDataContextDb(magicId, userId)
		} catch (error) {
			logger.error("Database retry initialization failed", { magicId, userId }, error)
			return null
		}
	}

	/**
	 * Get database status
	 */
	getDatabaseStatus(magicId: string, userId: string): { isAvailable: boolean; hasDb: boolean } {
		const dbKey = this.getDbKey(magicId, userId)
		return {
			isAvailable: this.dbStatus.get(dbKey) ?? false,
			hasDb: this.dbs.has(dbKey),
		}
	}

	/**
	 * Clear database cache
	 */
	clearCache(magicId?: string, userId?: string): void {
		if (magicId && userId) {
			const dbKey = this.getDbKey(magicId, userId)
			this.dbs.delete(dbKey)
			this.dbStatus.delete(dbKey)
		} else {
			this.dbs.clear()
			this.dbStatus.clear()
		}
	}
}

// Singleton instance
const dataContextDbManager = new DataContextDatabaseManager()

/**
 * Initialize data context database (backward compatible function)
 */
export const initDataContextDb = (magicId: string, userId: string): Promise<DataContextDb> => {
	return dataContextDbManager.initDataContextDb(magicId, userId)
}

/**
 * Retry database initialization
 */
export const retryDataContextDbInit = (
	magicId: string,
	userId: string,
): Promise<DataContextDb | null> => {
	return dataContextDbManager.retryInitialization(magicId, userId)
}

/**
 * Get database status
 */
export const getDataContextDbStatus = (magicId: string, userId: string) => {
	return dataContextDbManager.getDatabaseStatus(magicId, userId)
}

/**
 * Clear database cache
 */
export const clearDataContextDbCache = (magicId?: string, userId?: string): void => {
	dataContextDbManager.clearCache(magicId, userId)
}

/**
 * Check if IndexedDB is available (utility export)
 */
export { isIndexedDBAvailable }

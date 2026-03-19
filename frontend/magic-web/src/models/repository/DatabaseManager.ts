import Dexie from "dexie"
import type { TableSchema } from "./types"
import { logger as Logger } from "@/utils/log"

const logger = Logger.createLogger("database")

/**
 * 检查 IndexedDB 是否可用
 */
function isIndexedDBAvailable(): boolean {
	try {
		return typeof indexedDB !== "undefined" && !!indexedDB
	} catch {
		return false
	}
}

/**
 * 检查存储配额是否充足
 */
async function checkStorageQuota(): Promise<{ available: boolean; usage: number; quota: number }> {
	try {
		if ("storage" in navigator && "estimate" in navigator.storage) {
			const estimate = await navigator.storage.estimate()
			const usage = estimate.usage || 0
			const quota = estimate.quota || 0
			const usageRatio = quota > 0 ? usage / quota : 0

			// 如果使用率超过 90%，认为配额不足
			const available = usageRatio < 0.9

			return { available, usage, quota }
		}
		return { available: true, usage: 0, quota: 0 }
	} catch {
		return { available: true, usage: 0, quota: 0 }
	}
}

/**
 * IndexedDB 不可用错误
 */
class IndexedDBUnavailableError extends Error {
	constructor(message = "IndexedDB is not available") {
		super(message)
		this.name = "IndexedDBUnavailableError"
	}
}

// interface IStoreConfigs {
// 	name: string
// 	options: IDBObjectStoreParameters
// 	indexes: Array<{
// 		name: string
// 		keyPath: Array<string> | string
// 		options: IDBIndexParameters
// 	}>
// }

// interface DBConfig {
// 	version: number
// 	stores: IStoreConfigs[]
// }
//
// /**
//  * ======================== 数据库表定义 ========================
//  */
// const enum TableName {
// 	Message = "message",
// 	Rooms = "rooms",
// }

// // 数据库配置示例
// // @ts-ignore
// const DEFAULT_DB_CONFIG: DBConfig = {
// 	version: 1,
// 	stores: [
// 		{
// 			name: TableName.Message,
// 			options: { keyPath: "id", autoIncrement: false },
// 			indexes: [{ name: "email", keyPath: "email", options: { unique: true } }],
// 		},
// 		{
// 			name: TableName.Rooms,
// 			options: { keyPath: "roomId", autoIncrement: true },
// 			indexes: [
// 				{ name: "roomId", keyPath: "roomId", options: { unique: false } },
// 				{ name: "content", keyPath: "content", options: { unique: false } },
// 				{ name: "updatedAt", keyPath: "updatedAt", options: { unique: false } },
// 			],
// 		},
// 	],
// }
//
// // 数据库配置示例
// // @ts-ignore
// const GLOBAL_DB_CONFIG: DBConfig = {
// 	version: 1,
// 	stores: [
// 		{
// 			name: "config",
// 			options: { keyPath: "id", autoIncrement: false },
// 			indexes: [{ name: "email", keyPath: "email", options: { unique: true } }],
// 		},
// 	],
// }

export class DatabaseManager {
	private static instance: DatabaseManager

	private databases: Map<string, Dexie> = new Map()

	private globalDatabase: Dexie | undefined

	// 数据库检测Promise缓存，确保只执行一次
	private dbCheckPromise: Promise<void> | undefined

	// 全局数据库初始化Promise缓存
	private globalDatabasePromise: Promise<Dexie> | undefined

	// private tableSchemas: Map<string, TableSchema[]> = new Map()

	private constructor() {
		// 私有构造函数
		this.setupGlobalErrorHandling()
	}

	public static getInstance(): DatabaseManager {
		if (!DatabaseManager.instance) {
			DatabaseManager.instance = new DatabaseManager()
		}
		return DatabaseManager.instance
	}

	/**
	 * 设置全局错误处理
	 */
	private setupGlobalErrorHandling() {
		// 监听 IndexedDB 全局错误
		if (typeof window !== "undefined" && window.addEventListener) {
			window.addEventListener("unhandledrejection", (event) => {
				if (
					event.reason?.name?.includes("Database") ||
					event.reason?.message?.includes("IndexedDB")
				) {
					logger.error("unhandledDatabaseError", event.reason)
				}
			})
		}
	}

	/**
	 * 执行数据库检测（单次执行，共享Promise）
	 */
	private async ensureDatabaseAvailable(): Promise<void> {
		if (this.dbCheckPromise) {
			return this.dbCheckPromise
		}

		this.dbCheckPromise = this.performDatabaseCheck()
		return this.dbCheckPromise
	}

	/**
	 * 执行实际的数据库检测逻辑
	 */
	private async performDatabaseCheck(): Promise<void> {
		// 检查 IndexedDB 是否可用
		if (!isIndexedDBAvailable()) {
			logger.error("indexedDBNotAvailable")
			throw new IndexedDBUnavailableError("IndexedDB is not available")
		}

		// 检查存储配额
		const storageStatus = await checkStorageQuota()
		if (!storageStatus.available) {
			logger.error("storageQuotaInsufficient", {
				usage: storageStatus.usage,
				quota: storageStatus.quota,
				usageRatio:
					storageStatus.quota > 0
						? ((storageStatus.usage / storageStatus.quota) * 100).toFixed(2) + "%"
						: "unknown",
			})
			// 不抛出错误，而是记录警告，让应用继续运行
		}

		// 测试数据库连接
		const fn = async () => {
			const testDb = new Dexie("available-test", { allowEmptyDB: true })
			const result = await testDb.open()
			testDb.close()
			return result
		}

		// 添加超时保护
		const timeoutPromise = () =>
			new Promise<never>((_, reject) => {
				setTimeout(() => {
					logger.error("indexedDBConnectionFailed")
					reject(new Error("indexedDBConnectionFailed"))
				}, 10000)
			})

		await Promise.race([fn(), timeoutPromise()])
	}

	// /**
	//  * @description 初始化数据库管理器
	//  * @param schemas 数据库表结构定义列表
	//  */
	// public initialize(schemas: TableSchema[]): void {
	// 	if (this.initialized) {
	// 		return
	// 	}

	// 	// 注册全局数据库的表结构
	// 	this.tableSchemas.set("magic-global", schemas)
	// 	this.initialized = true
	// }

	// private updateDatabaseSchema(db: Dexie, schemas: TableSchema[]): void {
	// 	const version = Math.max(...schemas.map((s) => s.version))
	// 	const storeSchema: Record<string, string> = {}

	// 	schemas.forEach(({ name, schema }) => {
	// 		storeSchema[name] = schema
	// 	})

	// 	db.version(version).stores(storeSchema)
	// }

	public async getDatabase(userId: string): Promise<Dexie> {
		// 执行单次数据库检测
		await this.ensureDatabaseAvailable()

		const dbName = `magic-user-${userId}`
		const existingDb = this.databases.get(dbName)
		if (existingDb) {
			return existingDb
		}
		const db = await this.initDatabase(dbName, 1, [
			{ name: "config-table", schema: "key, value, enabled, createdAt, updatedAt" },
		])
		this.databases.set(dbName, db)
		return db
	}

	public async getGlobalDatabase(): Promise<Dexie> {
		// 如果全局数据库初始化Promise已存在，直接返回
		if (this.globalDatabasePromise) {
			return this.globalDatabasePromise
		}

		// 创建全局数据库初始化Promise并缓存
		this.globalDatabasePromise = this.initializeGlobalDatabase()
		return this.globalDatabasePromise
	}

	/**
	 * 初始化全局数据库的内部实现
	 */
	private async initializeGlobalDatabase(): Promise<Dexie> {
		// 执行单次数据库检测
		await this.ensureDatabaseAvailable()

		// 如果全局数据库已存在，直接返回
		if (this.globalDatabase) {
			return this.globalDatabase
		}

		// 初始化全局数据库
		const dbName = "magic-global"
		const db = new Dexie(dbName)

		// // Version 1: 原始表结构（不含 super-project-state）
		// // 保留历史版本定义，确保向后兼容
		// db.version(1).stores({
		// 	config: "&key, value",
		// 	user: "&key, value",
		// 	account: "&magic_id, deployCode, magic_user_id, organizationCode",
		// 	cluster: "&deployCode, name",
		// 	audioChunks: "&id, sessionId, index, timestamp, size, createdAt, updatedAt",
		// })

		// Version 2: 添加 super-project-state 表
		// 当老用户首次加载包含此版本的代码时，Dexie 会自动触发升级
		db.version(2)
			.stores({
				config: "&key, value",
				user: "&key, value",
				account: "&magic_id, deployCode, magic_user_id, organizationCode",
				cluster: "&deployCode, name",
				audioChunks: "&id, sessionId, index, timestamp, size, createdAt, updatedAt",
				"super-project-state":
					"&id, organization_code, project_id, fileState, treeState, searchState, uiState, createdAt, updatedAt",
			})
			.upgrade(async () => {
				// 升级回调：从 v1 升级到 v2 时执行
				logger.log("databaseUpgradeToV2", {
					version: 2,
					newTable: "super-project-state",
					message:
						"Successfully upgraded database to version 2, added super-project-state table",
				})
			})

		this.globalDatabase = db
		return this.globalDatabase
	}

	/**
	 * 重置数据库检测状态（用于错误恢复）
	 */
	public resetDatabaseCheck(): void {
		this.dbCheckPromise = undefined
		this.globalDatabasePromise = undefined
	}

	/**
	 * 基础数据库初始化方法
	 */
	private async initDatabase(
		dbName: string,
		version: number,
		schemas: TableSchema[],
	): Promise<Dexie> {
		const db = new Dexie(dbName)
		const storeSchema: Record<string, string> = {}

		schemas.forEach(({ name, schema }) => {
			storeSchema[name] = schema
		})

		db.version(version).stores(storeSchema)

		return db
	}
}

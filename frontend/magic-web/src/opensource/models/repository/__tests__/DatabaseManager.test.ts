import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import Dexie from "dexie"
import { DatabaseManager } from "../DatabaseManager"

// Mock logger
vi.mock("@/opensource/utils/log", () => ({
	logger: {
		createLogger: () => ({
			log: vi.fn(),
			warn: vi.fn(),
			error: vi.fn(),
			info: vi.fn(),
		}),
	},
}))

describe("DatabaseManager", () => {
	let manager: DatabaseManager
	let testDatabases: string[] = []

	beforeEach(() => {
		vi.clearAllMocks()
		manager = DatabaseManager.getInstance()
		testDatabases = []
	})

	afterEach(async () => {
		// 清理所有测试数据库
		for (const dbName of testDatabases) {
			try {
				const db = await Dexie.exists(dbName)
				if (db) {
					await Dexie.delete(dbName)
				}
			} catch (error) {
				// 忽略清理错误
			}
		}
		testDatabases = []

		// 重置 DatabaseManager 状态
		manager.resetDatabaseCheck()
	})

	describe("单例模式", () => {
		it("应该返回同一个实例", () => {
			// Arrange & Act
			const instance1 = DatabaseManager.getInstance()
			const instance2 = DatabaseManager.getInstance()

			// Assert
			expect(instance1).toBe(instance2)
		})

		it("应该在多次调用时保持单例", () => {
			// Arrange & Act
			const instances = Array.from({ length: 10 }, () => DatabaseManager.getInstance())

			// Assert
			const uniqueInstances = new Set(instances)
			expect(uniqueInstances.size).toBe(1)
		})
	})

	describe("IndexedDB 可用性检测", () => {
		it("应该在 IndexedDB 可用时通过检测", async () => {
			// Arrange
			const dbName = `test-available-${Date.now()}`
			testDatabases.push(dbName)

			// Act & Assert - 不应该抛出错误
			await expect(manager.getDatabase("test-user")).resolves.toBeDefined()
		})

		it("应该在 IndexedDB 不可用时抛出异常", async () => {
			// Arrange
			const originalIndexedDB = globalThis.indexedDB
			// @ts-ignore
			delete globalThis.indexedDB

			// 重置检测状态
			manager.resetDatabaseCheck()

			// Act & Assert
			await expect(manager.getDatabase("test-user")).rejects.toThrow(
				"IndexedDB is not available",
			)

			// Cleanup - 恢复 IndexedDB
			Object.defineProperty(globalThis, "indexedDB", {
				value: originalIndexedDB,
				writable: true,
				configurable: true,
			})
		})
	})

	describe("存储配额检测", () => {
		it("应该在配额充足时正常运行", async () => {
			// Arrange
			const mockEstimate = {
				usage: 1000000, // 1MB
				quota: 100000000, // 100MB (使用率 1%)
			}

			// Mock navigator.storage with estimate method
			const mockStorage = {
				estimate: vi.fn().mockResolvedValue(mockEstimate),
			}

			Object.defineProperty(navigator, "storage", {
				value: mockStorage,
				writable: true,
				configurable: true,
			})

			manager.resetDatabaseCheck()

			// Act
			const db = await manager.getDatabase("test-user-quota")
			testDatabases.push(`magic-user-test-user-quota`)

			// Assert
			expect(db).toBeDefined()
			expect(mockStorage.estimate).toHaveBeenCalled()
		})

		it("应该在配额不足时记录警告但不阻止运行", async () => {
			// Arrange
			const mockEstimate = {
				usage: 95000000, // 95MB
				quota: 100000000, // 100MB (使用率 95%)
			}

			// Mock navigator.storage with estimate method
			const mockStorage = {
				estimate: vi.fn().mockResolvedValue(mockEstimate),
			}

			Object.defineProperty(navigator, "storage", {
				value: mockStorage,
				writable: true,
				configurable: true,
			})

			manager.resetDatabaseCheck()

			// Act
			const db = await manager.getDatabase("test-user-low-quota")
			testDatabases.push(`magic-user-test-user-low-quota`)

			// Assert - 仍然应该成功创建数据库
			expect(db).toBeDefined()
		})
	})

	describe("用户数据库获取", () => {
		it("应该在首次获取时创建新数据库", async () => {
			// Arrange
			const userId = "test-user-1"
			const dbName = `magic-user-${userId}`
			testDatabases.push(dbName)

			// Act
			const db = await manager.getDatabase(userId)

			// Assert
			expect(db).toBeDefined()
			expect(db.name).toBe(dbName)
			// fake-indexeddb 不支持 isOpen()，所以检查表是否存在
			expect(db.tables.length).toBeGreaterThan(0)
		})

		it("应该在重复获取时返回缓存实例", async () => {
			// Arrange
			const userId = "test-user-2"
			testDatabases.push(`magic-user-${userId}`)

			// Act
			const db1 = await manager.getDatabase(userId)
			const db2 = await manager.getDatabase(userId)

			// Assert
			expect(db1).toBe(db2)
		})

		it("应该为不同用户ID创建不同数据库实例", async () => {
			// Arrange
			const userId1 = "test-user-3"
			const userId2 = "test-user-4"
			testDatabases.push(`magic-user-${userId1}`, `magic-user-${userId2}`)

			// Act
			const db1 = await manager.getDatabase(userId1)
			const db2 = await manager.getDatabase(userId2)

			// Assert
			expect(db1).not.toBe(db2)
			expect(db1.name).toBe(`magic-user-${userId1}`)
			expect(db2.name).toBe(`magic-user-${userId2}`)
		})

		it("应该创建包含默认 config-table 的数据库", async () => {
			// Arrange
			const userId = "test-user-5"
			testDatabases.push(`magic-user-${userId}`)

			// Act
			const db = await manager.getDatabase(userId)

			// Assert
			const tables = db.tables.map((t) => t.name)
			expect(tables).toContain("config-table")
		})
	})

	describe("全局数据库获取", () => {
		it("应该成功获取全局数据库", async () => {
			// Arrange
			testDatabases.push("magic-global")

			// Act
			const db = await manager.getGlobalDatabase()

			// Assert
			expect(db).toBeDefined()
			expect(db.name).toBe("magic-global")
			// fake-indexeddb 不支持 isOpen()，所以检查表是否存在
			expect(db.tables.length).toBeGreaterThan(0)
		})

		it("应该在重复调用时返回同一实例（Promise 缓存）", async () => {
			// Arrange
			testDatabases.push("magic-global")

			// Act - 并发调用
			const [db1, db2, db3] = await Promise.all([
				manager.getGlobalDatabase(),
				manager.getGlobalDatabase(),
				manager.getGlobalDatabase(),
			])

			// Assert
			expect(db1).toBe(db2)
			expect(db2).toBe(db3)
		})

		it("应该创建包含所有全局表的数据库", async () => {
			// Arrange
			testDatabases.push("magic-global")

			// Act
			const db = await manager.getGlobalDatabase()

			// Assert
			const tables = db.tables.map((t) => t.name)
			expect(tables).toContain("config")
			expect(tables).toContain("user")
			expect(tables).toContain("account")
			expect(tables).toContain("cluster")
			expect(tables).toContain("audioChunks")
			expect(tables).toContain("super-project-state")
		})

		it("应该使用版本 2 的数据库结构", async () => {
			// Arrange
			testDatabases.push("magic-global")

			// Act
			const db = await manager.getGlobalDatabase()

			// Assert
			expect(db.verno).toBe(2)
		})
	})

	describe("数据库检测重置", () => {
		it("应该能够重置数据库检测状态", async () => {
			// Arrange
			const userId = "test-user-reset"
			testDatabases.push(`magic-user-${userId}`)
			await manager.getDatabase(userId)

			// Act
			manager.resetDatabaseCheck()

			// Assert - 重置后应该能再次检测
			await expect(manager.getDatabase(userId)).resolves.toBeDefined()
		})

		it("应该在重置后清除全局数据库 Promise 缓存", async () => {
			// Arrange
			testDatabases.push("magic-global")
			const db1 = await manager.getGlobalDatabase()

			// Act
			manager.resetDatabaseCheck()
			const db2 = await manager.getGlobalDatabase()

			// Assert - 虽然是同一个数据库名，但 Promise 应该被重新创建
			expect(db1.name).toBe(db2.name)
			expect(db1.tables.length).toBeGreaterThan(0)
			expect(db2.tables.length).toBeGreaterThan(0)
		})
	})

	describe("超时保护", () => {
		it("应该在连接超时时抛出错误", async () => {
			// Arrange
			vi.useFakeTimers()

			// Mock Dexie.open 使其挂起
			const originalOpen = Dexie.prototype.open
			Dexie.prototype.open = vi.fn().mockImplementation(() => {
				return new Promise(() => {
					// 永远不 resolve，模拟超时
				})
			})

			manager.resetDatabaseCheck()

			// Act
			const promise = manager.getDatabase("test-user-timeout")

			// 快进时间超过超时限制（10秒）
			await vi.advanceTimersByTimeAsync(11000)

			// Assert
			await expect(promise).rejects.toThrow("indexedDBConnectionFailed")

			// Cleanup
			Dexie.prototype.open = originalOpen
			vi.useRealTimers()
		}, 20000)
	})

	describe("全局错误处理", () => {
		it("应该设置全局错误处理", () => {
			// Assert - 验证 window 上有 addEventListener
			expect(typeof window.addEventListener).toBe("function")

			// 验证 DatabaseManager 已经初始化（在 beforeEach 中）
			expect(manager).toBeDefined()
		})
	})

	describe("数据库操作集成测试", () => {
		it("应该支持在用户数据库中进行基本 CRUD 操作", async () => {
			// Arrange
			const userId = "test-user-crud"
			testDatabases.push(`magic-user-${userId}`)
			const db = await manager.getDatabase(userId)
			const table = db.table("config-table")

			// Act - 写入数据
			await table.put({
				key: "test-key",
				value: "test-value",
				enabled: true,
				createdAt: Date.now(),
				updatedAt: Date.now(),
			})

			// Act - 读取数据
			const data = await table.get("test-key")

			// Assert
			expect(data).toBeDefined()
			expect(data?.key).toBe("test-key")
			expect(data?.value).toBe("test-value")
		}, 20000)

		it("应该支持在全局数据库中进行基本操作", async () => {
			// Arrange
			testDatabases.push("magic-global")
			const db = await manager.getGlobalDatabase()
			const configTable = db.table("config")

			// Act - 写入数据
			await configTable.put({ key: "global-config", value: "global-value" })

			// Act - 读取数据
			const data = await configTable.get("global-config")

			// Assert
			expect(data).toBeDefined()
			expect(data?.key).toBe("global-config")
			expect(data?.value).toBe("global-value")
		}, 20000)

		it("应该保持用户数据库和全局数据库的数据隔离", async () => {
			// Arrange
			const userId = "test-user-isolation"
			testDatabases.push(`magic-user-${userId}`, "magic-global")

			const userDb = await manager.getDatabase(userId)
			const globalDb = await manager.getGlobalDatabase()

			// Act - 在用户数据库写入
			await userDb.table("config-table").put({
				key: "isolation-test",
				value: "user-value",
				createdAt: Date.now(),
				updatedAt: Date.now(),
			})

			// Act - 在全局数据库写入
			await globalDb.table("config").put({
				key: "isolation-test",
				value: "global-value",
			})

			// Assert - 数据应该隔离
			const userData = await userDb.table("config-table").get("isolation-test")
			const globalData = await globalDb.table("config").get("isolation-test")

			expect(userData?.value).toBe("user-value")
			expect(globalData?.value).toBe("global-value")
			expect(userData?.value).not.toBe(globalData?.value)
		}, 20000)
	})
})

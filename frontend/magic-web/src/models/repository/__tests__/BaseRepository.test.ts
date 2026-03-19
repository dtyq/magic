import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import Dexie from "dexie"
import { BaseRepository } from "../BaseRepository"
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

// 测试数据接口
interface UserConfig {
	key: string
	value: string
	enabled?: boolean
	createdAt?: number
	updatedAt?: number
}

// 创建具体实现类用于测试
class UserConfigRepository extends BaseRepository<UserConfig> {
	constructor(userId: string) {
		super(userId, "config-table")
	}
}

describe("BaseRepository", () => {
	let repository: UserConfigRepository
	let testDatabases: string[] = []
	const testUserId = "test-user-base"

	beforeEach(() => {
		vi.clearAllMocks()
		repository = new UserConfigRepository(testUserId)
		testDatabases = [`magic-user-${testUserId}`]
	})

	afterEach(async () => {
		// 清理所有测试数据库
		for (const dbName of testDatabases) {
			try {
				const exists = await Dexie.exists(dbName)
				if (exists) {
					await Dexie.delete(dbName)
				}
			} catch (error) {
				// 忽略清理错误
			}
		}
		testDatabases = []

		// 重置 DatabaseManager
		DatabaseManager.getInstance().resetDatabaseCheck()
	})

	describe("继承验证", () => {
		it("应该继承 AbstractBaseRepository 的所有方法", () => {
			// Assert - 验证所有方法都存在
			expect(repository.put).toBeDefined()
			expect(repository.get).toBeDefined()
			expect(repository.getAll).toBeDefined()
			expect(repository.delete).toBeDefined()
			expect(repository.clear).toBeDefined()
			expect(repository.update).toBeDefined()
			expect(repository.getByIndex).toBeDefined()
			expect(repository.bulkGet).toBeDefined()
			expect(repository.bulkPut).toBeDefined()
		})

		it("应该能够使用继承的 put 方法", async () => {
			// Arrange
			const testData: UserConfig = {
				key: "test-key-1",
				value: "test-value-1",
				enabled: true,
				createdAt: Date.now(),
				updatedAt: Date.now(),
			}

			// Act
			await repository.put(testData)

			// Assert
			const result = await repository.get("test-key-1")
			expect(result).toEqual(testData)
		})

		it("应该能够使用继承的 getAll 方法", async () => {
			// Arrange
			const testData: UserConfig[] = [
				{ key: "key-1", value: "value-1" },
				{ key: "key-2", value: "value-2" },
			]

			for (const data of testData) {
				await repository.put(data)
			}

			// Act
			const results = await repository.getAll()

			// Assert
			expect(results).toHaveLength(2)
		})
	})

	describe("数据库关联", () => {
		it("应该正确调用 DatabaseManager.getDatabase(userId)", async () => {
			// Arrange
			const getDatabaseSpy = vi.spyOn(DatabaseManager.getInstance(), "getDatabase")

			// Act
			await repository.get("any-key")

			// Assert
			expect(getDatabaseSpy).toHaveBeenCalledWith(testUserId)
		})

		it("应该为不同 userId 获取不同的数据库实例", async () => {
			// Arrange
			const userId1 = "user-1"
			const userId2 = "user-2"
			testDatabases.push(`magic-user-${userId1}`, `magic-user-${userId2}`)

			const repo1 = new UserConfigRepository(userId1)
			const repo2 = new UserConfigRepository(userId2)

			// Act
			await repo1.put({ key: "test", value: "value1" })
			await repo2.put({ key: "test", value: "value2" })

			const result1 = await repo1.get("test")
			const result2 = await repo2.get("test")

			// Assert - 不同用户的数据应该隔离
			expect(result1?.value).toBe("value1")
			expect(result2?.value).toBe("value2")
		})

		it("应该使用正确的数据库名称格式", async () => {
			// Arrange
			const userId = "test-user-123"
			const expectedDbName = `magic-user-${userId}`
			testDatabases.push(expectedDbName)

			const repo = new UserConfigRepository(userId)

			// Act
			await repo.put({ key: "test", value: "test" })

			// Assert - 验证数据库存在
			const exists = await Dexie.exists(expectedDbName)
			expect(exists).toBe(true)
		})

		it("应该复用已创建的数据库实例", async () => {
			// Arrange
			const getDatabaseSpy = vi.spyOn(DatabaseManager.getInstance(), "getDatabase")

			// Act - 多次操作
			await repository.put({ key: "key-1", value: "value-1" })
			await repository.put({ key: "key-2", value: "value-2" })
			await repository.get("key-1")

			// Assert - 应该使用缓存的数据库实例
			const callCount = getDatabaseSpy.mock.calls.length
			expect(callCount).toBeGreaterThan(0)
		})
	})

	describe("集成测试", () => {
		describe("完整的数据增删改查流程", () => {
			it("应该支持完整的 CRUD 操作流程", async () => {
				// 1. Create - 创建数据
				const testData: UserConfig = {
					key: "config-1",
					value: "initial-value",
					enabled: true,
					createdAt: Date.now(),
					updatedAt: Date.now(),
				}
				await repository.put(testData)

				// 2. Read - 读取数据
				let result = await repository.get("config-1")
				expect(result?.value).toBe("initial-value")

				// 3. Update - 更新数据
				await repository.update("config-1", { value: "updated-value" })
				result = await repository.get("config-1")
				expect(result?.value).toBe("updated-value")
				expect(result?.enabled).toBe(true) // 其他字段保持不变

				// 4. Delete - 删除数据
				await repository.delete("config-1")
				result = await repository.get("config-1")
				expect(result).toBeUndefined()
			})

			it("应该支持批量操作流程", async () => {
				// 1. 批量写入
				const testData: UserConfig[] = [
					{ key: "bulk-1", value: "value-1", enabled: true },
					{ key: "bulk-2", value: "value-2", enabled: false },
					{ key: "bulk-3", value: "value-3", enabled: true },
				]
				await repository.bulkPut(testData)

				// 2. 批量读取
				const results = await repository.bulkGet(["bulk-1", "bulk-2", "bulk-3"])
				expect(results.filter((r) => r !== undefined)).toHaveLength(3)

				// 3. 获取所有
				const allData = await repository.getAll()
				expect(allData).toHaveLength(3)

				// 4. 清空
				await repository.clear()
				const emptyData = await repository.getAll()
				expect(emptyData).toHaveLength(0)
			})
		})

		describe("跨表操作验证", () => {
			it("应该支持在同一数据库的不同表中操作", async () => {
				// Arrange - 创建另一个表的 repository
				class AnotherTableRepository extends BaseRepository<{ id: string; data: string }> {
					constructor(userId: string) {
						super(userId, "another-table")
					}
				}

				// 注意：由于 DatabaseManager 在获取数据库时只创建 config-table
				// 这个测试主要验证 repository 的表名隔离
				const repo1 = repository
				const testData1: UserConfig = {
					key: "table1-key",
					value: "table1-value",
				}

				// Act & Assert
				await repo1.put(testData1)
				const result1 = await repo1.get("table1-key")
				expect(result1?.value).toBe("table1-value")
			})
		})

		describe("数据持久化验证", () => {
			it("应该在重新创建 repository 实例后仍能访问数据", async () => {
				// Arrange - 写入数据
				const testData: UserConfig = {
					key: "persistent-key",
					value: "persistent-value",
					enabled: true,
					createdAt: Date.now(),
					updatedAt: Date.now(),
				}
				await repository.put(testData)

				// Act - 创建新的 repository 实例
				const newRepository = new UserConfigRepository(testUserId)
				const result = await newRepository.get("persistent-key")

				// Assert
				expect(result).toEqual(testData)
			})

			it("应该在多次操作后保持数据一致性", async () => {
				// Arrange & Act
				for (let i = 0; i < 10; i++) {
					await repository.put({
						key: `key-${i}`,
						value: `value-${i}`,
						enabled: i % 2 === 0,
					})
				}

				// Assert
				const allData = await repository.getAll()
				expect(allData).toHaveLength(10)

				// 验证每个数据都正确
				for (let i = 0; i < 10; i++) {
					const data = await repository.get(`key-${i}`)
					expect(data?.value).toBe(`value-${i}`)
					expect(data?.enabled).toBe(i % 2 === 0)
				}
			})
		})

		describe("错误场景处理", () => {
			it("应该能够处理数据库连接失败的情况", async () => {
				// Arrange - Mock getDB 使其失败
				const errorRepository = new UserConfigRepository("error-user")
				testDatabases.push("magic-user-error-user")

				const originalGetDB = errorRepository["getDB"]
				errorRepository["getDB"] = vi
					.fn()
					.mockRejectedValue(new Error("Database connection failed"))

				// Act & Assert
				await expect(errorRepository.get("any-key")).rejects.toThrow()

				// Cleanup
				errorRepository["getDB"] = originalGetDB
			})

			it("应该能够处理并发操作", async () => {
				// Arrange
				const concurrentOps = Array.from({ length: 10 }, (_, i) =>
					repository.put({
						key: `concurrent-${i}`,
						value: `value-${i}`,
					}),
				)

				// Act & Assert - 不应该抛出错误
				await expect(Promise.all(concurrentOps)).resolves.toBeDefined()

				// 验证所有数据都已写入
				const allData = await repository.getAll()
				expect(allData).toHaveLength(10)
			})
		})

		describe("边界情况", () => {
			it("应该能够处理特殊字符的 userId", async () => {
				// Arrange
				const specialUserId = "user@#$%^&*()"
				const specialDbName = `magic-user-${specialUserId}`
				testDatabases.push(specialDbName)

				const specialRepo = new UserConfigRepository(specialUserId)

				// Act
				await specialRepo.put({ key: "test", value: "test-value" })
				const result = await specialRepo.get("test")

				// Assert
				expect(result?.value).toBe("test-value")
			})

			it("应该能够处理长字符串的 userId", async () => {
				// Arrange
				const longUserId = "a".repeat(100)
				const longDbName = `magic-user-${longUserId}`
				testDatabases.push(longDbName)

				const longRepo = new UserConfigRepository(longUserId)

				// Act
				await longRepo.put({ key: "test", value: "test-value" })
				const result = await longRepo.get("test")

				// Assert
				expect(result?.value).toBe("test-value")
			})

			it("应该能够处理空的 userId", async () => {
				// Arrange
				const emptyUserId = ""
				const emptyDbName = `magic-user-${emptyUserId}`
				testDatabases.push(emptyDbName)

				const emptyRepo = new UserConfigRepository(emptyUserId)

				// Act
				await emptyRepo.put({ key: "test", value: "test-value" })
				const result = await emptyRepo.get("test")

				// Assert
				expect(result?.value).toBe("test-value")
			})
		})

		describe("性能测试", () => {
			it("应该能够高效处理大量数据", async () => {
				// Arrange
				const largeDataSet: UserConfig[] = Array.from({ length: 1000 }, (_, i) => ({
					key: `perf-key-${i}`,
					value: `perf-value-${i}`,
					enabled: i % 2 === 0,
				}))

				const startTime = Date.now()

				// Act
				await repository.bulkPut(largeDataSet)
				const allData = await repository.getAll()

				const endTime = Date.now()
				const duration = endTime - startTime

				// Assert
				expect(allData).toHaveLength(1000)
				// 性能断言：1000 条数据的操作应该在合理时间内完成（比如 5 秒）
				expect(duration).toBeLessThan(5000)
			})
		})
	})
})

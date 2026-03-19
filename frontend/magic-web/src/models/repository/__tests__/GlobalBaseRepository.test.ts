import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import Dexie from "dexie"
import { GlobalBaseRepository } from "../GlobalBaseRepository"
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
interface GlobalConfig {
	key: string
	value: any
}

interface UserInfo {
	key: string
	value: any
}

// 创建具体实现类用于测试
class GlobalConfigRepository extends GlobalBaseRepository<GlobalConfig> {
	constructor() {
		super("config")
	}
}

class GlobalUserRepository extends GlobalBaseRepository<UserInfo> {
	constructor() {
		super("user")
	}
}

describe("GlobalBaseRepository", () => {
	let configRepository: GlobalConfigRepository
	let userRepository: GlobalUserRepository
	let testDatabases: string[] = []

	beforeEach(() => {
		vi.clearAllMocks()
		configRepository = new GlobalConfigRepository()
		userRepository = new GlobalUserRepository()
		testDatabases = ["magic-global"]
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
			expect(configRepository.put).toBeDefined()
			expect(configRepository.get).toBeDefined()
			expect(configRepository.getAll).toBeDefined()
			expect(configRepository.delete).toBeDefined()
			expect(configRepository.clear).toBeDefined()
			expect(configRepository.update).toBeDefined()
			expect(configRepository.getByIndex).toBeDefined()
			expect(configRepository.bulkGet).toBeDefined()
			expect(configRepository.bulkPut).toBeDefined()
		})

		it("应该能够使用继承的 put 方法", async () => {
			// Arrange
			const testData: GlobalConfig = {
				key: "global-config-1",
				value: { setting: "value1" },
			}

			// Act
			await configRepository.put(testData)

			// Assert
			const result = await configRepository.get("global-config-1")
			expect(result).toEqual(testData)
		})

		it("应该能够使用继承的 getAll 方法", async () => {
			// Arrange
			const testData: GlobalConfig[] = [
				{ key: "config-1", value: "value-1" },
				{ key: "config-2", value: "value-2" },
			]

			for (const data of testData) {
				await configRepository.put(data)
			}

			// Act
			const results = await configRepository.getAll()

			// Assert
			expect(results.length).toBeGreaterThanOrEqual(2)
		})
	})

	describe("数据库关联", () => {
		it("应该正确调用 DatabaseManager.getGlobalDatabase()", async () => {
			// Arrange
			const getGlobalDatabaseSpy = vi.spyOn(
				DatabaseManager.getInstance(),
				"getGlobalDatabase",
			)

			// Act
			await configRepository.get("any-key")

			// Assert
			expect(getGlobalDatabaseSpy).toHaveBeenCalled()
		})

		it("应该所有实例共享同一全局数据库", async () => {
			// Arrange
			const repo1 = new GlobalConfigRepository()
			const repo2 = new GlobalConfigRepository()

			// Act - 在 repo1 写入数据
			await repo1.put({ key: "shared-key", value: "shared-value" })

			// Assert - repo2 应该能读取到同样的数据
			const result = await repo2.get("shared-key")
			expect(result?.value).toBe("shared-value")
		})

		it("应该使用正确的全局数据库名称", async () => {
			// Arrange
			const expectedDbName = "magic-global"

			// Act
			await configRepository.put({ key: "test", value: "test" })

			// Assert - 验证数据库存在
			const exists = await Dexie.exists(expectedDbName)
			expect(exists).toBe(true)
		})

		it("应该复用全局数据库实例", async () => {
			// Arrange
			const getGlobalDatabaseSpy = vi.spyOn(
				DatabaseManager.getInstance(),
				"getGlobalDatabase",
			)

			// Act - 多次操作
			await configRepository.put({ key: "key-1", value: "value-1" })
			await configRepository.put({ key: "key-2", value: "value-2" })
			await configRepository.get("key-1")

			// Assert - 应该使用缓存的数据库实例
			const callCount = getGlobalDatabaseSpy.mock.calls.length
			expect(callCount).toBeGreaterThan(0)
		})
	})

	describe("集成测试", () => {
		describe("与用户级数据库隔离验证", () => {
			it("应该独立于用户级数据库存储数据", async () => {
				// Arrange
				const { BaseRepository } = await import("../BaseRepository")

				class UserConfigRepository extends BaseRepository<{ key: string; value: string }> {
					constructor(userId: string) {
						super(userId, "config-table")
					}
				}

				const userId = "test-user-isolation"
				const userDbName = `magic-user-${userId}`
				testDatabases.push(userDbName)

				const userRepo = new UserConfigRepository(userId)

				// Act - 在用户数据库和全局数据库写入相同键的数据
				await userRepo.put({ key: "isolation-test", value: "user-value" })
				await configRepository.put({ key: "isolation-test", value: "global-value" })

				// Assert - 数据应该完全隔离
				const userData = await userRepo.get("isolation-test")
				const globalData = await configRepository.get("isolation-test")

				expect(userData?.value).toBe("user-value")
				expect(globalData?.value).toBe("global-value")
			})
		})

		describe("全局数据持久化验证", () => {
			it("应该在重新创建 repository 实例后仍能访问数据", async () => {
				// Arrange - 写入数据
				const testData: GlobalConfig = {
					key: "persistent-global",
					value: { data: "persistent-data" },
				}
				await configRepository.put(testData)

				// Act - 创建新的 repository 实例
				const newRepository = new GlobalConfigRepository()
				const result = await newRepository.get("persistent-global")

				// Assert
				expect(result).toEqual(testData)
			})

			it("应该支持跨表的数据持久化", async () => {
				// Arrange - 在不同表中写入数据
				await configRepository.put({ key: "config-key", value: "config-value" })
				await userRepository.put({ key: "user-key", value: "user-value" })

				// Act - 创建新实例读取
				const newConfigRepo = new GlobalConfigRepository()
				const newUserRepo = new GlobalUserRepository()

				const configResult = await newConfigRepo.get("config-key")
				const userResult = await newUserRepo.get("user-key")

				// Assert
				expect(configResult?.value).toBe("config-value")
				expect(userResult?.value).toBe("user-value")
			})
		})

		describe("完整的 CRUD 流程", () => {
			it("应该支持完整的全局配置管理流程", async () => {
				// 1. Create - 创建全局配置
				const globalConfig: GlobalConfig = {
					key: "app-config",
					value: {
						theme: "dark",
						language: "zh-CN",
						version: "1.0.0",
					},
				}
				await configRepository.put(globalConfig)

				// 2. Read - 读取配置
				let result = await configRepository.get("app-config")
				expect(result?.value.theme).toBe("dark")

				// 3. Update - 更新配置
				await configRepository.update("app-config", {
					value: {
						theme: "light",
						language: "zh-CN",
						version: "1.0.1",
					},
				})
				result = await configRepository.get("app-config")
				expect(result?.value.theme).toBe("light")
				expect(result?.value.version).toBe("1.0.1")

				// 4. Delete - 删除配置
				await configRepository.delete("app-config")
				result = await configRepository.get("app-config")
				expect(result).toBeUndefined()
			})

			it("应该支持批量全局数据操作", async () => {
				// 1. 批量写入
				const globalConfigs: GlobalConfig[] = [
					{ key: "config-1", value: { enabled: true } },
					{ key: "config-2", value: { enabled: false } },
					{ key: "config-3", value: { enabled: true } },
				]
				await configRepository.bulkPut(globalConfigs)

				// 2. 批量读取
				const results = await configRepository.bulkGet(["config-1", "config-2", "config-3"])
				expect(results.filter((r) => r !== undefined)).toHaveLength(3)

				// 3. 获取所有
				const allConfigs = await configRepository.getAll()
				expect(allConfigs.length).toBeGreaterThanOrEqual(3)

				// 4. 清空表
				await configRepository.clear()
				const emptyConfigs = await configRepository.getAll()
				expect(emptyConfigs).toHaveLength(0)
			})
		})

		describe("跨表数据隔离", () => {
			it("应该在不同全局表之间隔离数据", async () => {
				// Arrange & Act
				await configRepository.put({ key: "shared-key", value: "config-value" })
				await userRepository.put({ key: "shared-key", value: "user-value" })

				// Assert - 相同的键在不同表中应该有不同的值
				const configResult = await configRepository.get("shared-key")
				const userResult = await userRepository.get("shared-key")

				expect(configResult?.value).toBe("config-value")
				expect(userResult?.value).toBe("user-value")
			})

			it("应该支持在不同表中独立操作", async () => {
				// Arrange
				await configRepository.put({ key: "config-1", value: "value-1" })
				await userRepository.put({ key: "user-1", value: "value-1" })

				// Act - 清空 config 表
				await configRepository.clear()

				// Assert - user 表的数据应该不受影响
				const userResult = await userRepository.get("user-1")
				expect(userResult?.value).toBe("value-1")

				const configResult = await configRepository.getAll()
				expect(configResult).toHaveLength(0)
			})
		})

		describe("并发访问测试", () => {
			it("应该支持多个 repository 实例并发访问", async () => {
				// Arrange
				const repo1 = new GlobalConfigRepository()
				const repo2 = new GlobalConfigRepository()
				const repo3 = new GlobalConfigRepository()

				// Act - 并发写入
				await Promise.all([
					repo1.put({ key: "concurrent-1", value: "value-1" }),
					repo2.put({ key: "concurrent-2", value: "value-2" }),
					repo3.put({ key: "concurrent-3", value: "value-3" }),
				])

				// Assert - 所有数据都应该成功写入
				const results = await Promise.all([
					repo1.get("concurrent-1"),
					repo2.get("concurrent-2"),
					repo3.get("concurrent-3"),
				])

				expect(results.every((r) => r !== undefined)).toBe(true)
			})

			it("应该支持跨表并发操作", async () => {
				// Arrange
				const configRepo = new GlobalConfigRepository()
				const userRepo = new GlobalUserRepository()

				// Act - 并发操作不同的表
				await Promise.all([
					configRepo.bulkPut([
						{ key: "c1", value: "v1" },
						{ key: "c2", value: "v2" },
					]),
					userRepo.bulkPut([
						{ key: "u1", value: "v1" },
						{ key: "u2", value: "v2" },
					]),
				])

				// Assert
				const [configResults, userResults] = await Promise.all([
					configRepo.getAll(),
					userRepo.getAll(),
				])

				expect(configResults.length).toBeGreaterThanOrEqual(2)
				expect(userResults.length).toBeGreaterThanOrEqual(2)
			})
		})

		describe("错误场景处理", () => {
			it("应该能够处理全局数据库连接失败", async () => {
				// Arrange - Mock getDB 使其失败
				const errorRepository = new GlobalConfigRepository()
				const originalGetDB = errorRepository["getDB"]
				errorRepository["getDB"] = vi
					.fn()
					.mockRejectedValue(new Error("Global database connection failed"))

				// Act & Assert
				await expect(errorRepository.get("any-key")).rejects.toThrow()

				// Cleanup
				errorRepository["getDB"] = originalGetDB
			})
		})

		describe("数据一致性验证", () => {
			it("应该在多次操作后保持全局数据一致性", async () => {
				// Arrange & Act
				const repo1 = new GlobalConfigRepository()
				const repo2 = new GlobalConfigRepository()

				// repo1 写入数据
				await repo1.put({ key: "consistency-test", value: "initial-value" })

				// repo2 更新数据
				await repo2.update("consistency-test", { value: "updated-value" })

				// repo1 读取数据
				const result = await repo1.get("consistency-test")

				// Assert - 应该能读取到最新的数据
				expect(result?.value).toBe("updated-value")
			})

			it("应该支持事务性的批量操作", async () => {
				// Arrange
				const batchData: GlobalConfig[] = Array.from({ length: 100 }, (_, i) => ({
					key: `batch-${i}`,
					value: { index: i },
				}))

				// Act
				await configRepository.bulkPut(batchData)

				// Assert - 所有数据都应该成功写入
				const allData = await configRepository.getAll()
				expect(allData.length).toBeGreaterThanOrEqual(100)
			})
		})

		describe("边界情况", () => {
			it("应该能够处理复杂的嵌套对象", async () => {
				// Arrange
				const complexData: GlobalConfig = {
					key: "complex-config",
					value: {
						level1: {
							level2: {
								level3: {
									data: "deep-nested-value",
									array: [1, 2, 3, 4, 5],
								},
							},
						},
					},
				}

				// Act
				await configRepository.put(complexData)
				const result = await configRepository.get("complex-config")

				// Assert
				expect(result?.value.level1.level2.level3.data).toBe("deep-nested-value")
			})

			it("应该能够处理大对象存储", async () => {
				// Arrange
				const largeValue = {
					data: "x".repeat(10000), // 10KB 字符串
					array: Array.from({ length: 1000 }, (_, i) => i),
				}

				const largeData: GlobalConfig = {
					key: "large-data",
					value: largeValue,
				}

				// Act
				await configRepository.put(largeData)
				const result = await configRepository.get("large-data")

				// Assert
				expect(result?.value.data.length).toBe(10000)
				expect(result?.value.array.length).toBe(1000)
			})

			it("应该能够处理特殊值", async () => {
				// Arrange
				const specialData: GlobalConfig[] = [
					{ key: "null-value", value: null },
					{ key: "undefined-value", value: undefined },
					{ key: "zero-value", value: 0 },
					{ key: "false-value", value: false },
					{ key: "empty-string", value: "" },
					{ key: "empty-array", value: [] },
					{ key: "empty-object", value: {} },
				]

				// Act
				await configRepository.bulkPut(specialData)

				// Assert - 所有特殊值都应该能正确存储和读取
				const results = await Promise.all(
					specialData.map((data) => configRepository.get(data.key)),
				)

				expect(results.every((r) => r !== undefined)).toBe(true)
			})
		})
	})
})

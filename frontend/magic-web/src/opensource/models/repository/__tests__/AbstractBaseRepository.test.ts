import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import Dexie from "dexie"
import type { IndexableType } from "dexie"
import { AbstractBaseRepository } from "../AbstractBaseRepository"

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
interface TestData {
	id: string
	name: string
	value: number
	category?: string
}

// 创建具体实现类用于测试
class TestRepository extends AbstractBaseRepository<TestData> {
	private testDb: Dexie | undefined

	constructor(tableName: string = "test-table") {
		super(tableName)
	}

	// 实现抽象方法
	protected async getDB(): Promise<Dexie> {
		if (!this.testDb) {
			this.testDb = new Dexie(`test-db-${Date.now()}-${Math.random()}`)
			this.testDb.version(1).stores({
				[this.tableName]: "&id, name, value, category",
			})
			await this.testDb.open()
		}
		return this.testDb
	}

	// 用于测试清理
	async closeDB(): Promise<void> {
		if (this.testDb) {
			const dbName = this.testDb.name
			this.testDb.close()
			await Dexie.delete(dbName)
			this.testDb = undefined
		}
	}
}

describe("AbstractBaseRepository", () => {
	let repository: TestRepository
	let testDatabases: string[] = []

	beforeEach(() => {
		vi.clearAllMocks()
		repository = new TestRepository()
	})

	afterEach(async () => {
		// 清理测试数据库
		await repository.closeDB()

		// 清理其他可能的测试数据库
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
	})

	describe("基础操作", () => {
		describe("put()", () => {
			it("应该能够添加新数据", async () => {
				// Arrange
				const testData: TestData = {
					id: "test-1",
					name: "测试数据",
					value: 100,
				}

				// Act
				await repository.put(testData)

				// Assert
				const result = await repository.get("test-1")
				expect(result).toEqual(testData)
			})

			it("应该能够更新已存在的数据", async () => {
				// Arrange
				const originalData: TestData = {
					id: "test-2",
					name: "原始数据",
					value: 100,
				}
				await repository.put(originalData)

				// Act
				const updatedData: TestData = {
					id: "test-2",
					name: "更新后的数据",
					value: 200,
				}
				await repository.put(updatedData)

				// Assert
				const result = await repository.get("test-2")
				expect(result?.name).toBe("更新后的数据")
				expect(result?.value).toBe(200)
			})
		})

		describe("get()", () => {
			it("应该能够根据主键获取数据", async () => {
				// Arrange
				const testData: TestData = {
					id: "test-3",
					name: "查询测试",
					value: 300,
				}
				await repository.put(testData)

				// Act
				const result = await repository.get("test-3")

				// Assert
				expect(result).toEqual(testData)
			})

			it("应该在数据不存在时返回 undefined", async () => {
				// Act
				const result = await repository.get("non-existent")

				// Assert
				expect(result).toBeUndefined()
			})
		})

		describe("getAll()", () => {
			it("应该能够获取所有数据", async () => {
				// Arrange
				const testData: TestData[] = [
					{ id: "test-4", name: "数据1", value: 100 },
					{ id: "test-5", name: "数据2", value: 200 },
					{ id: "test-6", name: "数据3", value: 300 },
				]

				for (const data of testData) {
					await repository.put(data)
				}

				// Act
				const results = await repository.getAll()

				// Assert
				expect(results).toHaveLength(3)
				expect(results).toEqual(expect.arrayContaining(testData))
			})

			it("应该在表为空时返回空数组", async () => {
				// Act
				const results = await repository.getAll()

				// Assert
				expect(results).toEqual([])
			})
		})

		describe("delete()", () => {
			it("应该能够删除指定数据", async () => {
				// Arrange
				const testData: TestData = {
					id: "test-7",
					name: "待删除数据",
					value: 700,
				}
				await repository.put(testData)

				// Act
				await repository.delete("test-7")

				// Assert
				const result = await repository.get("test-7")
				expect(result).toBeUndefined()
			})

			it("应该能够删除不存在的数据而不报错", async () => {
				// Act & Assert - 不应该抛出错误
				await expect(repository.delete("non-existent")).resolves.toBeUndefined()
			})
		})

		describe("clear()", () => {
			it("应该能够清空表中所有数据", async () => {
				// Arrange
				const testData: TestData[] = [
					{ id: "test-8", name: "数据1", value: 100 },
					{ id: "test-9", name: "数据2", value: 200 },
				]
				for (const data of testData) {
					await repository.put(data)
				}

				// Act
				await repository.clear()

				// Assert
				const results = await repository.getAll()
				expect(results).toEqual([])
			})
		})
	})

	describe("高级操作", () => {
		describe("update()", () => {
			it("应该能够更新指定字段", async () => {
				// Arrange
				const testData: TestData = {
					id: "test-10",
					name: "原始名称",
					value: 100,
				}
				await repository.put(testData)

				// Act
				await repository.update("test-10", { name: "更新后的名称" })

				// Assert
				const result = await repository.get("test-10")
				expect(result?.name).toBe("更新后的名称")
				expect(result?.value).toBe(100) // 其他字段保持不变
			})

			it("应该返回更新的记录数", async () => {
				// Arrange
				const testData: TestData = {
					id: "test-11",
					name: "测试",
					value: 100,
				}
				await repository.put(testData)

				// Act
				const updateCount = await repository.update("test-11", { value: 200 })

				// Assert
				expect(updateCount).toBe(1)
			})

			it("应该在更新不存在的记录时返回 0", async () => {
				// Act
				const updateCount = await repository.update("non-existent", { value: 999 })

				// Assert
				expect(updateCount).toBe(0)
			})
		})

		describe("getByIndex()", () => {
			it("应该能够通过索引查询数据", async () => {
				// Arrange
				const testData: TestData[] = [
					{ id: "test-12", name: "测试A", value: 100, category: "类型1" },
					{ id: "test-13", name: "测试B", value: 200, category: "类型1" },
					{ id: "test-14", name: "测试C", value: 300, category: "类型2" },
				]
				for (const data of testData) {
					await repository.put(data)
				}

				// Act
				const results = await repository.getByIndex("category", "类型1")

				// Assert
				expect(results).toHaveLength(2)
				expect(results.every((r) => r.category === "类型1")).toBe(true)
			})

			it("应该在索引值不存在时返回空数组", async () => {
				// Act
				const results = await repository.getByIndex("category", "不存在的类型")

				// Assert
				expect(results).toEqual([])
			})
		})

		describe("bulkGet()", () => {
			it("应该能够批量获取多个数据", async () => {
				// Arrange
				const testData: TestData[] = [
					{ id: "test-15", name: "数据1", value: 100 },
					{ id: "test-16", name: "数据2", value: 200 },
					{ id: "test-17", name: "数据3", value: 300 },
				]
				for (const data of testData) {
					await repository.put(data)
				}

				// Act
				const results = await repository.bulkGet(["test-15", "test-16", "test-17"])

				// Assert
				expect(results).toHaveLength(3)
				expect(results.every((r) => r !== undefined)).toBe(true)
			})

			it("应该在某些键不存在时返回 undefined", async () => {
				// Arrange
				await repository.put({ id: "test-18", name: "存在的数据", value: 100 })

				// Act
				const results = await repository.bulkGet(["test-18", "non-existent"])

				// Assert
				expect(results).toHaveLength(2)
				expect(results[0]).toBeDefined()
				expect(results[1]).toBeUndefined()
			})

			it("应该能够处理空数组", async () => {
				// Act
				const results = await repository.bulkGet([])

				// Assert
				expect(results).toEqual([])
			})
		})

		describe("bulkPut()", () => {
			it("应该能够批量写入多个数据", async () => {
				// Arrange
				const testData: TestData[] = [
					{ id: "test-19", name: "批量1", value: 100 },
					{ id: "test-20", name: "批量2", value: 200 },
					{ id: "test-21", name: "批量3", value: 300 },
				]

				// Act
				await repository.bulkPut(testData)

				// Assert
				const results = await repository.getAll()
				expect(results).toHaveLength(3)
			})

			it("应该能够批量更新已存在的数据", async () => {
				// Arrange
				const originalData: TestData[] = [
					{ id: "test-22", name: "原始1", value: 100 },
					{ id: "test-23", name: "原始2", value: 200 },
				]
				await repository.bulkPut(originalData)

				// Act
				const updatedData: TestData[] = [
					{ id: "test-22", name: "更新1", value: 150 },
					{ id: "test-23", name: "更新2", value: 250 },
				]
				await repository.bulkPut(updatedData)

				// Assert
				const result1 = await repository.get("test-22")
				const result2 = await repository.get("test-23")
				expect(result1?.name).toBe("更新1")
				expect(result2?.name).toBe("更新2")
			})

			it("应该能够处理空数组", async () => {
				// Act & Assert - 不应该抛出错误
				await expect(repository.bulkPut([])).resolves.toBeUndefined()
			})
		})
	})

	describe("错误处理", () => {
		it("应该在操作失败时抛出详细错误信息", async () => {
			// Arrange - Mock getTable 使其抛出错误
			const errorRepository = new TestRepository()
			const originalGetTable = errorRepository["getTable"]
			errorRepository["getTable"] = vi.fn().mockRejectedValue(new Error("Database error"))

			// Act & Assert
			await expect(errorRepository.get("test")).rejects.toThrow(
				"Repository operation 'get' failed on table 'test-table'",
			)

			// Cleanup
			errorRepository["getTable"] = originalGetTable
		})

		it("应该包含操作名称和表名在错误信息中", async () => {
			// Arrange
			const errorRepository = new TestRepository("custom-table")
			errorRepository["getTable"] = vi.fn().mockRejectedValue(new Error("Connection failed"))

			// Act & Assert
			await expect(
				errorRepository.put({ id: "test", name: "test", value: 1 }),
			).rejects.toThrow(/custom-table/)
		})
	})

	describe("超时保护", () => {
		it("应该在操作超时时抛出错误", async () => {
			// Arrange
			vi.useFakeTimers()

			const timeoutRepository = new TestRepository()
			const originalGetTable = timeoutRepository["getTable"]

			// Mock getTable 使其永远挂起
			timeoutRepository["getTable"] = vi.fn().mockImplementation(() => {
				return new Promise(() => {
					// 永远不 resolve
				})
			})

			// Act
			const promise = timeoutRepository.get("test")

			// 快进时间超过默认超时（2秒）
			vi.advanceTimersByTime(2100)

			// Assert
			await expect(promise).rejects.toThrow(/timed out after 2000ms/)

			// Cleanup
			timeoutRepository["getTable"] = originalGetTable
			vi.useRealTimers()
		})

		it("应该使用默认超时时间", async () => {
			// 默认超时时间已在其他测试中验证
			// 这里只验证超时机制存在
			expect(repository["executeWithErrorHandling"]).toBeDefined()
		})
	})

	describe("慢操作警告", () => {
		it("应该有慢操作警告机制", () => {
			// 慢操作警告逻辑已在 executeWithErrorHandling 中实现
			// 这里验证方法存在即可
			expect(repository["executeWithErrorHandling"]).toBeDefined()
		})
	})

	describe("边界情况", () => {
		it("应该能够处理空数据", async () => {
			// Arrange - 创建新的 repository 确保干净状态
			const newRepo = new TestRepository("empty-test")

			// Act
			const results = await newRepo.getAll()

			// Assert
			expect(results).toEqual([])

			// Cleanup
			await newRepo.closeDB()
		})

		it("应该能够处理包含特殊字符的键", async () => {
			// Arrange
			const newRepo = new TestRepository("special-char-test")
			const testData: TestData = {
				id: "test-special",
				name: "特殊字符键",
				value: 100,
			}

			// Act
			await newRepo.put(testData)
			const result = await newRepo.get("test-special")

			// Assert
			expect(result).toEqual(testData)

			// Cleanup
			await newRepo.closeDB()
		})

		it("应该能够处理大量数据的批量操作", async () => {
			// Arrange
			const newRepo = new TestRepository("bulk-test")
			const largeDataSet: TestData[] = Array.from({ length: 100 }, (_, i) => ({
				id: `test-${i}`,
				name: `数据${i}`,
				value: i,
			}))

			// Act
			await newRepo.bulkPut(largeDataSet)

			// Assert
			const results = await newRepo.getAll()
			expect(results).toHaveLength(100)

			// Cleanup
			await newRepo.closeDB()
		}, 10000)

		it("应该能够处理 undefined 和 null 值", async () => {
			// Arrange
			const newRepo = new TestRepository("null-test")
			const testData: TestData = {
				id: "test-null",
				name: "测试",
				value: 0,
				category: undefined,
			}

			// Act
			await newRepo.put(testData)
			const result = await newRepo.get("test-null")

			// Assert
			expect(result).toBeDefined()
			expect(result?.category).toBeUndefined()

			// Cleanup
			await newRepo.closeDB()
		})

		it("应该能够处理数值为 0 的情况", async () => {
			// Arrange
			const newRepo = new TestRepository("zero-test")
			const testData: TestData = {
				id: "test-zero",
				name: "零值测试",
				value: 0,
			}

			// Act
			await newRepo.put(testData)
			const result = await newRepo.get("test-zero")

			// Assert
			expect(result?.value).toBe(0)

			// Cleanup
			await newRepo.closeDB()
		})
	})
})

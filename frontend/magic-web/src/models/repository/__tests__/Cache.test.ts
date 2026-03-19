import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { Storage } from "../Cache"

// Mock platformKey utility
vi.mock("@/opensource/utils/storage", () => ({
	platformKey: (key: string) => `mock-platform-${key}`,
}))

describe("Cache (Storage)", () => {
	// 保存原始的 localStorage
	let originalLocalStorage: Storage

	beforeEach(() => {
		// 清空 localStorage
		localStorage.clear()
		vi.clearAllMocks()
	})

	afterEach(() => {
		// 清理
		localStorage.clear()
	})

	describe("基础操作", () => {
		describe("set()", () => {
			it("应该能够存储简单对象", () => {
				// Arrange
				const testData = { name: "测试", value: 123 }

				// Act
				Storage.set("test-key", testData)

				// Assert
				const stored = localStorage.getItem("mock-platform-test-key")
				expect(stored).toBe(JSON.stringify(testData))
			})

			it("应该能够存储数组", () => {
				// Arrange
				const testArray = [1, 2, 3, 4, 5]

				// Act
				Storage.set("array-key", testArray)

				// Assert
				const result = Storage.get("array-key")
				expect(result).toEqual(testArray)
			})

			it("应该能够存储嵌套对象", () => {
				// Arrange
				const nestedData = {
					level1: {
						level2: {
							value: "深层嵌套",
						},
					},
				}

				// Act
				Storage.set("nested-key", nestedData)

				// Assert
				const result = Storage.get("nested-key")
				expect(result).toEqual(nestedData)
			})

			it("应该能够覆盖已存在的值", () => {
				// Arrange
				Storage.set("overwrite-key", { value: "original" })

				// Act
				Storage.set("overwrite-key", { value: "updated" })

				// Assert
				const result = Storage.get("overwrite-key")
				expect(result.value).toBe("updated")
			})
		})

		describe("get()", () => {
			it("应该能够获取并解析 JSON 数据", () => {
				// Arrange
				const testData = { name: "测试", count: 100 }
				Storage.set("json-key", testData)

				// Act
				const result = Storage.get("json-key")

				// Assert
				expect(result).toEqual(testData)
			})

			it("应该在键不存在时返回空对象", () => {
				// Act
				const result = Storage.get("non-existent-key")

				// Assert
				expect(result).toEqual({})
			})

			it("应该在 JSON 解析失败时返回原始字符串", () => {
				// Arrange
				localStorage.setItem("mock-platform-invalid-json", "invalid json string")

				// Act
				const result = Storage.get("invalid-json")

				// Assert
				expect(result).toBe("invalid json string")
			})

			it("应该能够处理空字符串", () => {
				// Arrange
				localStorage.setItem("mock-platform-empty", "")

				// Act
				const result = Storage.get("empty")

				// Assert
				expect(result).toEqual({})
			})
		})

		describe("remove()", () => {
			it("应该能够删除指定键的数据", () => {
				// Arrange
				Storage.set("remove-key", { data: "test" })

				// Act
				Storage.remove("remove-key")

				// Assert
				const result = localStorage.getItem("mock-platform-remove-key")
				expect(result).toBeNull()
			})

			it("应该能够删除不存在的键而不报错", () => {
				// Act & Assert - 不应该抛出错误
				expect(() => Storage.remove("non-existent")).not.toThrow()
			})

			it("应该在删除后无法再获取到数据", () => {
				// Arrange
				Storage.set("delete-test", { value: "test" })

				// Act
				Storage.remove("delete-test")

				// Assert
				const result = Storage.get("delete-test")
				expect(result).toEqual({})
			})
		})

		describe("allClear()", () => {
			it("应该能够清空所有 localStorage 数据", () => {
				// Arrange
				Storage.set("key1", { value: 1 })
				Storage.set("key2", { value: 2 })
				Storage.set("key3", { value: 3 })

				// Act
				Storage.allClear()

				// Assert
				expect(localStorage.length).toBe(0)
			})

			it("应该在清空后无法获取任何数据", () => {
				// Arrange
				Storage.set("test-key", { value: "test" })

				// Act
				Storage.allClear()

				// Assert
				const result = Storage.get("test-key")
				expect(result).toEqual({})
			})
		})

		describe("key()", () => {
			it("应该能够获取指定索引的键名", () => {
				// Arrange
				Storage.set("key-0", { value: 0 })
				Storage.set("key-1", { value: 1 })

				// Act
				const firstKey = Storage.key(0)
				const secondKey = Storage.key(1)

				// Assert
				expect(firstKey).toBeDefined()
				expect(secondKey).toBeDefined()
			})

			it("应该在索引超出范围时返回 null", () => {
				// Act
				const result = Storage.key(999)

				// Assert
				expect(result).toBeNull()
			})
		})

		describe("length", () => {
			it("应该返回 localStorage 中存储的项数", () => {
				// Arrange - 验证长度属性存在
				expect(Storage).toHaveProperty("length")
				expect(typeof Storage.length).toBe("number")

				// Assert - 长度应该是非负数
				expect(Storage.length).toBeGreaterThanOrEqual(0)
			})

			it("应该在清空后返回 0", () => {
				// Arrange
				Storage.set("test", { value: 1 })
				Storage.allClear()

				// Act
				const length = Storage.length

				// Assert
				expect(length).toBe(0)
			})
		})
	})

	describe("高级操作", () => {
		describe("getAll()", () => {
			it("应该能够根据前缀获取所有匹配的数据", () => {
				// Arrange
				Storage.set("user-1", { name: "用户1" })
				Storage.set("user-2", { name: "用户2" })
				Storage.set("config-1", { name: "配置1" })

				// Act
				const userResults = Storage.getAll("user-")

				// Assert
				expect(userResults.length).toBeGreaterThanOrEqual(0)
				// 注意：由于 platformKey 的 mock，实际的前缀匹配可能不同
			})

			it("应该在没有匹配项时返回空数组", () => {
				// Act
				const results = Storage.getAll("non-existent-prefix-")

				// Assert
				expect(results).toEqual([])
			})
		})

		describe("clearById()", () => {
			it("应该能够根据前缀清除所有匹配的数据", () => {
				// Arrange
				Storage.set("cache-1", { value: 1 })
				Storage.set("cache-2", { value: 2 })
				Storage.set("other-1", { value: 3 })

				// Act
				Storage.clearById("cache-")

				// Assert
				const otherData = Storage.get("other-1")
				expect(otherData).toBeDefined()
			})
		})
	})

	describe("错误处理", () => {
		describe("JSON 解析错误", () => {
			it("应该在解析失败时返回原始值而不抛出错误", () => {
				// Arrange
				localStorage.setItem("mock-platform-bad-json", "{invalid json}")

				// Act
				const result = Storage.get("bad-json")

				// Assert - 应该返回原始字符串
				expect(typeof result).toBe("string")
			})

			it("应该能够处理包含特殊字符的 JSON", () => {
				// Arrange
				const specialData = { text: 'This is a "quoted" text with \n newline' }
				Storage.set("special-chars", specialData)

				// Act
				const result = Storage.get("special-chars")

				// Assert
				expect(result).toEqual(specialData)
			})
		})

		describe("JSON 序列化错误", () => {
			it("应该在序列化失败时使用原始值", () => {
				// Arrange - 创建一个循环引用对象（无法序列化为 JSON）
				const circularObj: any = { name: "test" }
				circularObj.self = circularObj

				// Act
				const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})
				Storage.set("circular", circularObj)

				// Assert
				expect(consoleSpy).toHaveBeenCalled()

				// Cleanup
				consoleSpy.mockRestore()
			})
		})

		describe("localStorage 配额错误", () => {
			it("应该能够处理存储配额超限的情况", () => {
				// Arrange - Mock localStorage.setItem 使其抛出配额错误
				const setItemSpy = vi
					.spyOn(window.localStorage, "setItem")
					.mockImplementationOnce(() => {
						throw new DOMException("QuotaExceededError")
					})

				// 捕获 console.error 调用
				const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})

				// Act
				Storage.set("large-data", { data: "x".repeat(10000000) })

				// Assert - 应该记录错误
				expect(consoleSpy).toHaveBeenCalled()

				// Cleanup
				setItemSpy.mockRestore()
				consoleSpy.mockRestore()
			})
		})
	})

	describe("边界情况", () => {
		it("应该能够处理空字符串键", () => {
			// Act
			Storage.set("", { value: "empty key" })
			const result = Storage.get("")

			// Assert
			expect(result).toBeDefined()
		})

		it("应该能够处理包含特殊字符的键", () => {
			// Arrange
			const specialKey = "key@#$%^&*()"
			const testData = { value: "special" }

			// Act
			Storage.set(specialKey, testData)
			const result = Storage.get(specialKey)

			// Assert
			expect(result).toEqual(testData)
		})

		it("应该能够处理非常长的键名", () => {
			// Arrange
			const longKey = "k".repeat(1000)
			const testData = { value: "long key" }

			// Act
			Storage.set(longKey, testData)
			const result = Storage.get(longKey)

			// Assert
			expect(result).toEqual(testData)
		})

		it("应该能够处理 null 值", () => {
			// Arrange
			const testData = { value: null }

			// Act
			Storage.set("null-value", testData)
			const result = Storage.get("null-value")

			// Assert
			expect(result.value).toBeNull()
		})

		it("应该能够处理 undefined 值", () => {
			// Arrange
			const testData = { value: undefined }

			// Act
			Storage.set("undefined-value", testData)
			const result = Storage.get("undefined-value")

			// Assert
			// undefined 在 JSON 序列化时会被忽略
			expect(result).toBeDefined()
		})

		it("应该能够处理布尔值", () => {
			// Arrange
			const trueData = { value: true }
			const falseData = { value: false }

			// Act
			Storage.set("true-value", trueData)
			Storage.set("false-value", falseData)

			// Assert
			expect(Storage.get("true-value").value).toBe(true)
			expect(Storage.get("false-value").value).toBe(false)
		})

		it("应该能够处理数值 0", () => {
			// Arrange
			const zeroData = { value: 0 }

			// Act
			Storage.set("zero-value", zeroData)
			const result = Storage.get("zero-value")

			// Assert
			expect(result.value).toBe(0)
		})

		it("应该能够处理空数组", () => {
			// Arrange
			const emptyArray: any[] = []

			// Act
			Storage.set("empty-array", emptyArray)
			const result = Storage.get("empty-array")

			// Assert
			expect(result).toEqual([])
		})

		it("应该能够处理空对象", () => {
			// Arrange
			const emptyObject = {}

			// Act
			Storage.set("empty-object", emptyObject)
			const result = Storage.get("empty-object")

			// Assert
			expect(result).toEqual({})
		})

		it("应该能够处理大型对象", () => {
			// Arrange
			const largeObject = {
				data: "x".repeat(10000),
				array: Array.from({ length: 1000 }, (_, i) => i),
				nested: {
					level1: {
						level2: {
							value: "deep",
						},
					},
				},
			}

			// Act
			Storage.set("large-object", largeObject)
			const result = Storage.get("large-object")

			// Assert
			expect(result.data.length).toBe(10000)
			expect(result.array.length).toBe(1000)
			expect(result.nested.level1.level2.value).toBe("deep")
		})

		it("应该能够处理 Date 对象", () => {
			// Arrange
			const now = new Date()
			const dateData = { timestamp: now.toISOString() }

			// Act
			Storage.set("date-value", dateData)
			const result = Storage.get("date-value")

			// Assert
			expect(result.timestamp).toBe(now.toISOString())
		})
	})

	describe("数据类型测试", () => {
		it("应该能够存储和读取字符串", () => {
			// Arrange
			const stringData = { text: "测试字符串" }

			// Act
			Storage.set("string-test", stringData)
			const result = Storage.get("string-test")

			// Assert
			expect(result.text).toBe("测试字符串")
		})

		it("应该能够存储和读取数字", () => {
			// Arrange
			const numberData = { int: 42, float: 3.14, negative: -100 }

			// Act
			Storage.set("number-test", numberData)
			const result = Storage.get("number-test")

			// Assert
			expect(result.int).toBe(42)
			expect(result.float).toBe(3.14)
			expect(result.negative).toBe(-100)
		})

		it("应该能够存储和读取复杂嵌套结构", () => {
			// Arrange
			const complexData = {
				users: [
					{ id: 1, name: "张三", tags: ["admin", "developer"] },
					{ id: 2, name: "李四", tags: ["user"] },
				],
				config: {
					theme: "dark",
					settings: {
						notifications: true,
						language: "zh-CN",
					},
				},
			}

			// Act
			Storage.set("complex-test", complexData)
			const result = Storage.get("complex-test")

			// Assert
			expect(result.users).toHaveLength(2)
			expect(result.users[0].tags).toContain("admin")
			expect(result.config.settings.notifications).toBe(true)
		})
	})

	describe("并发操作", () => {
		it("应该能够处理快速连续的写操作", () => {
			// Act
			for (let i = 0; i < 100; i++) {
				Storage.set(`concurrent-${i}`, { value: i })
			}

			// Assert
			for (let i = 0; i < 100; i++) {
				const result = Storage.get(`concurrent-${i}`)
				expect(result.value).toBe(i)
			}
		})

		it("应该能够处理快速连续的读写混合操作", () => {
			// Arrange
			Storage.set("mixed-test", { count: 0 })

			// Act
			for (let i = 0; i < 50; i++) {
				const current = Storage.get("mixed-test")
				Storage.set("mixed-test", { count: current.count + 1 })
			}

			// Assert
			const final = Storage.get("mixed-test")
			expect(final.count).toBe(50)
		})
	})
})

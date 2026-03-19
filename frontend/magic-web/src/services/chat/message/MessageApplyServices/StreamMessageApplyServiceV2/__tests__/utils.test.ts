import { describe, expect, it } from "vitest"
import { appendObject } from "../utils"

describe("StreamMessageApplyServiceV2 utils", () => {
	describe("appendObject", () => {
		// 基本场景 - 向普通对象追加值
		it("should append value to an existing property", () => {
			const obj = { a: { b: { c: "hello" } } }
			const result = appendObject(obj, ["a", "b", "c"], " world")
			expect(result).toEqual({ a: { b: { c: "hello world" } } })
		})

		// 空值场景 - 当对象中某个键不存在时
		it("should create missing properties in the path", () => {
			const obj = { a: {} }
			const result = appendObject(obj, ["a", "b", "c"], "value")
			expect(result).toEqual({ a: { b: { c: "value" } } })
		})

		it("should handle completely empty object", () => {
			const obj = {}
			const result = appendObject(obj, ["a", "b", "c"], "value")
			expect(result).toEqual({ a: { b: { c: "value" } } })
		})

		// 数组场景 - 处理数组索引
		it("should create array if next key is numeric", () => {
			const obj = {}
			const result = appendObject(obj, ["data", "0", "name"], "John")
			expect(result).toEqual({ data: [{ name: "John" }] })
		})

		it("should append to an array if property is an array", () => {
			const obj = { users: [] }
			const result = appendObject(obj, ["users"], "John")
			expect(result).toEqual({ users: ["John"] })
		})

		it("should push to array if property exists and is an array", () => {
			const obj = { users: ["Alice"] }
			const result = appendObject(obj, ["users"], "Bob")
			expect(result).toEqual({ users: ["Alice", "Bob"] })
		})

		// 边界情况
		it("should return original object if keyPath is empty", () => {
			const obj = { a: 1 }
			const result = appendObject(obj, [], "value")
			expect(result).toBe(obj)
		})

		it("should return original object if object is null or undefined", () => {
			expect(appendObject(null, ["a", "b"], "value")).toBeNull()
			expect(appendObject(undefined, ["a", "b"], "value")).toBeUndefined()
		})

		it("should return original object if keyPath is null or undefined", () => {
			const obj = { a: 1 }
			expect(appendObject(obj, null as any, "value")).toBe(obj)
			expect(appendObject(obj, undefined as any, "value")).toBe(obj)
		})

		// 非字符串类型直接赋值场景
		it("should directly assign non-string appendValue instead of concatenating", () => {
			// 数字类型
			const objNumber = { value: 10 }
			const resultNumber = appendObject(objNumber, ["value"], 20)
			expect(resultNumber).toEqual({ value: 20 })

			// 对象类型
			const objObject = { config: { version: "1.0" } }
			const newConfig = { version: "2.0", features: ["a", "b"] }
			const resultObject = appendObject(objObject, ["config"], newConfig)
			expect(resultObject).toEqual({ config: newConfig })

			// 布尔类型
			const objBoolean = { isActive: false }
			const resultBoolean = appendObject(objBoolean, ["isActive"], true)
			expect(resultBoolean).toEqual({ isActive: true })
		})

		// 复杂场景 - 多层嵌套和混合类型
		it("should handle complex nested objects with arrays", () => {
			const obj = {
				users: [{ name: "Alice", scores: [10] }],
			}

			// 第一个操作 - 向数组添加值
			const result1 = appendObject(obj, ["users", "0", "scores"], 20)
			expect(result1).toEqual({
				users: [{ name: "Alice", scores: [10, 20] }],
			})

			// 嵌套更深的路径 - 使用原始对象（不使用上次操作的结果）
			const originalObj = {
				users: [{ name: "Alice", scores: [10] }],
			}
			const result2 = appendObject(
				originalObj,
				["users", "0", "details", "address", "city"],
				"New York",
			)
			expect(result2).toEqual({
				users: [
					{
						name: "Alice",
						scores: [10],
						details: {
							address: {
								city: "New York",
							},
						},
					},
				],
			})
		})
	})
})

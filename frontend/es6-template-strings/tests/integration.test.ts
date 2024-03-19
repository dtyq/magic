/* eslint-disable no-template-curly-in-string */
import { resolveToString, resolveToArray } from "../src/index"

describe("es6-template-strings 集成测试", () => {
	test("resolveToString 基本功能", () => {
		const result = resolveToString("Hello, ${name}!", { name: "World" })
		expect(result).toBe("Hello, World!")
	})

	test("resolveToString 处理复杂表达式", () => {
		const result = resolveToString("Total: ${price * quantity}", { price: 10, quantity: 3 })
		expect(result).toBe("Total: 30")
	})

	test("resolveToString 处理对象属性", () => {
		const result = resolveToString("User: ${user.name}, Age: ${user.age}", {
			user: { name: "Alice", age: 25 },
		})
		expect(result).toBe("User: Alice, Age: 25")
	})

	test("resolveToString 处理不存在的变量 (非 partial 模式)", () => {
		const result = resolveToString("Name: ${name}, Age: ${age}", { name: "John" })
		expect(result).toBe("Name: John, Age: undefined")
	})

	test("resolveToString 处理不存在的变量 (partial 模式)", () => {
		const result = resolveToString(
			"Name: ${name}, Age: ${age}",
			{ name: "John" },
			{ partial: true },
		)
		expect(result).toBe("Name: John, Age: ${age}")
	})

	test("resolveToString 使用自定义标记", () => {
		const result = resolveToString(
			"Hello, @{name}!",
			{ name: "World" },
			{
				notation: "@",
				notationStart: "{",
				notationEnd: "}",
			},
		)
		expect(result).toBe("Hello, World!")
	})

	test("resolveToArray 基本功能", () => {
		const result = resolveToArray("Hello, ${name}!", { name: "World" })
		expect(result).toEqual(["Hello, ", "World", "!"])
	})

	test("resolveToArray 处理复杂表达式", () => {
		const result = resolveToArray("Total: ${price * quantity}", { price: 10, quantity: 3 })
		expect(result).toEqual(["Total: ", 30, ""])
	})

	test("resolveToArray 处理对象属性", () => {
		const result = resolveToArray("User: ${user.name}, Age: ${user.age}", {
			user: { name: "Alice", age: 25 },
		})
		expect(result).toEqual(["User: ", "Alice", ", Age: ", 25, ""])
	})

	test("resolveToArray 处理不存在的变量 (非 partial 模式)", () => {
		const result = resolveToArray("Name: ${name}, Age: ${age}", { name: "John" })
		expect(result).toEqual(["Name: ", "John", ", Age: ", "undefined", ""])
	})

	test("resolveToArray 处理不存在的变量 (partial 模式)", () => {
		const result = resolveToArray(
			"Name: ${name}, Age: ${age}",
			{ name: "John" },
			{ partial: true },
		)
		expect(result).toEqual(["Name: ", "John", ", Age: ", "${age}", ""])
	})

	test("resolveToArray 使用自定义标记", () => {
		const result = resolveToArray(
			"Hello, @{name}!",
			{ name: "World" },
			{
				notation: "@",
				notationStart: "{",
				notationEnd: "}",
			},
		)
		expect(result).toEqual(["Hello, ", "World", "!"])
	})
})

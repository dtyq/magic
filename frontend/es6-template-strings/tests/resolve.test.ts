/* eslint-disable no-template-curly-in-string */
import resolve from "../src/resolve"
import compile from "../src/compile"

describe("resolve 函数测试", () => {
	test("基本解析功能", () => {
		const compiled = compile("Hello, ${name}!")
		const result = resolve(compiled, { name: "World" })
		expect(result).toEqual([["Hello, ", "!"], "World"])
	})

	test("处理多个变量", () => {
		const compiled = compile("${greeting}, ${name}! Your age is ${age}.")
		const result = resolve(compiled, { greeting: "Hello", name: "John", age: 30 })
		expect(result).toEqual([["", ", ", "! Your age is ", "."], "Hello", "John", 30])
	})

	test("处理复杂表达式", () => {
		const compiled = compile("Result: ${a + b * (c - d)}")
		const result = resolve(compiled, { a: 5, b: 3, c: 8, d: 2 })
		expect(result).toEqual([["Result: ", ""], 23]) // 5 + 3 * (8 - 2) = 5 + 3 * 6 = 5 + 18 = 23
	})

	test("处理对象属性", () => {
		const compiled = compile("User: ${user.name}, Age: ${user.age}")
		const result = resolve(compiled, { user: { name: "Alice", age: 25 } })
		expect(result).toEqual([["User: ", ", Age: ", ""], "Alice", 25])
	})

	test("处理数组索引", () => {
		const compiled = compile("First: ${items[0]}, Second: ${items[1]}")
		const result = resolve(compiled, { items: ["apple", "banana"] })
		expect(result).toEqual([["First: ", ", Second: ", ""], "apple", "banana"])
	})

	test("处理函数调用", () => {
		const compiled = compile("Uppercase: ${name.toUpperCase()}")
		const result = resolve(compiled, { name: "john" })
		expect(result).toEqual([["Uppercase: ", ""], "JOHN"])
	})

	test("处理不存在的变量 (非 partial 模式)", () => {
		const compiled = compile("Name: ${name}, Age: ${age}")
		const result = resolve(compiled, { name: "John" })
		expect(result).toEqual([["Name: ", ", Age: ", ""], "John", "undefined"])
	})

	test("处理不存在的变量 (partial 模式)", () => {
		const compiled = compile("Name: ${name}, Age: ${age}")
		const result = resolve(compiled, { name: "John" }, { partial: true })
		expect(result).toEqual([["Name: ", ", Age: ", ""], "John", "${age}"])
	})

	test("处理空上下文", () => {
		const compiled = compile("Hello, ${name}!")
		const result = resolve(compiled, {})
		expect(result).toEqual([["Hello, ", "!"], "undefined"])
	})

	test("异常处理", () => {
		const compiled = compile("Result: ${(() => { throw new Error('Test error') })()}")
		const result = resolve(compiled, {})
		expect(result).toEqual([["Result: ", ""], "undefined"])
	})

	test("异常处理 (partial 模式)", () => {
		const compiled = compile("Result: ${(() => { throw new Error('Test error') })()}")
		const result = resolve(compiled, {}, { partial: true })
		expect(result).toEqual([["Result: ", ""], "${(() => { throw new Error('Test error') })()}"])
	})
})

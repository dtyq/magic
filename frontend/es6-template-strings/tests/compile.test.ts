/* eslint-disable no-template-curly-in-string */
import compile from "../src/compile"

describe("compile 函数测试", () => {
	test("基本模板编译", () => {
		const result = compile("Hello, ${name}!")
		expect(result).toHaveProperty("literals")
		expect(result).toHaveProperty("substitutions")
		expect(result.literals).toEqual(["Hello, ", "!"])
		expect(result.substitutions).toEqual(["name"])
	})

	test("无替换变量的模板", () => {
		const result = compile("Hello, world!")
		expect(result.literals).toEqual(["Hello, world!"])
		expect(result.substitutions).toEqual([])
	})

	test("多个替换变量的模板", () => {
		const result = compile("${greeting}, ${name}! Your age is ${age}.")
		expect(result.literals).toEqual(["", ", ", "! Your age is ", "."])
		expect(result.substitutions).toEqual(["greeting", "name", "age"])
	})

	test("转义字符处理", () => {
		const result = compile("Hello, \\${name}!")
		expect(result.literals).toEqual(["Hello, ${name}!"])
		expect(result.substitutions).toEqual([])
	})

	test("嵌套替换变量处理", () => {
		const result = compile("Result: ${a + b * (c - d)}")
		expect(result.literals).toEqual(["Result: ", ""])
		expect(result.substitutions).toEqual(["a + b * (c - d)"])
	})

	test("双 $ 符号处理", () => {
		const result = compile("Cost: $$${price}")
		expect(result.literals).toEqual(["Cost: $$", ""])
		expect(result.substitutions).toEqual(["price"])
	})

	test("自定义标记选项", () => {
		const result = compile("Hello, @{name}!", {
			notation: "@",
			notationStart: "{",
			notationEnd: "}",
		})
		expect(result.literals).toEqual(["Hello, ", "!"])
		expect(result.substitutions).toEqual(["name"])
	})

	test("未关闭的占位符处理", () => {
		const result = compile("Hello, ${name")
		expect(result.literals).toEqual(["Hello, ${name"])
		expect(result.substitutions).toEqual([])
	})

	test("包含空白字符的表达式", () => {
		const result = compile("${  a + b  }")
		expect(result.literals).toEqual(["", ""])
		expect(result.substitutions).toEqual(["  a + b  "])
	})
})

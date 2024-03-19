import passthru from "../src/passthru"
import passthruArray from "../src/passthru-array"

describe("passthru 函数测试", () => {
	test("基本字符串模板处理", () => {
		const result = passthru(["Hello, ", "!"], "World")
		expect(result).toBe("Hello, World!")
	})

	test("处理多个替换值", () => {
		const result = passthru(["", " loves ", "."], "Alice", "programming")
		expect(result).toBe("Alice loves programming.")
	})

	test("处理空替换值", () => {
		const result = passthru(["Hello, ", "!", " Welcome."], "", "")
		expect(result).toBe("Hello, ! Welcome.")
	})

	test("处理 undefined 替换值", () => {
		const result = passthru(["Hello, ", "!"], "" as any)
		expect(result).toBe("Hello, !")
	})

	test("处理 null 替换值", () => {
		const result = passthru(["Hello, ", "!"], null as any)
		expect(result).toBe("Hello, null!")
	})

	test("处理复杂替换值", () => {
		const fn = () => "World"
		const result = passthru(["Hello, ", "!"], fn as any)
		expect(result).toMatch(/Hello, function.*World.*!/)
	})
})

describe("passthru-array 函数测试", () => {
	test("基本数组处理", () => {
		const result = passthruArray(["Hello, ", "!"], "World")
		expect(result).toEqual(["Hello, ", "World", "!"])
	})

	test("处理多个替换值", () => {
		const result = passthruArray(["", " loves ", "."], "Alice", "programming")
		expect(result).toEqual(["", "Alice", " loves ", "programming", "."])
	})

	test("处理空替换值", () => {
		const result = passthruArray(["Hello, ", "!", " Welcome."], "", "")
		expect(result).toEqual(["Hello, ", "", "!", "", " Welcome."])
	})

	test("处理 undefined 替换值", () => {
		const result = passthruArray(["Hello, ", "!"], "" as any)
		expect(result).toEqual(["Hello, ", "", "!"])
	})

	test("处理空字面量数组", () => {
		const result = passthruArray([], "World")
		expect(result).toEqual([])
	})

	test("处理边界情况", () => {
		const result = passthruArray(["Only literal"])
		expect(result).toEqual(["Only literal"])
	})
})

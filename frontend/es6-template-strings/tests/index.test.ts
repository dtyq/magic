import { resolveToString, resolveToArray } from "../src"

describe("es6-template-strings 导出模块测试", () => {
	test("resolveToString 应该是一个函数", () => {
		expect(typeof resolveToString).toBe("function")
	})

	test("resolveToArray 应该是一个函数", () => {
		expect(typeof resolveToArray).toBe("function")
	})

	test("默认导出应该是 resolveToString", () => {
		expect(resolveToString).toBe(resolveToString)
	})
})

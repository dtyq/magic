import { describe, test, expect } from "vitest"
import { BaseException } from "../../src/Exception/BaseException"

describe("BaseException", () => {
	test("应该创建基础异常实例", () => {
		const exception = new BaseException("Test error message")
		
		expect(exception).toBeInstanceOf(Error)
		expect(exception).toBeInstanceOf(BaseException)
	})

	test("异常消息应该包含 [Uploader] 前缀", () => {
		const message = "Test error message"
		const exception = new BaseException(message)
		
		expect(exception.message).toBe(`[Uploader] ${message}`)
	})

	test("异常消息应该正确处理空字符串", () => {
		const exception = new BaseException("")
		
		expect(exception.message).toBe("[Uploader] ")
	})

	test("异常应该有正确的名称", () => {
		const exception = new BaseException("Test error")
		
		expect(exception.name).toBe("Error")
	})

	test("异常应该可以被 catch 捕获", () => {
		expect(() => {
			throw new BaseException("Test error")
		}).toThrow(BaseException)
	})

	test("异常应该保留错误堆栈", () => {
		const exception = new BaseException("Test error")
		
		expect(exception.stack).toBeDefined()
		expect(exception.stack).toContain("BaseException")
	})
})


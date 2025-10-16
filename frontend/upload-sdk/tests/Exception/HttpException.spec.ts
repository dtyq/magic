import { describe, test, expect } from "vitest"
import { HttpException, HttpExceptionCode } from "../../src/Exception/HttpException"
import { BaseException } from "../../src/Exception/BaseException"

describe("HttpException", () => {
	test("应该继承自 BaseException", () => {
		const exception = new HttpException(
			HttpExceptionCode.REQUEST_FAILED_WITH_STATUS_CODE,
			404
		)
		
		expect(exception).toBeInstanceOf(BaseException)
		expect(exception).toBeInstanceOf(HttpException)
	})

	test("REQUEST_FAILED_WITH_STATUS_CODE 应该包含 HTTP 状态码", () => {
		const httpStatus = 500
		const exception = new HttpException(
			HttpExceptionCode.REQUEST_FAILED_WITH_STATUS_CODE,
			httpStatus
		)
		
		expect(exception.message).toContain("[Uploader]")
		expect(exception.message).toContain(httpStatus.toString())
		expect(exception.status).toBe(httpStatus)
	})

	test("REQUEST_IS_CANCEL 应该生成正确的错误消息", () => {
		const exception = new HttpException(HttpExceptionCode.REQUEST_IS_CANCEL)
		
		expect(exception.message).toContain("[Uploader]")
		expect(exception.message).toContain("canceled")
		expect(exception.status).toBe(5001)
	})

	test("REQUEST_IS_PAUSE 应该生成正确的错误消息", () => {
		const exception = new HttpException(HttpExceptionCode.REQUEST_IS_PAUSE)
		
		expect(exception.message).toContain("[Uploader]")
		expect(exception.message).toContain("paused")
		expect(exception.status).toBe(5002)
	})

	test("应该正确处理不同的 HTTP 状态码", () => {
		const statuses = [400, 401, 403, 404, 500, 502, 503]
		
		statuses.forEach(httpStatus => {
			const exception = new HttpException(
				HttpExceptionCode.REQUEST_FAILED_WITH_STATUS_CODE,
				httpStatus
			)
			
			expect(exception.message).toContain(httpStatus.toString())
			expect(exception.status).toBe(httpStatus)
		})
	})

	test("异常代码应该是数字", () => {
		const exception = new HttpException(
			HttpExceptionCode.REQUEST_FAILED_WITH_STATUS_CODE,
			404
		)
		
		expect(typeof exception.status).toBe("number")
	})

	test("不同的异常应该有不同的 status 值", () => {
		const cancelException = new HttpException(HttpExceptionCode.REQUEST_IS_CANCEL)
		const pauseException = new HttpException(HttpExceptionCode.REQUEST_IS_PAUSE)
		
		expect(cancelException.status).not.toBe(pauseException.status)
	})

	test("应该可以通过 catch 捕获", () => {
		expect(() => {
			throw new HttpException(HttpExceptionCode.REQUEST_FAILED_WITH_STATUS_CODE, 404)
		}).toThrow(HttpException)
	})
})


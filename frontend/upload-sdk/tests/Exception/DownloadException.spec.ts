import { describe, test, expect } from "vitest"
import { DownloadException, DownloadExceptionCode } from "../../src/Exception/DownloadException"
import { BaseException } from "../../src/Exception/BaseException"

describe("DownloadException", () => {
	test("应该继承自 BaseException", () => {
		const exception = new DownloadException(
			DownloadExceptionCode.DOWNLOAD_REQUEST_ERROR,
			404
		)
		
		expect(exception).toBeInstanceOf(BaseException)
		expect(exception).toBeInstanceOf(DownloadException)
	})

	test("DOWNLOAD_REQUEST_ERROR 应该包含 HTTP 状态码", () => {
		const httpStatus = 404
		const exception = new DownloadException(
			DownloadExceptionCode.DOWNLOAD_REQUEST_ERROR,
			httpStatus
		)
		
		expect(exception.message).toContain("[Uploader]")
		expect(exception.message).toContain(httpStatus.toString())
		expect(exception.status).toBe(3002)
	})

	test("应该正确处理不同的 HTTP 状态码", () => {
		const statuses = [400, 401, 403, 404, 500, 502, 503]
		
		statuses.forEach(httpStatus => {
			const exception = new DownloadException(
				DownloadExceptionCode.DOWNLOAD_REQUEST_ERROR,
				httpStatus
			)
			
			expect(exception.message).toContain(httpStatus.toString())
		})
	})

	test("异常代码应该是数字", () => {
		const exception = new DownloadException(
			DownloadExceptionCode.DOWNLOAD_REQUEST_ERROR,
			404
		)
		
		expect(typeof exception.status).toBe("number")
	})

	test("应该可以通过 catch 捕获", () => {
		expect(() => {
			throw new DownloadException(DownloadExceptionCode.DOWNLOAD_REQUEST_ERROR, 404)
		}).toThrow(DownloadException)
	})
})


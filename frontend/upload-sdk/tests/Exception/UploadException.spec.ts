import { describe, test, expect } from "vitest"
import { UploadException, UploadExceptionCode } from "../../src/Exception/UploadException"
import { BaseException } from "../../src/Exception/BaseException"

describe("UploadException", () => {
	test("应该继承自 BaseException", () => {
		const exception = new UploadException(UploadExceptionCode.UPLOAD_CANCEL)
		
		expect(exception).toBeInstanceOf(BaseException)
		expect(exception).toBeInstanceOf(UploadException)
	})

	test("UPLOAD_CANCEL 应该生成正确的错误消息", () => {
		const exception = new UploadException(UploadExceptionCode.UPLOAD_CANCEL)
		
		expect(exception.message).toContain("[Uploader]")
		expect(exception.message).toContain("isCancel")
		expect(exception.status).toBe(1001)
	})

	test("UPLOAD_PAUSE 应该生成正确的错误消息", () => {
		const exception = new UploadException(UploadExceptionCode.UPLOAD_PAUSE)
		
		expect(exception.message).toContain("[Uploader]")
		expect(exception.message).toContain("isPause")
		expect(exception.status).toBe(1002)
	})

	test("UPLOAD_UNKNOWN_ERROR 应该生成正确的错误消息", () => {
		const exception = new UploadException(UploadExceptionCode.UPLOAD_UNKNOWN_ERROR)
		
		expect(exception.message).toContain("[Uploader]")
		expect(exception.status).toBe(1000)
	})

	test("异常代码应该是数字", () => {
		const exception = new UploadException(UploadExceptionCode.UPLOAD_CANCEL)
		
		expect(typeof exception.status).toBe("number")
	})

	test("不同的异常应该有不同的 status 值", () => {
		const cancelException = new UploadException(UploadExceptionCode.UPLOAD_CANCEL)
		const pauseException = new UploadException(UploadExceptionCode.UPLOAD_PAUSE)
		
		expect(cancelException.status).not.toBe(pauseException.status)
	})

	test("应该可以通过 catch 捕获", () => {
		expect(() => {
			throw new UploadException(UploadExceptionCode.UPLOAD_CANCEL)
		}).toThrow(UploadException)
	})
})


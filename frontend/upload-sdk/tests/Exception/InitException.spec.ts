import { describe, test, expect } from "vitest"
import { InitException, InitExceptionCode } from "../../src/Exception/InitException"
import { BaseException } from "../../src/Exception/BaseException"

describe("InitException", () => {
	test("应该继承自 BaseException", () => {
		const exception = new InitException(InitExceptionCode.MISSING_PARAMS_FOR_UPLOAD, "param1")
		
		expect(exception).toBeInstanceOf(BaseException)
		expect(exception).toBeInstanceOf(InitException)
	})

	test("MISSING_PARAMS_FOR_UPLOAD 应该生成正确的错误消息", () => {
		const exception = new InitException(
			InitExceptionCode.MISSING_PARAMS_FOR_UPLOAD,
			"url",
			"method"
		)
		
		expect(exception.message).toContain("[Uploader]")
		expect(exception.message).toContain("url")
		expect(exception.message).toContain("method")
		expect(exception.message).toContain("must be provided")
	})

	test("UPLOAD_IS_NO_SUPPORT_THIS_PLATFORM 应该生成正确的错误消息", () => {
		const platform = "unknown-platform"
		const exception = new InitException(
			InitExceptionCode.UPLOAD_IS_NO_SUPPORT_THIS_PLATFORM,
			platform
		)
		
		expect(exception.message).toContain(platform)
		expect(exception.message).toContain("not supported")
	})

	test("UPLOAD_IS_NO_SUPPORT_THIS_FILE_FORMAT 应该生成正确的错误消息", () => {
		const exception = new InitException(
			InitExceptionCode.UPLOAD_IS_NO_SUPPORT_THIS_FILE_FORMAT
		)
		
		expect(exception.message).toContain("[Uploader]")
		expect(exception.message).toContain("Blob/File")
	})

	test("UPLOAD_FILENAME_EXIST_SPECIAL_CHAR 应该包含文件名", () => {
		const filename = "file%name.txt"
		const exception = new InitException(
			InitExceptionCode.UPLOAD_FILENAME_EXIST_SPECIAL_CHAR,
			filename
		)
		
		expect(exception.message).toContain(filename)
		expect(exception.message).toContain("special characters")
	})

	test("REUPLOAD_IS_FAILED 应该生成正确的错误消息", () => {
		const exception = new InitException(InitExceptionCode.REUPLOAD_IS_FAILED)
		
		expect(exception.message).toContain("[Uploader]")
		expect(exception.message).toContain("expired")
	})

	test("异常应该有正确的名称", () => {
		const exception = new InitException(InitExceptionCode.MISSING_PARAMS_FOR_UPLOAD, "test")
		
		expect(exception.name).toBe("InitException")
	})

	test("应该可以通过 catch 捕获", () => {
		expect(() => {
			throw new InitException(InitExceptionCode.MISSING_PARAMS_FOR_UPLOAD, "url")
		}).toThrow(InitException)
	})
})


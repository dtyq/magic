import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { Upload } from "../src"
import { InitException, InitExceptionCode } from "../src/Exception/InitException"
import type { UploadConfig } from "../src/types"

describe("upload", () => {
	let uploadManager: Upload
	let uploadConfig: UploadConfig

	beforeEach(() => {
		uploadManager = new Upload()
		uploadConfig = {
			url: "http://example.com/upload",
			method: "POST",
			file: new File(["test"], "example.txt"),
			fileName: "example.txt",
			option: {
				rewriteFileName: true,
			},
		}
	})

	afterEach(() => {
		vi.resetAllMocks()
	})

	it("如果缺少url参数，应该抛出异常", () => {
		uploadConfig.url = ""
		expect(() => {
			uploadManager.upload(uploadConfig)
		}).toThrow(
			new InitException(InitExceptionCode.MISSING_PARAMS_FOR_UPLOAD, "url", "method"),
		)
	})

	it("如果缺少method参数，应该抛出异常", () => {
		// @ts-ignore
		uploadConfig.method = ""
		expect(() => {
			uploadManager.upload(uploadConfig)
		}).toThrow(
			new InitException(InitExceptionCode.MISSING_PARAMS_FOR_UPLOAD, "url", "method"),
		)
	})

	it("如果生成的文件名包含特殊字符，应该抛出异常", () => {
		uploadConfig.fileName = "工作表 在 司南制作过程遇到的小问题%.txt"
		uploadConfig.option!.rewriteFileName = false
		expect(() => {
			uploadManager.upload(uploadConfig)
		}).toThrow(
			new InitException(
				InitExceptionCode.UPLOAD_FILENAME_EXIST_SPECIAL_CHAR,
				uploadConfig.fileName,
			),
		)
	})

	it("如果启用rewriteFileName选项，应该生成一个新的文件名", () => {
		const fileName = "正常的文件名.txt"
		uploadConfig.fileName = fileName
		uploadConfig.option!.rewriteFileName = true
		uploadManager.upload(uploadConfig)
		expect(uploadConfig.fileName).not.toBe(fileName)
	})

	it("应该使用正确的参数调用createTask方法", () => {
		const createTaskMock = vi.spyOn(uploadManager.uploadManger, "createTask")
		uploadManager.upload(uploadConfig)
		expect(createTaskMock).toHaveBeenCalledWith(
			uploadConfig.file,
			expect.any(String), // handledFileName
			uploadConfig,
			uploadConfig.option || {},
		)
	})
})

import { describe, it, expect, vi, beforeEach } from "vitest"
import { Upload, PlatformType } from "../src"
import { InitException, InitExceptionCode } from "../src/Exception/InitException"
import { UploadManger } from "../src/utils/UploadManger"
import type { Method } from "../src/types/request"

// Mock UploadManger
vi.mock("../src/utils/UploadManger", () => {
	const mockCreateTask = vi.fn().mockReturnValue({
		success: vi.fn(),
		fail: vi.fn(),
		progress: vi.fn(),
		cancel: vi.fn(),
		pause: vi.fn(),
		resume: vi.fn(),
	})

	const MockUploadManger = vi.fn().mockImplementation(() => {
		return {
			createTask: mockCreateTask,
			pauseAllTask: vi.fn(),
			resumeAllTask: vi.fn(),
			cancelAllTask: vi.fn(),
			// Add tasks array for testing
			tasks: [],
		}
	})

	return {
		UploadManger: MockUploadManger,
	}
})

// Mock request module
vi.mock("../src/utils/request", () => {
	return {
		request: vi.fn().mockImplementation(({ success }) => {
			if (success && typeof success === "function") {
				success({ data: "success" })
			}
			return Promise.resolve({ data: "success" })
		}),
		cancelRequest: vi.fn(),
		pauseRequest: vi.fn(),
		completeRequest: vi.fn(),
	}
})

describe("Upload 类测试", () => {
	let uploadInstance: Upload
	let mockFile: File

	beforeEach(() => {
		uploadInstance = new Upload()
		mockFile = new File(["test content"], "test.txt", { type: "text/plain" })
		vi.clearAllMocks()
	})

	describe("构造函数", () => {
		it("应该正确实例化", () => {
			expect(uploadInstance).toBeInstanceOf(Upload)
			expect(uploadInstance.uploadManger).toBeDefined()
		})

		it("应该有正确的版本号", () => {
			expect(typeof Upload.version).toBe("string")
			expect(Upload.version.length).toBeGreaterThan(0)
		})
	})

	describe("upload 方法", () => {
		it("如果缺少必要参数应该抛出异常", () => {
			const config = {
				url: "",
				method: "POST" as Method,
				file: mockFile,
				fileName: "test.txt",
			}

			expect(() => {
				uploadInstance.upload(config)
			}).toThrow(InitException)

			expect(() => {
				uploadInstance.upload({
					...config,
					url: "http://example.com",
					method: "" as Method,
				})
			}).toThrow(InitException)
		})

		it("当文件名中包含特殊字符时应该抛出异常", () => {
			const config = {
				url: "http://example.com",
				method: "POST" as Method,
				file: mockFile,
				fileName: "test%.txt",
				option: {
					rewriteFileName: false,
				},
			}

			expect(() => {
				uploadInstance.upload(config)
			}).toThrow(
				new InitException(
					InitExceptionCode.UPLOAD_FILENAME_EXIST_SPECIAL_CHAR,
					config.fileName,
				),
			)
		})

		it("当启用重写文件名选项时应该生成新文件名", () => {
			const config = {
				url: "http://example.com",
				method: "POST" as Method,
				file: mockFile,
				fileName: "test.txt",
				option: {
					rewriteFileName: true,
				},
			}

			const oldFileName = config.fileName
			uploadInstance.upload(config)
			expect(config.fileName).not.toBe(oldFileName)
			expect(config.fileName).toMatch(/^.+\.txt$/)
		})

		it("应该调用 uploadManger.createTask 方法", () => {
			const config = {
				url: "http://example.com",
				method: "POST" as Method,
				file: mockFile,
				fileName: "test.txt",
				option: {
					rewriteFileName: false,
				},
			}

			const result = uploadInstance.upload(config)
			// Verify task object is returned
			expect(result).toBeDefined()
			expect(result).toHaveProperty("success")
			expect(result).toHaveProperty("fail")
			expect(result).toHaveProperty("progress")
		})
	})

	describe("下载方法", () => {
		it("download 方法应该调用 request 方法并返回 Promise", async () => {
			const downloadConfig = {
				url: "http://example.com/download",
				method: "GET" as Method,
				headers: { "Content-Type": "application/json" },
			}

			const result = await Upload.download(downloadConfig)
			expect(result).toBeDefined()
			expect(result).toEqual({ data: "success" })
		})

		it("download 方法应处理不同类型的body参数 - FormData", async () => {
			const formData = new FormData()
			formData.append("key", "value")

			const downloadConfig = {
				url: "http://example.com/download",
				method: "POST" as Method,
				headers: { "Content-Type": "multipart/form-data" },
				body: formData,
				option: {
					image: [
						{
							type: "resize" as const,
							params: { width: 100, height: 100 },
						},
					],
				},
			}

			await Upload.download(downloadConfig)
			// Verify FormData contains options field
			expect(formData.has("options")).toBe(true)
			const optionsValue = formData.get("options")
			expect(optionsValue).toBe(JSON.stringify(downloadConfig.option))
		})

		it("download 方法应处理不同类型的body参数 - JSON字符串", async () => {
			const jsonBody = JSON.stringify({ test: "value" })
			const option = {
				image: [
					{
						type: "resize" as const,
						params: { width: 100, height: 100 },
					},
				],
			}

			const downloadConfig = {
				url: "http://example.com/download",
				method: "GET" as Method,
				headers: { "Content-Type": "application/json" },
				body: jsonBody,
				option,
			}

			// Request module is mocked, just verify it doesn't throw
			const result = await Upload.download(downloadConfig)
			expect(result).toBeDefined()
		})

		it("download 方法应处理不同类型的body参数 - 对象", async () => {
			const objectBody = { test: "value" }
			const option = {
				image: [
					{
						type: "resize" as const,
						params: { width: 100, height: 100 },
					},
				],
			}

			const downloadConfig = {
				url: "http://example.com/download",
				method: "GET" as Method,
				headers: { "Content-Type": "application/json" },
				body: objectBody,
				option,
			}

			// Request module is mocked, just verify it doesn't throw
			const result = await Upload.download(downloadConfig)
			expect(result).toBeDefined()
		})

		it("download 方法应处理body处理过程中的异常", async () => {
			// Create a malformed JSON string that will cause JSON.parse to fail
			const malformedJson = "{ invalid json }"

			const downloadConfig = {
				url: "http://example.com/download",
				method: "GET" as Method,
				headers: { "Content-Type": "application/json" },
				body: malformedJson,
				option: {
					image: [
						{
							type: "resize" as const,
							params: { width: 100, height: 100 },
						},
					],
				},
			}

			// Should not throw exception, request module is mocked
			const result = await Upload.download(downloadConfig)
			expect(result).toBeDefined()
		})
	})

	describe("任务控制方法", () => {
		it("pause 方法应该存在并可调用", () => {
			expect(() => uploadInstance.pause()).not.toThrow()
		})

		it("resume 方法应该存在并可调用", () => {
			expect(() => uploadInstance.resume()).not.toThrow()
		})

		it("cancel 方法应该存在并可调用", () => {
			expect(() => uploadInstance.cancel()).not.toThrow()
		})
	})

	describe("静态方法", () => {
		it("subscribeLogs 方法应该注册回调函数", async () => {
			// Get logPubSub module
			const logPubSub = (await import("../src/utils/logPubSub")).default

			// Mock subscribe function
			const subscribeSpy = vi.spyOn(logPubSub, "subscribe").mockImplementation(vi.fn())

			// Call subscribeLogs method
			const callback = vi.fn()
			Upload.subscribeLogs(callback)

			// Verify subscribe method was called with correct callback
			expect(subscribeSpy).toHaveBeenCalledWith(callback)

			// Restore original method
			subscribeSpy.mockRestore()
		})
	})

	describe("PlatformType", () => {
		it("导出的 PlatformType 应该包含预期的平台类型", () => {
			// Use correct enum member properties
			expect(PlatformType.OSS).toBe("aliyun")
			expect(PlatformType.TOS).toBe("tos")
			expect(PlatformType.Kodo).toBe("qiniu")
			expect(PlatformType.OBS).toBe("obs")
		})
	})
})

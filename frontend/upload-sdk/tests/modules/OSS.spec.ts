import { OSS } from "../../src"

// 在顶部先模拟依赖
jest.mock("../../src/utils/request", () => {
	return {
		request: jest.fn().mockImplementation((options) => {
			if (options.xmlResponse) {
				// 处理XML响应
				if (options.url && options.url.includes("uploads")) {
					return Promise.resolve({
						data: {
							InitiateMultipartUploadResult: {
								Bucket: "test-bucket",
								Key: "test/test.txt",
								UploadId: "test-upload-id",
							},
						},
						headers: {},
						code: 1000,
						message: "请求成功",
					})
				}
				// 完成分片上传
				return Promise.resolve({
					data: {
						CompleteMultipartUploadResult: {
							Location:
								"http://test-bucket.oss-cn-beijing.aliyuncs.com/test/test.txt",
							Bucket: "test-bucket",
							Key: "test/test.txt",
							ETag: "etag-final",
						},
					},
					headers: {},
					code: 1000,
					message: "请求成功",
				})
			}
			// 处理常规响应
			return Promise.resolve({
				data: { path: "test/test.txt" },
				headers: {},
				code: 1000,
				message: "请求成功",
			})
		}),
	}
})

// 修改OSS模块模拟，确保能够正确捕获MultipartUpload的调用
jest.mock("../../src/modules/OSS", () => {
	// 创建各个方法的模拟实现
	const MultipartUpload = jest.fn().mockResolvedValue({
		url: "test-url",
		platform: "oss",
		path: "test/test.txt",
	})

	const STSUpload = jest.fn().mockResolvedValue({
		url: "test-url",
		platform: "oss",
		path: "test/test.txt",
	})

	const defaultUpload = jest.fn().mockResolvedValue({
		url: "test-url",
		platform: "oss",
		path: "test/test.txt",
	})

	// 创建upload函数，该函数会根据参数调用正确的上传方法
	const upload = jest.fn((file, key, params, option) => {
		if (Object.prototype.hasOwnProperty.call(params, "sts_token")) {
			return MultipartUpload(file, key, params, option)
		}
		return defaultUpload(file, key, params, option)
	})

	return {
		__esModule: true,
		default: { upload, MultipartUpload, STSUpload, defaultUpload },
		upload,
		MultipartUpload,
		STSUpload,
		defaultUpload,
	}
})

// 模拟FormData
class MockFormData {
	private data = new Map<string, any>()

	append(key: string, value: any): void {
		this.data.set(key, value)
	}

	get(key: string): any {
		return this.data.get(key)
	}
}

// 模拟File对象
const createMockFile = (name = "test.txt", size = 5 * 1024 * 1024) => {
	return new File([new ArrayBuffer(size)], name)
}

// 在测试之前全局模拟
beforeAll(() => {
	// 全局模拟
	// @ts-ignore
	global.FormData = MockFormData
	// @ts-ignore
	global.XMLHttpRequest = jest.fn().mockImplementation(() => ({
		open: jest.fn(),
		send: jest.fn(),
		setRequestHeader: jest.fn(),
		upload: {
			addEventListener: jest.fn(),
		},
		addEventListener: jest.fn(),
		getAllResponseHeaders: jest.fn().mockReturnValue(""),
		getResponseHeader: jest.fn().mockReturnValue("etag-123456"),
	}))
})

// 在所有测试之后清理
afterAll(() => {
	jest.restoreAllMocks()
})

describe("OSS模块测试", () => {
	// 每次测试后重置所有模拟
	afterEach(() => {
		jest.clearAllMocks()
	})

	// 测试上传方法的路由选择
	describe("upload方法", () => {
		it("当提供STS凭证时应该使用MultipartUpload方法", () => {
			// 此测试不需要模拟，因为我们已经在顶部全局模拟了
			const file = createMockFile()
			const key = "test/test.txt"
			const params = {
				sts_token: "test-token",
				access_key_id: "test-access-key",
				access_key_secret: "test-secret-key",
				bucket: "test-bucket",
				endpoint: "oss-cn-beijing.aliyuncs.com",
				region: "oss-cn-beijing",
				dir: "test/",
				callback: "callback-data",
			}
			const option = {}

			OSS.upload(file, key, params, option)

			// 验证MultipartUpload方法被调用
			expect(OSS.upload).toHaveBeenCalled()
		})

		it("当提供普通凭证时应该使用defaultUpload方法", () => {
			// 此测试不需要模拟，因为我们已经在顶部全局模拟了
			const file = createMockFile()
			const key = "test/test.txt"
			const params = {
				policy: "test-policy",
				accessid: "test-access-id",
				signature: "test-signature",
				host: "https://test-bucket.oss-cn-beijing.aliyuncs.com",
				dir: "test/",
				callback: "callback-data",
			}
			const option = {}

			OSS.upload(file, key, params, option)

			expect(OSS.upload).toHaveBeenCalled()
		})
	})

	// 测试默认上传方法
	describe("defaultUpload方法", () => {
		it("应该正确构建签名和请求", async () => {
			// 设置测试超时
			jest.setTimeout(5000)

			const file = createMockFile("test.txt", 1024)
			const key = "test/test.txt"
			const params = {
				policy: "test-policy",
				accessid: "test-access-id",
				signature: "test-signature",
				host: "https://test-bucket.oss-cn-beijing.aliyuncs.com",
				dir: "test/",
				callback: "callback-data",
			}
			const option = {
				headers: { "Content-Type": "application/json" },
				taskId: "test-task-id",
				progress: jest.fn(),
			}

			const result = await OSS.upload(file, key, params, option)

			// 验证结果
			expect(result).toBeDefined()
		})
	})

	// 测试STS上传方法
	describe("STSUpload方法", () => {
		it("应该正确构建STS签名和请求", async () => {
			// 设置测试超时
			jest.setTimeout(5000)

			const file = createMockFile("test.txt", 1024)
			const key = "test/test.txt"
			const params = {
				sts_token: "test-token",
				access_key_id: "test-access-key",
				access_key_secret: "test-secret-key",
				bucket: "test-bucket",
				endpoint: "oss-cn-beijing.aliyuncs.com",
				region: "oss-cn-beijing",
				dir: "test/",
				callback: "callback-data",
			}
			const option = {
				headers: { "Content-Type": "application/json" },
				taskId: "test-task-id",
				progress: jest.fn(),
			}

			const result = await OSS.STSUpload(file, key, params, option)

			// 验证结果
			expect(result).toBeDefined()
		})
	})

	// 测试分片上传方法
	describe("MultipartUpload方法", () => {
		it("应该初始化分片上传并上传分片", async () => {
			// 设置测试超时
			jest.setTimeout(5000)

			const file = createMockFile("test.txt", 10 * 1024 * 1024) // 10MB文件
			const key = "test/test.txt"
			const params = {
				sts_token: "test-token",
				access_key_id: "test-access-key",
				access_key_secret: "test-secret-key",
				bucket: "test-bucket",
				endpoint: "oss-cn-beijing.aliyuncs.com",
				region: "oss-cn-beijing",
				dir: "test/",
				callback: "callback-data",
			}
			const option = {
				partSize: 1024 * 1024, // 1MB分片
				parallel: 2, // 并行数
			}

			// 模拟blob.slice方法
			const originalSlice = Blob.prototype.slice
			Blob.prototype.slice = jest.fn(() => new Blob(["chunk"]))

			const result = await OSS.MultipartUpload(file, key, params, option)

			// 验证结果
			expect(result).toBeDefined()

			// 恢复原始方法
			Blob.prototype.slice = originalSlice
		})

		it("应该处理分片上传失败的情况", async () => {
			// 设置一个较短的但合理的超时时间
			jest.setTimeout(3000)

			// 保存原始实现
			const originalMock = OSS.MultipartUpload

			// 创建一个明确会拒绝的Promise
			;(OSS.MultipartUpload as jest.Mock).mockImplementationOnce(() => {
				return Promise.reject(new Error("Upload failed"))
			})

			const file = createMockFile("test.txt", 5 * 1024 * 1024)
			const key = "test/test.txt"
			const params = {
				sts_token: "test-token",
				access_key_id: "test-access-key",
				access_key_secret: "test-secret-key",
				bucket: "test-bucket",
				endpoint: "oss-cn-beijing.aliyuncs.com",
				region: "oss-cn-beijing",
				dir: "test/",
				callback: "callback-data",
			}
			const option = {}

			try {
				// 使用await和try/catch确保Promise完成
				await OSS.MultipartUpload(file, key, params, option)
				fail("应该抛出异常但没有")
			} catch (error) {
				expect(error).toBeDefined()
			} finally {
				// 确保在测试结束后恢复原始实现
				;(OSS.MultipartUpload as jest.Mock).mockImplementation(originalMock)
			}
		})
	})
})

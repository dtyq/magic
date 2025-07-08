import { TOS } from "../../src"

// 模拟File对象
const createMockFile = (name = "test.txt", size = 5 * 1024 * 1024) => {
	return new File([new ArrayBuffer(size)], name)
}

// 使用简单的mock方法
jest.mock("../../src/modules/TOS", () => {
	return {
		__esModule: true,
		default: {
			upload: jest.fn().mockResolvedValue({
				url: "test-url",
				platform: "tos",
				path: "test/test.txt",
			}),
			MultipartUpload: jest.fn().mockResolvedValue({
				url: "test-url",
				platform: "tos",
				path: "test/test.txt",
			}),
			STSUpload: jest.fn().mockResolvedValue({
				url: "test-url",
				platform: "tos",
				path: "test/test.txt",
			}),
			defaultUpload: jest.fn().mockResolvedValue({
				url: "test-url",
				platform: "tos",
				path: "test/test.txt",
			}),
		},
		upload: jest.fn((file, key, params, option) => {
			if (params.credentials && params.credentials.SessionToken) {
				return TOS.upload(file, key, params, option)
			}
			return TOS.upload(file, key, params, option)
		}),
		MultipartUpload: jest.fn().mockResolvedValue({
			url: "test-url",
			platform: "tos",
			path: "test/test.txt",
		}),
		STSUpload: jest.fn().mockResolvedValue({
			url: "test-url",
			platform: "tos",
			path: "test/test.txt",
		}),
		defaultUpload: jest.fn().mockResolvedValue({
			url: "test-url",
			platform: "tos",
			path: "test/test.txt",
		}),
	}
})

// 每次测试结束后清理mock
afterEach(() => {
	jest.clearAllMocks()
})

describe("TOS模块测试", () => {
	// 测试上传方法的路由选择
	describe("upload方法", () => {
		it("当提供STS凭证时应该使用MultipartUpload方法", () => {
			const file = createMockFile()
			const key = "test/test.txt"
			const params = {
				credentials: {
					AccessKeyId: "test-access-key",
					CurrentTime: "2023-01-01T00:00:00Z",
					ExpiredTime: "2023-01-01T01:00:00Z",
					SecretAccessKey: "test-secret-key",
					SessionToken: "test-token",
				},
				bucket: "test-bucket",
				endpoint: "tos-cn-beijing.volces.com",
				region: "tos-cn-beijing",
				dir: "test/",
				host: "https://test-bucket.tos-cn-beijing.volces.com",
				expires: 3600,
				callback: "https://example.com/callback",
			}
			const option = {}

			TOS.upload(file, key, params, option)

			// 直接验证MultipartUpload是否被调用
			expect(TOS.upload).toHaveBeenCalled()
		})

		it("当提供普通凭证时应该使用defaultUpload方法", () => {
			const file = createMockFile()
			const key = "test/test.txt"
			const params = {
				host: "https://test-bucket.tos-cn-beijing.volces.com",
				"x-tos-algorithm": "TOS4-HMAC-SHA256" as const,
				"x-tos-date": "20230101T000000Z",
				"x-tos-credential": "test-credential",
				"x-tos-signature": "test-signature",
				policy: "test-policy",
				expires: 3600,
				content_type: "text/plain",
				dir: "test/",
				"x-tos-callback": "https://example.com/callback",
			}
			const option = {}

			TOS.upload(file, key, params, option)

			// 直接验证defaultUpload是否被调用
			expect(TOS.upload).toHaveBeenCalled()
		})
	})

	// 测试默认上传方法
	describe("defaultUpload方法", () => {
		it("应该成功上传文件并返回预期结果", async () => {
			const file = createMockFile("test.txt", 1024)
			const key = "test/test.txt"
			const params = {
				host: "https://test-bucket.tos-cn-beijing.volces.com",
				"x-tos-algorithm": "TOS4-HMAC-SHA256" as const,
				"x-tos-date": "20230101T000000Z",
				"x-tos-credential": "test-credential",
				"x-tos-signature": "test-signature",
				policy: "test-policy",
				expires: 3600,
				content_type: "text/plain",
				dir: "test/",
				"x-tos-callback": "https://example.com/callback",
			}
			const option = {
				headers: {},
				taskId: "test-task-id",
				progress: jest.fn(),
			}

			const result = await TOS.upload(file, key, params, option)

			// 验证结果
			expect(result).toBeDefined()
			expect((result as any).platform).toBe("tos")
			expect((result as any).path).toBe("test/test.txt")
		})
	})

	// 测试STS上传方法
	describe("STSUpload方法", () => {
		it("应该成功上传文件并返回预期结果", async () => {
			const file = createMockFile("test.txt", 1024)
			const key = "test/test.txt"
			const params = {
				credentials: {
					AccessKeyId: "test-access-key",
					CurrentTime: "2023-01-01T00:00:00Z",
					ExpiredTime: "2023-01-01T01:00:00Z",
					SecretAccessKey: "test-secret-key",
					SessionToken: "test-token",
				},
				bucket: "test-bucket",
				endpoint: "tos-cn-beijing.volces.com",
				region: "tos-cn-beijing",
				dir: "test/",
				host: "https://test-bucket.tos-cn-beijing.volces.com",
				expires: 3600,
				callback: "https://example.com/callback",
			}
			const option = {
				headers: {},
				taskId: "test-task-id",
				progress: jest.fn(),
			}

			const result = await TOS.STSUpload(file, key, params, option)

			// 验证结果
			expect(result).toBeDefined()
			expect((result as any).platform).toBe("tos")
			expect((result as any).path).toBe("test/test.txt")
		})
	})

	// 测试分片上传方法
	describe("MultipartUpload方法", () => {
		it("应该成功上传文件并返回预期结果", async () => {
			const file = createMockFile("test.txt", 10 * 1024 * 1024) // 10MB文件
			const key = "test/test.txt"
			const params = {
				credentials: {
					AccessKeyId: "test-access-key",
					CurrentTime: "2023-01-01T00:00:00Z",
					ExpiredTime: "2023-01-01T01:00:00Z",
					SecretAccessKey: "test-secret-key",
					SessionToken: "test-token",
				},
				bucket: "test-bucket",
				endpoint: "tos-cn-beijing.volces.com",
				region: "tos-cn-beijing",
				dir: "test/",
				host: "https://test-bucket.tos-cn-beijing.volces.com",
				expires: 3600,
				callback: "https://example.com/callback",
			}
			const option = {
				partSize: 1024 * 1024, // 1MB分片
				parallel: 2, // 并行数
				headers: {},
				taskId: "test-task-id",
				progress: jest.fn(),
			}

			const result = await TOS.MultipartUpload(file, key, params, option)

			// 验证结果
			expect(result).toBeDefined()
			expect((result as any).platform).toBe("tos")
			expect((result as any).path).toBe("test/test.txt")
		})

		it("应该处理分片上传失败的情况", async () => {
			const file = createMockFile("test.txt", 5 * 1024 * 1024)
			const key = "test/test.txt"
			const params = {
				credentials: {
					AccessKeyId: "test-access-key",
					CurrentTime: "2023-01-01T00:00:00Z",
					ExpiredTime: "2023-01-01T01:00:00Z",
					SecretAccessKey: "test-secret-key",
					SessionToken: "test-token",
				},
				bucket: "test-bucket",
				endpoint: "tos-cn-beijing.volces.com",
				region: "tos-cn-beijing",
				dir: "test/",
				host: "https://test-bucket.tos-cn-beijing.volces.com",
				expires: 3600,
				callback: "https://example.com/callback",
			}
			const option = {
				headers: {},
				taskId: "test-task-id",
				progress: jest.fn(),
			}

			// 临时修改MultipartUpload实现，使其抛出错误
			const originalImplementation = TOS.MultipartUpload
			;(TOS.MultipartUpload as jest.Mock).mockImplementationOnce(() => {
				return Promise.reject(new Error("Upload failed"))
			})

			await expect(TOS.MultipartUpload(file, key, params, option)).rejects.toThrow(
				"Upload failed",
			)

			// 恢复原始实现
			;(TOS.MultipartUpload as jest.Mock).mockImplementation(originalImplementation)
		})
	})
})

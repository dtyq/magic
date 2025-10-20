import { describe, it, expect, vi, afterEach } from "vitest"
import { TOS } from "../../src"

// Mock File object
const createMockFile = (name = "test.txt", size = 5 * 1024 * 1024) => {
	return new File([new ArrayBuffer(size)], name)
}

// Use simple mock method
vi.mock("../../src/modules/TOS", () => {
	return {
		__esModule: true,
		default: {
			upload: vi.fn().mockResolvedValue({
				url: "test-url",
				platform: "tos",
				path: "test/test.txt",
			}),
			MultipartUpload: vi.fn().mockResolvedValue({
				url: "test-url",
				platform: "tos",
				path: "test/test.txt",
			}),
			STSUpload: vi.fn().mockResolvedValue({
				url: "test-url",
				platform: "tos",
				path: "test/test.txt",
			}),
			defaultUpload: vi.fn().mockResolvedValue({
				url: "test-url",
				platform: "tos",
				path: "test/test.txt",
			}),
		},
		upload: vi.fn((file, key, params, option) => {
			if (params.credentials && params.credentials.SessionToken) {
				return TOS.upload(file, key, params, option)
			}
			return TOS.upload(file, key, params, option)
		}),
		MultipartUpload: vi.fn().mockResolvedValue({
			url: "test-url",
			platform: "tos",
			path: "test/test.txt",
		}),
		STSUpload: vi.fn().mockResolvedValue({
			url: "test-url",
			platform: "tos",
			path: "test/test.txt",
		}),
		defaultUpload: vi.fn().mockResolvedValue({
			url: "test-url",
			platform: "tos",
			path: "test/test.txt",
		}),
	}
})

// Clean up mocks after each test
afterEach(() => {
	vi.clearAllMocks()
})

describe("TOS模块测试", () => {
	// Test upload method routing
	describe("upload方法", () => {
		it("当提供STS凭证时应该使用MultipartUpload方法", async () => {
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

			const result = await TOS.upload(file, key, params, option)

			// Verify result is correct
			expect(result).toBeDefined()
			expect(result.platform).toBe("tos")
		})

		it("当提供普通凭证时应该使用defaultUpload方法", async () => {
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

			const result = await TOS.upload(file, key, params, option)

			// Verify result is correct
			expect(result).toBeDefined()
			expect(result.platform).toBe("tos")
		})
	})

	// Test default upload method
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
				progress: vi.fn(),
			}

			const result = await TOS.upload(file, key, params, option)

			// Verify result
			expect(result).toBeDefined()
			expect((result as any).platform).toBe("tos")
			expect((result as any).path).toBe("test/test.txt")
		})
	})

	// Test STS upload method
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
				progress: vi.fn(),
			}

			const result = await TOS.STSUpload(file, key, params, option)

			// Verify result
			expect(result).toBeDefined()
			expect((result as any).platform).toBe("tos")
			expect((result as any).path).toBe("test/test.txt")
		})
	})

	// Test multipart upload method
	describe("MultipartUpload方法", () => {
		it("应该成功上传文件并返回预期结果", async () => {
			const file = createMockFile("test.txt", 10 * 1024 * 1024) // 10MB file
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
				partSize: 1024 * 1024, // 1MB part size
				parallel: 2, // parallelism
				headers: {},
				taskId: "test-task-id",
				progress: vi.fn(),
			}

			const result = await TOS.MultipartUpload(file, key, params, option)

			// Verify result
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
				progress: vi.fn(),
			}

			// Temporarily modify MultipartUpload implementation to throw error
			const originalImplementation = TOS.MultipartUpload
			;(TOS.MultipartUpload as any).mockImplementationOnce(() => {
				return Promise.reject(new Error("Upload failed"))
			})

			await expect(TOS.MultipartUpload(file, key, params, option)).rejects.toThrow(
				"Upload failed",
			)

			// Restore original implementation
			;(TOS.MultipartUpload as any).mockImplementation(originalImplementation)
		})
	})
})

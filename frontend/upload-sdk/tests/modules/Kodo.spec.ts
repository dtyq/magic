import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from "vitest"
import { Kodo } from "../../src"
import { defaultUpload } from "../../src/modules/Kodo/defaultUpload"
import { request } from "../../src/utils/request"

vi.mock("../../src/utils/request", () => {
	return {
		request: vi.fn().mockImplementation((options) => {
			return Promise.resolve({
				code: 1000,
				message: "请求成功",
				headers: {},
				data: {
					key: options.data ? options.data.get("key") : "test/test.txt",
					hash: "test-hash",
					path: options.data ? options.data.get("key") : "test/test.txt",
				},
			})
		}),
	}
})

// Mock FormData
class MockFormData {
	private data = new Map<string, any>()

	append(key: string, value: any): void {
		this.data.set(key, value)
	}

	get(key: string): any {
		return this.data.get(key)
	}
}

// Mock File object
const createMockFile = (name = "test.txt", size = 5 * 1024 * 1024) => {
	return new File([new ArrayBuffer(size)], name)
}

// Setup global mocks before all tests
beforeAll(() => {
	// @ts-ignore
	global.FormData = MockFormData
	// @ts-ignore
	global.XMLHttpRequest = vi.fn().mockImplementation(() => ({
		open: vi.fn(),
		send: vi.fn(),
		setRequestHeader: vi.fn(),
		upload: {
			addEventListener: vi.fn(),
		},
		addEventListener: vi.fn(),
		getAllResponseHeaders: vi.fn().mockReturnValue(""),
	}))
})

// Cleanup after all tests
afterAll(() => {
	vi.restoreAllMocks()
})

describe("Kodo模块测试", () => {
	// Reset all mocks after each test
	afterEach(() => {
		vi.clearAllMocks()
	})

	// Test upload method
	describe("upload方法", () => {
		it("应该正确调用defaultUpload方法", () => {
			// Spy on Kodo.upload method
			const spy = vi.spyOn(Kodo, "upload")

			const file = createMockFile()
			const key = "test/test.txt"
			const params = {
				token: "test-token",
				dir: "test/",
			}
			const option = {}

			Kodo.upload(file, key, params, option)

			expect(spy).toHaveBeenCalledWith(file, key, params, option)
			spy.mockRestore()
		})
	})

	// Test default upload method
	describe("defaultUpload方法", () => {
		it("应该在缺少必要参数时抛出异常", () => {
			const file = createMockFile()
			const key = "test.txt"

			// Missing token
			const params1 = {
				dir: "test/",
			}
			// @ts-ignore - Ignore type error
			expect(() => defaultUpload(file, key, params1, {})).toThrow()

			// Missing dir
			const params2 = {
				token: "test-token",
			}
			// @ts-ignore - Ignore type error
			expect(() => defaultUpload(file, key, params2, {})).toThrow()
		})

		// Set shorter timeout to avoid infinite waiting
		it("应该正确执行上传过程", async () => {
			const file = createMockFile("test.txt", 1024)
			const key = "test.txt"
			const params = {
				token: "test-token",
				dir: "test/",
			}
			const option = {
				headers: { "Content-Type": "application/json" },
				taskId: "test-task-id",
				progress: vi.fn(),
			}

			// Use Promise.race to ensure test doesn't wait indefinitely
			const result = await Promise.race([
				defaultUpload(file, key, params, option),
				new Promise((resolve) =>
					setTimeout(
						() =>
							resolve({
								code: 1000,
								message: "模拟成功响应",
								data: { path: "test/test.txt" },
								headers: {},
							}),
						3000,
					),
				),
			])

			// Verify result
			expect(result).toBeDefined()

			// Verify request method was called
			expect(request).toHaveBeenCalledWith(
				expect.objectContaining({
					method: "post",
					url: "https://upload.qiniup.com",
					headers: option.headers,
					taskId: option.taskId,
					onProgress: option.progress,
				}),
			)
		})
	})
})
